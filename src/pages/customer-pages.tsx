import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Heading, HStack, Text, Token, VStack } from "@astryxdesign/core";
import { CalendarCheck2, Smartphone } from "lucide-react";
import { getBooking } from "@/features/booking/api";
import { savedBookings, statusLabels } from "@/features/booking/local-bookings";
import { useTenant } from "@/features/tenant/context";
import { dateTime } from "@/lib/utils";
import { Loading, Notice, Retry } from "@/components/studio-ui";

export function CustomerBookings() {
  const { tenant } = useTenant(); const tokens = savedBookings(tenant.slug);
  const query = useQuery({ queryKey: ["saved-bookings", tenant.slug, tokens], queryFn: async () => Promise.all(tokens.map(async (token) => ({ token, booking: await getBooking(token) }))) });
  return <VStack gap={5} maxWidth={720} width="100%" paddingBlock={5} className="mx-auto"><Heading level={1}>Моя запись</Heading><Text color="secondary">Записи, сохранённые на этом устройстве. На другом устройстве откройте ссылку, полученную после подтверждения.</Text>
    {query.isPending ? <Loading /> : query.isError ? <><Notice error>Не удалось загрузить записи.</Notice><Retry onClick={() => query.refetch()} /></> : !query.data.length ? <Card padding={8}><VStack gap={4} align="center"><CalendarCheck2 className="size-10 text-accent" /><Heading level={2}>Пока нет записей</Heading><Text color="secondary" justify="center">Выберите услугу — свободное время уже в расписании.</Text><Button label="Записаться" href={`/s/${tenant.slug}/book`} /></VStack></Card> : <VStack gap={0} className="rounded-xl border border-border overflow-hidden">{query.data.filter(({ booking }) => booking.tenant_slug === tenant.slug).map(({ token, booking }) => <Link key={token} to={`/s/${tenant.slug}/booking/${token}`} className="border-b border-border bg-surface last:border-0 hover:bg-muted"><HStack padding={5} gap={4} align="center" justify="between"><VStack gap={2}><Text weight="semibold">{booking.service_name}</Text><Text color="secondary" size="sm">{dateTime(booking.starts_at, tenant.timezone)}</Text></VStack><Token label={statusLabels[booking.status]} color={booking.status === "cancelled" ? "gray" : "green"} /></HStack></Link>)}</VStack>}
  </VStack>;
}
export function InstallPage() {
  const { tenant } = useTenant();
  return <VStack gap={5} maxWidth={640} paddingBlock={6} className="mx-auto"><Smartphone className="size-10 text-accent" /><Heading level={1}>Студия на главном экране</Heading><Text color="secondary">Откройте главную страницу {tenant.name} в браузере телефона.</Text><Card padding={6}><VStack gap={3}><Heading level={2}>iPhone · Safari</Heading><Text>Нажмите «Поделиться», затем «На экран Домой» и «Добавить».</Text></VStack></Card><Card padding={6}><VStack gap={3}><Heading level={2}>Android · Chrome</Heading><Text>Откройте меню браузера ⋮ и выберите «Добавить на главный экран» или «Установить приложение».</Text></VStack></Card><Button label="На главную" href={`/s/${tenant.slug}`} variant="secondary" /></VStack>;
}
