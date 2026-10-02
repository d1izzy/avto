import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import { cancelBooking, getBooking } from "@/features/booking/api";
import { downloadIcs } from "@/features/booking/ics";
import { useTenant } from "@/features/tenant/context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dateTime, money } from "@/lib/utils";

export function BookingDetail() {
  const { token = "" } = useParams(); const { tenant } = useTenant(); const client = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const query = useQuery({ queryKey: ["booking", token], queryFn: () => getBooking(token), retry: false });
  const cancel = useMutation({ mutationFn: () => cancelBooking(token), onSuccess: () => { setConfirmCancel(false); client.invalidateQueries({ queryKey: ["booking", token] }); } });
  if (query.isPending) return <main className="grid min-h-screen place-items-center"><Loader2 className="animate-spin" /></main>;
  if (query.isError || !query.data) return <main className="grid min-h-screen place-items-center px-4 text-center"><div><XCircle className="mx-auto text-red-400" size={42} /><h1 className="mt-4 text-2xl font-bold">Запись не найдена</h1><p className="mt-2 text-white/55">Ссылка недействительна или запись больше недоступна.</p></div></main>;
  const booking = query.data; const cancelled = booking.status === "cancelled";
  return <main className="mx-auto min-h-screen max-w-2xl px-4 pb-20 pt-28">
    <div className="text-center">{cancelled ? <XCircle className="mx-auto text-red-400" size={48} /> : <CheckCircle2 className="mx-auto text-[var(--accent)]" size={48} />}<p className="mt-5 text-sm font-semibold uppercase text-[var(--accent)]">{cancelled ? "Запись отменена" : "Запись подтверждена"}</p><h1 className="mt-2 text-3xl font-bold">{booking.service_name}</h1><p className="mt-2 text-white/55">Ссылка на эту страницу нужна для управления записью.</p></div>
    <Card className="mt-8 divide-y divide-white/10 p-2"><Row label="Дата" value={dateTime(booking.starts_at, tenant.timezone)} /><Row label="Сервис" value={booking.tenant_name} /><Row label="Ресурс" value={booking.resource_name} /><Row label="Адрес" value={booking.address ?? "Уточняется"} /><Row label="Стоимость" value={money(booking.price, booking.currency)} /></Card>
    {!cancelled && <div className="mt-5 grid gap-3 sm:grid-cols-2"><Button variant="secondary" onClick={() => downloadIcs(booking)}><Download size={18} /> Добавить в календарь</Button>{booking.can_reschedule && <Button variant="outline" disabled title="Выбор нового времени откроется после настройки"><CalendarPlus size={18} /> Перенести</Button>}</div>}
    {booking.can_cancel && !cancelled && <div className="mt-8 border-t border-white/10 pt-6">{confirmCancel ? <Card className="p-5"><p className="font-medium">Отменить запись?</p><p className="mt-1 text-sm text-white/55">Это действие освободит выбранное время.</p>{cancel.isError && <p className="mt-3 text-sm text-red-400">{cancel.error.message}</p>}<div className="mt-4 flex gap-2"><Button variant="destructive" onClick={() => cancel.mutate()} disabled={cancel.isPending}>{cancel.isPending && <Loader2 className="animate-spin" size={16} />} Отменить запись</Button><Button variant="ghost" onClick={() => setConfirmCancel(false)}>Назад</Button></div></Card> : <Button variant="ghost" className="w-full text-red-300" onClick={() => setConfirmCancel(true)}>Отменить запись</Button>}</div>}
  </main>;
}
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4 px-3 py-4 text-sm"><span className="text-white/45">{label}</span><strong className="text-right font-medium">{value}</strong></div>; }
