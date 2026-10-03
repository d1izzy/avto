import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Heading, HStack, Text, Token, VStack } from "@astryxdesign/core";
import { CalendarCheck2, Smartphone, UserRound } from "lucide-react";
import { getBooking } from "@/features/booking/api";
import { savedBookings, statusLabels } from "@/features/booking/local-bookings";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/features/tenant/context";
import { dateTime } from "@/lib/utils";
import { Field, Loading, Notice, Retry } from "@/components/studio-ui";
import { accountBookings, getProfile, saveProfile, useSession } from "@/features/auth/customer";
import type { CustomerProfile } from "@/types/database";

export function CustomerBookings({ profile = true }: { profile?: boolean }) {
  const { tenant } = useTenant();
  const emailLoginEnabled = import.meta.env.VITE_CUSTOMER_EMAIL_LOGIN_ENABLED === "true";
  const session = useSession(); const client = useQueryClient();
  const [email, setEmail] = useState("");
  const tokens = savedBookings(tenant.slug);
  const query = useQuery({ queryKey: ["saved-bookings", tenant.slug, tokens, session?.user.id], enabled: session !== undefined, queryFn: async () => {
    if (session) return accountBookings(tenant.slug);
    const results = await Promise.allSettled(tokens.map(async (token) => ({ token, booking: await getBooking(token) })));
    return { bookings: results.flatMap((r) => r.status === "fulfilled" ? [r.value] : []), syncFailed: results.some((r) => r.status === "rejected") };
  } });
  const profileQuery = useQuery({ queryKey: ["customer-profile", session?.user.id], enabled: !!session, queryFn: () => getProfile(session!.user.id) });
  const link = useMutation({ mutationFn: async () => {
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/s/${tenant.slug}/account` } });
    if (error) throw new Error("Не удалось отправить письмо. Вход по почте временно недоступен. Вы можете записаться без входа.");
  } });
  const logout = useMutation({ mutationFn: async () => { const { error } = await supabase.auth.signOut(); if (error) throw new Error("Не удалось выйти. Попробуйте снова."); client.clear(); } });
  const bookings = query.data?.bookings.filter(({ booking }) => booking?.tenant_slug === tenant.slug) ?? [];
  const callbackError = new URLSearchParams(window.location.hash.slice(1)).has("error");
  return <VStack gap={6} maxWidth={720} width="100%" paddingBlock={6} className="mx-auto">
    <Link to={`/s/${tenant.slug}`} className="text-sm text-secondary">← На главную</Link>
    {profile && <Card padding={6}><VStack gap={5}><UserRound className="size-9 text-accent" aria-hidden /><Heading level={1}>Профиль клиента</Heading>{session === undefined ? <Loading /> : session ? <><Text color="secondary">{session.user.email}</Text>{profileQuery.isPending ? <Loading /> : profileQuery.isError ? <Notice error>Не удалось загрузить профиль.</Notice> : <ProfileEditor key={session.user.id} userId={session.user.id} initial={profileQuery.data ?? null} />}<Button label="Выйти из профиля" variant="ghost" isLoading={logout.isPending} onClick={() => logout.mutate()} />{logout.isError && <Notice error>{logout.error.message}</Notice>}</> : <><Text color="secondary">Сохраняйте новые записи в одном месте и открывайте их с любого устройства.</Text>{callbackError && <Notice error>Ссылка для входа недействительна или устарела. Запросите новую.</Notice>}<form onSubmit={(e) => { e.preventDefault(); if (emailLoginEnabled && !link.isPending) link.mutate(); }}><VStack gap={4}><Field label="Почта" type="email" required value={email} onChange={(e) => { setEmail(e.target.value); link.reset(); }} autoComplete="email" /><Text size="sm" color="secondary">{emailLoginEnabled ? "Пароль не нужен. Отправим ссылку для входа." : "Вход по почте пока недоступен. Записаться можно без регистрации."}</Text>{link.isError && <Notice error>{link.error.message}</Notice>}{link.isSuccess && <Notice>Ссылка отправлена. Проверьте почту.</Notice>}<Button variant="primary" label="Получить ссылку" type="submit" isLoading={link.isPending} isDisabled={!emailLoginEnabled || !email.trim() || link.isPending} /></VStack></form></>}<Text size="sm" color="secondary">Вы владелец студии? <Link to={`/s/${tenant.slug}/owner`} className="text-accent underline">Открыть кабинет студии</Link></Text></VStack></Card>}
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
