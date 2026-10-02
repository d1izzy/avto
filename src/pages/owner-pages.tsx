import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Loader2, Plus, XCircle } from "lucide-react";
import { ownerBookings, ownerCatalog, saveResource, saveService, updateBookingStatus } from "@/features/owner/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dateTime, money } from "@/lib/utils";
import { useTenant } from "@/features/tenant/context";
import type { Resource, Service } from "@/types/database";

function useOwnerBookings() { const { tenantSlug = "" } = useParams(); return useQuery({ queryKey: ["owner-bookings", tenantSlug], queryFn: () => ownerBookings(tenantSlug) }); }

export function OwnerDashboard() {
  const { tenant } = useTenant(); const query = useOwnerBookings(); const bookings = query.data ?? []; const today = new Intl.DateTimeFormat("en-CA", { timeZone: tenant.timezone }).format(new Date());
  const todayRows = bookings.filter((b) => new Intl.DateTimeFormat("en-CA", { timeZone: tenant.timezone }).format(new Date(b.starts_at)) === today);
  const upcoming = bookings.filter((b) => new Date(b.starts_at) > new Date() && b.status !== "cancelled").slice(0, 5);
  return <><PageTitle title="Обзор" subtitle="Текущее состояние сервиса" /><div className="grid gap-3 sm:grid-cols-3"><Metric icon={<CalendarDays />} label="Записей сегодня" value={todayRows.length} /><Metric icon={<CheckCircle2 />} label="Всего записей" value={bookings.length} /><Metric icon={<XCircle />} label="Отмен" value={bookings.filter((b) => b.status === "cancelled").length} /></div><h2 className="mb-3 mt-9 text-lg font-semibold">Ближайшие записи</h2><BookingList rows={upcoming} loading={query.isPending} /></>;
}

export function OwnerBookings() { const query = useOwnerBookings(); return <><PageTitle title="Записи" subtitle="Все записи текущего бизнеса" /><BookingList rows={query.data ?? []} loading={query.isPending} editable /></>; }
export function OwnerCalendar() { const { tenant } = useTenant(); const query = useOwnerBookings(); const groups = (query.data ?? []).reduce<Record<string, Awaited<ReturnType<typeof ownerBookings>>>>((acc, booking) => { const date = new Intl.DateTimeFormat("ru-RU", { timeZone: tenant.timezone, dateStyle: "long" }).format(new Date(booking.starts_at)); (acc[date] ??= []).push(booking); return acc; }, {}); return <><PageTitle title="Календарь" subtitle="Записи по дням" />{Object.entries(groups).map(([date, rows]) => <section key={date} className="mb-8"><h2 className="mb-3 font-semibold capitalize">{date}</h2><BookingList rows={rows} loading={false} editable /></section>)}</>; }

function BookingList({ rows, loading, editable = false }: { rows: Awaited<ReturnType<typeof ownerBookings>>; loading: boolean; editable?: boolean }) {
  const { tenant } = useTenant(); const client = useQueryClient(); const change = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => updateBookingStatus(id, status), onSuccess: () => client.invalidateQueries({ queryKey: ["owner-bookings"] }) });
  if (loading) return <p className="flex items-center gap-2 text-white/50"><Loader2 className="animate-spin" size={18} /> Загружаем записи...</p>;
  if (!rows.length) return <Card className="p-8 text-center text-white/45">Записей пока нет.</Card>;
  return <div className="space-y-2">{rows.map((booking) => <Card key={booking.id} className="grid gap-3 p-4 sm:grid-cols-[180px_1fr_auto] sm:items-center"><div><p className="text-sm font-semibold">{dateTime(booking.starts_at, tenant.timezone)}</p><p className="mt-1 text-xs text-white/40">{booking.resource_name}</p></div><div><p className="font-medium">{booking.service_name}</p><p className="mt-1 text-sm text-white/50">{booking.customer_name} · {booking.customer_phone}</p></div><div className="flex items-center gap-2"><span className="rounded bg-white/10 px-2 py-1 text-xs">{booking.status}</span>{editable && booking.status === "confirmed" && <Button size="sm" variant="secondary" onClick={() => change.mutate({ id: booking.id, status: "completed" })}>Завершить</Button>}</div></Card>)}</div>;
}

export function OwnerServices() { return <CatalogManager kind="services" />; }
export function OwnerResources() { return <CatalogManager kind="resources" />; }

