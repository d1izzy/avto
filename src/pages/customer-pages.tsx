import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Heading, HStack, Text, Token, VStack } from "@astryxdesign/core";
import { CalendarCheck2, Check, Smartphone, UserRound } from "lucide-react";
import { getBooking } from "@/features/booking/api";
import { savedBookings, statusLabels } from "@/features/booking/local-bookings";
import { emailCallback, emailSessionInitialization, supabase } from "@/lib/supabase";
import { useTenant } from "@/features/tenant/context";
import { dateTime } from "@/lib/utils";
import { Field, Loading, Notice, Retry } from "@/components/studio-ui";
import { accountBookings, getProfile, saveProfile, useSession } from "@/features/auth/customer";
import type { CustomerProfile } from "@/types/database";
import { EmailSignIn } from "@/features/auth/email-sign-in";
import { rememberPendingEmail } from "@/features/auth/email-link";
import { deliverEmailReturn, isHandoffReturn } from "@/features/auth/email-handoff";

export function CustomerBookings({ profile = true }: { profile?: boolean }) {
  const { tenant } = useTenant();
  const session = useSession(); const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const callback = useQuery({ queryKey: ["email-callback"], staleTime: Infinity, retry: false, queryFn: async () => {
    const { error } = await emailSessionInitialization;
    if (emailCallback.present || isHandoffReturn) {
      // Auth has consumed the link; remove expired-link errors and sensitive URL fragments too.
      const url = new URL(window.location.href);
      for (const key of ["code", "email_flow", "sb_flow_id", "error", "error_code", "error_description"]) url.searchParams.delete(key);
      url.hash = "";
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
    }
    if (isHandoffReturn && !emailCallback.failed) return { failed: false, ...(await deliverEmailReturn()) };
    return { failed: emailCallback.present && (emailCallback.failed || !!error), remote: false };
  } });
  const user = useQuery({ queryKey: ["account-user", session?.user.id, session?.expires_at], enabled: !!session, retry: false, queryFn: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Не удалось проверить профиль. Проверьте подключение и попробуйте снова.");
    return data.user;
  } });
  const confirmed = !!user.data?.email && !!user.data.email_confirmed_at;
  useEffect(() => { if (confirmed) rememberPendingEmail(null); }, [confirmed]);
  const tokens = savedBookings(tenant.slug);
  const query = useQuery({ queryKey: ["saved-bookings", tenant.slug, tokens, confirmed ? session?.user.id : null], enabled: session !== undefined && (!session || !user.isPending), queryFn: async () => {
    if (confirmed) return accountBookings(tenant.slug);
    const results = await Promise.allSettled(tokens.map(async (token) => ({ token, booking: await getBooking(token) })));
    return { bookings: results.flatMap((r) => r.status === "fulfilled" ? [r.value] : []), syncFailed: results.some((r) => r.status === "rejected") };
  } });
  const profileQuery = useQuery({ queryKey: ["customer-profile", session?.user.id], enabled: confirmed && editing, queryFn: () => getProfile(session!.user.id) });
  const logout = useMutation({ mutationFn: async () => { const { error } = await supabase.auth.signOut({ scope: "local" }); if (error) throw new Error("Не удалось выйти. Попробуйте снова."); rememberPendingEmail(null); setEditing(false); client.clear(); } });
  const bookings = query.data?.bookings.filter(({ booking }) => booking?.tenant_slug === tenant.slug) ?? [];
  return <VStack gap={6} maxWidth={720} width="100%" paddingBlock={6} className="mx-auto">
    <Link to={`/s/${tenant.slug}`} className="text-sm text-secondary">← На главную</Link>
    {profile && <Card padding={6}><VStack gap={5}>
      {session === undefined || callback.isPending || (session && user.isPending) ? <Loading label="Проверяем вход…" /> : isHandoffReturn && (callback.isError || callback.data?.remote) ? <>
        <Smartphone className="size-9 text-accent" aria-hidden />
        <Heading level={1}>{callback.isError ? "Не удалось передать подтверждение" : "Вернитесь в приложение"}</Heading>
        {callback.isError ? <><Notice error>{callback.error.message}</Notice><Retry onClick={() => callback.refetch()} /></> : <Text color="secondary">Ссылка открыта. Вернитесь в приложение или вкладку, где вы вводили почту. Профиль появится там автоматически. Сделайте это в течение 5 минут. Повторно отправлять письмо не нужно.</Text>}
      </> : session ? <>
        <UserRound className="size-9 text-accent" aria-hidden />
        <Heading level={1}>Мой профиль</Heading>
        {callback.data?.failed && <Notice error>Эта ссылка уже использована или устарела. Ваш текущий вход сохранён.</Notice>}
        {user.isError ? <><Notice error>{user.error.message}</Notice><Retry onClick={() => user.refetch()} /></> : confirmed ? <>
          <VStack gap={3} align="start">
            <Text weight="semibold" className="break-all">{user.data?.email}</Text>
            <Token label="Почта подтверждена" color="green" icon={<Check aria-hidden />} />
          </VStack>
          <Text color="secondary">Вы вошли в профиль. Новые записи сохраняются здесь и доступны с любого устройства после входа по этой почте.</Text>
          <Button label={editing ? "Скрыть данные" : "Редактировать данные"} aria-expanded={editing} aria-controls="profile-details" onClick={() => setEditing(!editing)} />
          {editing && <VStack id="profile-details" gap={4}>{profileQuery.isPending ? <Loading /> : profileQuery.isError ? <><Notice error>Не удалось загрузить данные.</Notice><Retry onClick={() => profileQuery.refetch()} /></> : <ProfileEditor key={session.user.id} userId={session.user.id} initial={profileQuery.data ?? null} />}</VStack>}
        </> : <Notice error>Почта ещё не подтверждена. Выйдите из профиля и получите ссылку для подтверждения почты.</Notice>}
        <Button label="Выйти из профиля" variant="ghost" isLoading={logout.isPending} onClick={() => logout.mutate()} />
        {logout.isError && <Notice error>{logout.error.message}</Notice>}
      </> : <EmailSignIn slug={tenant.slug} callbackFailed={!!callback.data?.failed} />}
      <Text size="sm" color="secondary">Вы владелец студии? <Link to={`/s/${tenant.slug}/owner`} className="text-accent underline">Открыть кабинет студии</Link></Text>
    </VStack></Card>}
    <VStack gap={4}><Heading level={profile ? 2 : 1}>Мои записи</Heading>{!session && <Text size="sm" color="secondary">Здесь отображаются записи, сохранённые в этом браузере. Сохраните ссылку на запись, чтобы открыть её на другом устройстве.</Text>}{query.data?.syncFailed && <Notice>Часть записей не удалось загрузить. Сохранённые ссылки остаются доступными. Попробуйте обновить страницу.</Notice>}{query.isPending ? <Loading /> : query.isError ? <><Notice error>Не удалось загрузить записи.</Notice><Retry onClick={() => query.refetch()} /></> : !bookings.length ? <Card padding={6}><VStack gap={4} align="center"><CalendarCheck2 className="size-10 text-accent" aria-hidden /><Heading level={3}>Пока нет записей</Heading><Text color="secondary" justify="center">Выберите услугу и удобное время, чтобы записаться.</Text><Button variant="primary" label="Записаться" href={`/s/${tenant.slug}/book`} /></VStack></Card> : <VStack gap={0} className="rounded-xl border border-border overflow-hidden">{bookings.map(({ token, booking }) => <Link key={token} to={`/s/${tenant.slug}/booking/${token}`} className="block border-b border-border last:border-0"><HStack padding={5} gap={4} align="center" justify="between"><VStack gap={2}><Text weight="semibold">{booking.service_name}</Text><Text color="secondary" size="sm">{dateTime(booking.starts_at, tenant.timezone)}</Text></VStack><Token label={statusLabels[booking.status]} color={booking.status === "cancelled" ? "gray" : "green"} /></HStack></Link>)}</VStack>}</VStack></VStack>;
}

