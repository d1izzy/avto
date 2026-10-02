import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Heading, HStack, Text, Token, VStack } from "@astryxdesign/core";
import { CheckCircle2, Download, Phone, XCircle } from "lucide-react";
import { cancelBooking, getBooking } from "@/features/booking/api";
import { rememberBooking, statusLabels } from "@/features/booking/local-bookings";
import { downloadIcs } from "@/features/booking/ics";
import { useTenant } from "@/features/tenant/context";
import { DetailRow, Loading, Notice, Retry } from "@/components/studio-ui";
import { dateTime, money } from "@/lib/utils";

export function BookingDetail() {
  const { token = "" } = useParams(); const { tenant } = useTenant(); const client = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const query = useQuery({ queryKey: ["booking", token], queryFn: () => getBooking(token), retry: false });
  useEffect(() => { if (query.data?.tenant_slug === tenant.slug) rememberBooking(tenant.slug, token); }, [query.data, tenant.slug, token]);
  const cancel = useMutation({ mutationFn: () => cancelBooking(token), onSuccess: () => { setConfirmCancel(false); client.invalidateQueries({ queryKey: ["booking", token] }); client.invalidateQueries({ queryKey: ["saved-bookings"] }); } });
  if (query.isPending) return <Loading />;
  if (query.isError || !query.data || query.data.tenant_slug !== tenant.slug) return <VStack gap={4} padding={8} align="center"><Heading level={1}>Запись не найдена</Heading><Text color="secondary">Проверьте ссылку на запись или попробуйте снова.</Text><Retry onClick={() => query.refetch()} /></VStack>;
  const booking = query.data; const cancelled = booking.status === "cancelled";
  return <VStack gap={6} maxWidth={640} width="100%" paddingBlock={6} className="mx-auto">
    <VStack gap={3} align="center" className="text-center">{cancelled ? <XCircle className="size-12 text-error" /> : <CheckCircle2 className="size-12 text-accent" />}<Text weight="semibold" color="accent">{cancelled ? "Запись отменена" : booking.status === "confirmed" ? "Запись подтверждена" : statusLabels[booking.status]}</Text><Heading level={1}>{booking.service_name}</Heading><Text color="secondary">Сохраните эту ссылку. Она нужна для управления записью.</Text></VStack>
    <Card padding={5}><DetailRow label="Дата">{dateTime(booking.starts_at, tenant.timezone)}</DetailRow><DetailRow label="Сервис">{booking.tenant_name}</DetailRow><DetailRow label="Бокс">{booking.resource_name}</DetailRow><DetailRow label="Адрес">{booking.address ?? "Уточняется"}</DetailRow><DetailRow label="Стоимость">{money(booking.price, booking.currency)}</DetailRow><DetailRow label="Статус"><Token label={statusLabels[booking.status]} color={cancelled ? "gray" : "green"} /></DetailRow></Card>
    {!cancelled && <Button label="Добавить в календарь" variant="secondary" onClick={() => downloadIcs(booking)} icon={<Download />} />}
    {booking.can_cancel && !cancelled && <VStack gap={3}>{confirmCancel ? <Card padding={5}><VStack gap={4}><Heading level={3}>Отменить запись?</Heading><Text color="secondary">Выбранное время снова станет доступно другим клиентам.</Text>{cancel.isError && <Notice error>{cancel.error.message}</Notice>}<HStack gap={2} wrap="wrap"><Button label="Отменить запись" variant="destructive" onClick={() => cancel.mutate()} isLoading={cancel.isPending} /><Button label="Назад" variant="ghost" onClick={() => setConfirmCancel(false)} /></HStack></VStack></Card> : <Button label="Отменить запись" variant="ghost" onClick={() => setConfirmCancel(true)} />}</VStack>}
    {!cancelled && tenant.phone && <VStack gap={3}><Text color="secondary" size="sm">Если нужно перенести время или уточнить детали, свяжитесь со студией.</Text><Button variant="secondary" label="Позвонить в студию" href={`tel:${tenant.phone}`} icon={<Phone />} /></VStack>}
    <Link to={`/s/${tenant.slug}/account`} className="text-center text-accent">Мои записи →</Link>
  </VStack>;
}
