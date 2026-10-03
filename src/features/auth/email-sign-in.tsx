import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Heading, Text, VStack } from "@astryxdesign/core";
import { MailCheck, UserRound } from "lucide-react";
import { Field, Notice } from "@/components/studio-ui";
import { supabase } from "@/lib/supabase";
import { EMAIL_LIMIT_MESSAGE, EMAIL_RETRY_MS, emailLinkError, emailRetryDelay, readEmailRetry, rememberEmailRetry, rememberPendingEmail, usePendingEmail } from "./email-link";
import { handoffRequest, newEmailChannel, useEmailHandoff } from "./email-handoff";

export function EmailSignIn({ slug, callbackFailed }: { slug: string; callbackFailed: boolean }) {
  const pending = usePendingEmail();
  const handoff = useEmailHandoff();
  const [email, setEmail] = useState(pending?.email ?? readEmailRetry()?.email ?? "");
  const [cooldown, setCooldown] = useState(readEmailRetry);
  const retryAt = Math.max(cooldown?.until ?? 0, (pending?.sentAt ?? 0) + EMAIL_RETRY_MS);
  const [now, setNow] = useState(Date.now);
  const [showCallbackError, setShowCallbackError] = useState(callbackFailed);
  const sentHeading = useRef<HTMLHeadingElement>(null);
  const sending = useRef(false);
  const secondsLeft = Math.max(0, Math.ceil((retryAt - now) / 1000));

  useEffect(() => {
    if (!secondsLeft) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);
  useEffect(() => { if (pending) sentHeading.current?.focus(); }, [pending]);
  useEffect(() => {
    const sync = () => { setCooldown(readEmailRetry()); setNow(Date.now()); };
    window.addEventListener("storage", sync); window.addEventListener("focus", sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("focus", sync); };
  }, []);
  function retryIn(email: string, delay: number, limited = false) {
    const next = { until: Date.now() + delay, email, limited };
    rememberEmailRetry(next); setCooldown(next); setNow(Date.now());
  }

  const send = useMutation({
    mutationFn: async (address: string) => {
      const channel = newEmailChannel();
      const started = await handoffRequest(channel, "start");
      if (started.status !== "waiting") throw new Error("Слишком много попыток входа. Подождите перед повторной отправкой.");
      const { error } = await supabase.auth.signInWithOtp({
        email: address,
        options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/s/${slug}/account?email_flow=${channel}` },
      });
      if (error) {
        if (error.status === 429) retryIn(address, emailRetryDelay(error), error.code === "over_email_send_rate_limit");
        throw new Error(emailLinkError(error));
      }
      return { email: address, sentAt: Date.now(), channel, slug };
    },
    onSuccess: (result) => {
      rememberPendingEmail(result);
      retryIn(result.email, EMAIL_RETRY_MS);
      setShowCallbackError(false);
    },
    onSettled: () => { sending.current = false; },
  });
  function submit(address: string) {
    if (sending.current || Date.now() < Math.max(retryAt, readEmailRetry()?.until ?? 0) || !address.trim()) return;
    sending.current = true;
    retryIn(address.trim(), EMAIL_RETRY_MS);
    send.mutate(address.trim());
  }
  const waitLabel = secondsLeft > 60 ? `${Math.ceil(secondsLeft / 60)} мин` : `${secondsLeft} с`;

  return <VStack gap={5}>
    {pending ? <>
      <MailCheck className="size-9 text-accent" aria-hidden />
      <Heading level={1} ref={sentHeading} tabIndex={-1}>Письмо отправлено</Heading>
      <VStack gap={2} role="status">
        <Text color="secondary">Отправили ссылку на почту</Text>
        <Text weight="semibold" className="break-all">{pending.email}</Text>
        <Text color="secondary">Откройте письмо и нажмите ссылку. Затем вернитесь сюда — вход завершится автоматически, даже если ссылка открылась в другом браузере.</Text>
      </VStack>
      <Text size="sm" color="secondary">Если письма нет, проверьте папку «Спам» или отправьте его ещё раз. Используйте ссылку из последнего письма.</Text>
      {showCallbackError && <Notice error>Ссылка недействительна или уже использована. Запросите новое письмо.</Notice>}
      {pending.failed && <Notice error>Время подтверждения истекло или ссылка уже использована. Получите новое письмо.</Notice>}
      {handoff.isError && !pending.failed && <Notice error>{handoff.error.message}</Notice>}
      {send.isError && <Notice error>{send.error.message}</Notice>}
      {!send.isError && cooldown?.limited && secondsLeft > 0 && <Notice>{EMAIL_LIMIT_MESSAGE}</Notice>}
      {pending.channel && !pending.failed && <Button variant="primary" label="Я уже открыл ссылку — проверить вход" isLoading={handoff.isFetching} onClick={() => handoff.refetch()} />}
      <Button label={secondsLeft ? `Отправить повторно через ${waitLabel}` : "Отправить письмо ещё раз"} isLoading={send.isPending} isDisabled={secondsLeft > 0 || send.isPending || handoff.isFetching} onClick={() => submit(pending.email)} />
      <Button label="Изменить адрес почты" variant="ghost" isDisabled={send.isPending || handoff.isFetching} onClick={() => { rememberPendingEmail(null); send.reset(); }} />
    </> : <>
      <UserRound className="size-9 text-accent" aria-hidden />
      <Heading level={1}>Мой профиль</Heading>
      <Text color="secondary">Войдите по почте, чтобы сохранять записи и открывать их с любого устройства.</Text>
      {showCallbackError && <Notice error>Ссылка для входа недействительна, устарела или уже использована. Получите новую ссылку.</Notice>}
      <form onSubmit={(event) => { event.preventDefault(); submit(email); }}>
        <VStack gap={4}>
          <Field label="Почта" type="email" required maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); send.reset(); }} autoComplete="email" autoCapitalize="none" spellCheck={false} disabled={send.isPending} aria-describedby="email-help" />
          <Text id="email-help" size="sm" color="secondary">Отправим письмо со ссылкой. Нажмите её, чтобы подтвердить почту и войти. Пароль не нужен.</Text>
          {send.isError && <Notice error>{send.error.message}</Notice>}
          {!send.isError && cooldown?.limited && secondsLeft > 0 && <Notice>{EMAIL_LIMIT_MESSAGE}</Notice>}
          <Button variant="primary" label={secondsLeft ? `Получить ссылку через ${waitLabel}` : "Получить ссылку"} type="submit" isLoading={send.isPending} isDisabled={!email.trim() || secondsLeft > 0 || send.isPending} />
        </VStack>
      </form>
    </>}
  </VStack>;
}
