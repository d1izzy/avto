import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Heading, Text, VStack } from "@astryxdesign/core";
import { MailCheck, UserRound } from "lucide-react";
import { Field, Notice } from "@/components/studio-ui";
import { supabase } from "@/lib/supabase";
import { EMAIL_RETRY_MS, emailLinkError, readPendingEmail, rememberPendingEmail } from "./email-link";

export function EmailSignIn({ slug, callbackFailed }: { slug: string; callbackFailed: boolean }) {
  const [pending, setPending] = useState(readPendingEmail);
  const [email, setEmail] = useState(pending?.email ?? "");
  const [retryAt, setRetryAt] = useState((pending?.sentAt ?? 0) + EMAIL_RETRY_MS);
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

  const send = useMutation({
    mutationFn: async (address: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        email: address,
        options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/s/${slug}/account` },
      });
      if (error) {
        if (error.status === 429) { setRetryAt(Date.now() + EMAIL_RETRY_MS); setNow(Date.now()); }
        throw new Error(emailLinkError(error));
      }
      return { email: address, sentAt: Date.now() };
    },
    onSuccess: (result) => {
      rememberPendingEmail(result);
      setPending(result);
      setRetryAt(result.sentAt + EMAIL_RETRY_MS);
      setNow(result.sentAt);
      setShowCallbackError(false);
    },
    onSettled: () => { sending.current = false; },
  });
  function submit(address: string) {
    if (sending.current || Date.now() < retryAt || !address.trim()) return;
    sending.current = true;
    send.mutate(address.trim());
  }

  return <VStack gap={5}>
    {pending ? <>
      <MailCheck className="size-9 text-accent" aria-hidden />
      <Heading level={1} ref={sentHeading} tabIndex={-1}>Письмо отправлено</Heading>
      <VStack gap={2} role="status">
        <Text color="secondary">Отправили ссылку на почту</Text>
        <Text weight="semibold" className="break-all">{pending.email}</Text>
        <Text color="secondary">Откройте письмо и нажмите ссылку, чтобы подтвердить почту и войти в профиль. Пароль не нужен.</Text>
      </VStack>
      <Text size="sm" color="secondary">Если письма нет, проверьте папку «Спам» или отправьте его ещё раз. Используйте ссылку из последнего письма.</Text>
      {showCallbackError && <Notice error>Ссылка недействительна или уже использована. Запросите новое письмо.</Notice>}
      {send.isError && <Notice error>{send.error.message}</Notice>}
      <Button label={secondsLeft ? `Отправить повторно через ${secondsLeft} с` : "Отправить письмо ещё раз"} isLoading={send.isPending} isDisabled={secondsLeft > 0 || send.isPending} onClick={() => submit(pending.email)} />
      <Button label="Изменить адрес почты" variant="ghost" isDisabled={send.isPending} onClick={() => { setPending(null); rememberPendingEmail(null); send.reset(); }} />
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
          <Button variant="primary" label={secondsLeft ? `Получить ссылку через ${secondsLeft} с` : "Получить ссылку"} type="submit" isLoading={send.isPending} isDisabled={!email.trim() || secondsLeft > 0 || send.isPending} />
        </VStack>
      </form>
    </>}
  </VStack>;
}