function ProfileEditor({ userId, initial }: { userId: string; initial: CustomerProfile | null }) {
  const [value, setValue] = useState<CustomerProfile>(initial ?? { name: "", phone: "", vehicle_brand: "", vehicle_model: "", license_plate: "" });
  const client = useQueryClient();
  const save = useMutation({ mutationFn: () => saveProfile(userId, value), onSuccess: () => client.invalidateQueries({ queryKey: ["customer-profile", userId] }) });
  return <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}><VStack gap={4}>{([["name", "Имя", 100], ["phone", "Телефон", 30], ["vehicle_brand", "Марка", 80], ["vehicle_model", "Модель", 80], ["license_plate", "Госномер", 20]] as const).map(([key, label, max]) => <Field key={key} label={label} type={key === "phone" ? "tel" : "text"} maxLength={max} value={value[key]} onChange={(e) => { setValue({ ...value, [key]: e.target.value }); save.reset(); }} />)}{save.isError && <Notice error>{save.error.message}</Notice>}{save.isSuccess && <Notice>Профиль сохранён</Notice>}<Button label="Сохранить профиль" type="submit" isLoading={save.isPending} /></VStack></form>;
}

export function InstallPage() {
  const { tenant } = useTenant();
  return <VStack gap={5} maxWidth={640} paddingBlock={6} className="mx-auto"><Smartphone className="size-10 text-accent" aria-hidden /><Heading level={1}>Студия на главном экране</Heading><Text color="secondary">Откройте главную страницу {tenant.name} в браузере телефона.</Text><Card padding={6}><VStack gap={3}><Heading level={2}>iPhone · Safari</Heading><Text>Нажмите «Поделиться», затем «На экран Домой» и «Добавить».</Text></VStack></Card><Card padding={6}><VStack gap={3}><Heading level={2}>Android · Chrome</Heading><Text>Откройте меню браузера ⋮ и выберите «Добавить на главный экран» или «Установить приложение».</Text></VStack></Card><Button variant="secondary" label="На главную" href={`/s/${tenant.slug}`} /></VStack>;
}