function CatalogManager({ kind }: { kind: "services" | "resources" }) {
  const { tenantSlug = "" } = useParams(); const { tenant } = useTenant(); const client = useQueryClient(); const [editing, setEditing] = useState(false); const [name, setName] = useState(""); const [type, setType] = useState(""); const [price, setPrice] = useState(""); const [duration, setDuration] = useState("60");
  const query = useQuery({ queryKey: ["owner-catalog", tenantSlug], queryFn: () => ownerCatalog(tenantSlug) });
  const mutation = useMutation({ mutationFn: () => kind === "services" ? saveService(tenantSlug, { name, price: Number(price), duration_minutes: Number(duration), currency: tenant.currency, active: true } as Partial<Service>) : saveResource(tenantSlug, { name, type, active: true, capacity: 1 } as Partial<Resource>), onSuccess: () => { setEditing(false); setName(""); client.invalidateQueries({ queryKey: ["owner-catalog"] }); } });
  const items = query.data?.[kind] ?? [];
  return <><PageTitle title={kind === "services" ? "Услуги" : "Ресурсы"} subtitle={kind === "services" ? "Каталог, цены и длительность" : "Посты, боксы и оборудование"} action={<Button onClick={() => setEditing(true)}><Plus size={18} /> Добавить</Button>} />{editing && <Card className="mb-6 grid gap-4 p-5 sm:grid-cols-2"><label className="text-sm"><span className="mb-2 block">Название</span><Input value={name} onChange={(e) => setName(e.target.value)} /></label>{kind === "services" ? <><label className="text-sm"><span className="mb-2 block">Цена</span><Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} /></label><label className="text-sm"><span className="mb-2 block">Длительность, мин</span><Input type="number" min="15" step="15" value={duration} onChange={(e) => setDuration(e.target.value)} /></label></> : <label className="text-sm"><span className="mb-2 block">Тип</span><Input value={type} onChange={(e) => setType(e.target.value)} /></label>}<div className="flex items-end gap-2"><Button disabled={!name || mutation.isPending} onClick={() => mutation.mutate()}>Сохранить</Button><Button variant="ghost" onClick={() => setEditing(false)}>Отмена</Button></div></Card>}<div className="grid gap-3 md:grid-cols-2">{items.map((item) => <Card key={item.id} className="p-5"><div className="flex justify-between gap-3"><div><h2 className="font-semibold">{item.name}</h2><p className="mt-1 text-sm text-white/45">{"duration_minutes" in item ? `${item.duration_minutes} мин` : item.type}</p></div>{"price" in item && <strong>{money(item.price, item.currency)}</strong>}</div></Card>)}</div></>;
}

export function OwnerCustomers() { const query = useOwnerBookings(); const customers = Array.from(new Map((query.data ?? []).map((b) => [b.customer_phone, b])).values()); return <><PageTitle title="Клиенты" subtitle="Клиенты из истории записей" /><div className="grid gap-3 md:grid-cols-2">{customers.map((c) => <Card key={c.customer_phone} className="p-5"><strong>{c.customer_name}</strong><p className="mt-2 text-sm text-white/50">{c.customer_phone}</p><p className="text-sm text-white/50">{c.customer_email}</p></Card>)}</div></>; }
export function OwnerSettings() { const { tenant, settings, hours } = useTenant(); return <><PageTitle title="Настройки" subtitle="Параметры бизнеса и бронирования" /><Card className="divide-y divide-white/10 p-2"><Setting label="Бизнес" value={tenant.name} /><Setting label="Часовой пояс" value={tenant.timezone} /><Setting label="Валюта" value={tenant.currency} /><Setting label="Горизонт записи" value={`${settings.maximum_booking_days} дней`} /><Setting label="Минимальное уведомление" value={`${settings.minimum_booking_notice_minutes} мин`} /><Setting label="Рабочих интервалов" value={String(hours.filter((h) => h.active).length)} /><Setting label="Уведомления" value="Не настроены" /></Card><p className="mt-4 text-sm text-white/40">Email, SMS и push не отправляются без настроенного внешнего провайдера.</p></>; }

function PageTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) { return <div className="mb-7 flex items-end justify-between gap-4"><div><h1 className="text-2xl font-bold sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-white/45">{subtitle}</p></div>{action}</div>; }
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <Card className="p-5"><span className="text-[var(--accent)]">{icon}</span><p className="mt-5 text-3xl font-bold">{value}</p><p className="mt-1 text-sm text-white/45">{label}</p></Card>; }
function Setting({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4 px-3 py-4 text-sm"><span className="text-white/45">{label}</span><strong className="text-right font-medium">{value}</strong></div>; }
