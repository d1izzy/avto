import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Card, Dialog, DialogHeader, Grid, HStack, Text, VStack } from "@astryxdesign/core";
import { ArrowLeft, ArrowUpRight, Check } from "lucide-react";
import { useTenant } from "@/features/tenant/context";
import { getAvailability, createBooking } from "@/features/booking/api";
import { bookingSchema, type BookingForm } from "@/features/booking/schema";
import { createIdempotencyKey, durationLabel, money, dateTime } from "@/lib/utils";
import { DetailRow, Field, Loading, Notice, Retry } from "@/components/studio-ui";
import { useKeyboardViewport } from "@/lib/use-keyboard-viewport";
import { claimBooking, getProfile, useSession } from "@/features/auth/customer";
import { localDate, rememberBooking } from "@/features/booking/local-bookings";
import type { AvailabilitySlot } from "@/types/database";

const steps = ["Выберите услугу", "Дата и время", "Ваш автомобиль", "Проверьте запись"];
const initial = { customerName: "", customerPhone: "", customerEmail: "", vehicleBrand: "", vehicleModel: "", licensePlate: "" };

export function BookingFlow() {
  const { tenant, services, settings } = useTenant();
  const session = useSession(); const keyboardHeight = useKeyboardViewport();
  const profile = useQuery({ queryKey: ["customer-profile", session?.user.id], enabled: !!session, queryFn: () => getProfile(session!.user.id) });
  const [params] = useSearchParams(); const navigate = useNavigate();
  const preselected = services.some((s) => s.id === params.get("service")) ? params.get("service")! : "";
  const [step, setStep] = useState(preselected ? 1 : 0);
  const [serviceId, setServiceId] = useState(preselected);
  const [today] = useState(() => new Date());
  const minDate = localDate(today, tenant.timezone);
  const maxDate = localDate(new Date(today.getTime() + settings.maximum_booking_days * 86400000), tenant.timezone);
  const [date, setDate] = useState(minDate); const [slot, setSlot] = useState<AvailabilitySlot | null>(null);
  const [form, setForm] = useState(initial); const [errors, setErrors] = useState<Record<string, string>>({});
  const errorRef = useRef<HTMLElement>(null);
  const service = services.find((item) => item.id === serviceId);
  const availability = useQuery({ queryKey: ["availability", tenant.slug, serviceId, date], queryFn: () => getAvailability(tenant.slug, serviceId, date), enabled: Boolean(serviceId && date >= minDate && date <= maxDate), staleTime: 0 });
  const [idempotencyKey] = useState(() => createIdempotencyKey());
  const mutation = useMutation({ mutationFn: (values: BookingForm) => createBooking(tenant.slug, values, idempotencyKey), onSuccess: ({ token }) => { rememberBooking(tenant.slug, token); if (session) void claimBooking(token).catch(() => { /* Retried from the profile; a saved booking must still show success. */ }); navigate(`/s/${tenant.slug}/booking/${token}`, { replace: true }); } });
  const close = () => { if (!mutation.isPending) navigate(`/s/${tenant.slug}`); };
  const days = Array.from({ length: 7 }, (_, i) => localDate(new Date(today.getTime() + i * 86400000), tenant.timezone)).filter((d) => d <= maxDate);
  // A customer chooses a time. The first available box at that time is assigned automatically.
  const slots = (availability.data ?? []).filter((s, index, all) => all.findIndex((other) => other.starts_at === s.starts_at) === index);

  function vehicleNext() {
    const result = bookingSchema.pick({ customerName: true, customerPhone: true, customerEmail: true, vehicleBrand: true, vehicleModel: true, licensePlate: true }).safeParse(form);
    if (!result.success) { setErrors(Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]))); requestAnimationFrame(() => errorRef.current?.focus()); return; }
    setErrors({}); setStep(3);
  }
  function submit() {
    if (mutation.isPending || !slot || !service) return;
    const result = bookingSchema.safeParse({ ...form, serviceId, resourceId: slot.resource_id, startsAt: slot.starts_at });
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message])));
      setStep(result.error.issues.some((i) => ["serviceId", "resourceId", "startsAt"].includes(String(i.path[0]))) ? 1 : 2); return;
    }
    mutation.mutate(result.data);
  }
  function chooseDate(next: string) { setDate(next); setSlot(null); mutation.reset(); }
  return <Dialog isOpen onOpenChange={close} width={560} maxHeight={keyboardHeight?.height ?? "var(--studio-dialog-height)"} position={keyboardHeight ? { top: keyboardHeight.top, start: "var(--spacing-4)", end: "var(--spacing-4)" } : undefined} purpose={mutation.isPending ? "required" : "form"} padding={5} aria-label="Онлайн-запись">
    <VStack gap={4} height={keyboardHeight?.height ?? "var(--studio-form-height)"} className="min-h-0">
      <DialogHeader title={steps[step]} subtitle={`Шаг ${step + 1} из 4 · ${tenant.name}`} onOpenChange={mutation.isPending ? undefined : close} />
      <VStack key={step} gap={5} isScrollable data-testid="booking-scroll" className="min-h-0 flex-1 overscroll-contain pr-1 [&>*]:shrink-0">
      <HStack gap={2} aria-label={`Шаг ${step + 1} из 4`}>{steps.map((s, i) => <VStack key={s} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent-bg" : "bg-muted"}`} />)}</HStack>
      {!settings.booking_enabled ? <Notice>Студия временно приостановила онлайн-запись. Свяжитесь с ней по телефону.</Notice> : <>
      {step > 0 && <Button label="Назад" variant="ghost" icon={<ArrowLeft />} onClick={() => setStep(step - 1)} isDisabled={mutation.isPending} />}
      {step === 0 && <VStack gap={0} className="overflow-hidden rounded-xl border border-border">{services.map((item) => <button key={item.id} onClick={() => { setServiceId(item.id); setSlot(null); setErrors({}); mutation.reset(); setStep(1); }} className="border-b border-border text-left last:border-0 hover:bg-muted"><HStack padding={4} gap={4} justify="between" align="center"><VStack gap={2}><Text weight="semibold">{item.name}</Text><Text color="secondary" size="sm">{durationLabel(item.duration_minutes)}</Text></VStack><Text weight="medium">{money(item.price, item.currency)}</Text><ArrowUpRight aria-hidden className="size-4 shrink-0 text-accent" /></HStack></button>)}</VStack>}
      {step === 1 && <VStack gap={4}>
        <Text color="secondary">{service?.name} · {service && durationLabel(service.duration_minutes)}</Text>
        <Grid columns={7} gap={1}>{days.map((d) => <button key={d} aria-pressed={d === date} onClick={() => chooseDate(d)} className={`min-h-16 rounded-lg border ${d === date ? "border-accent-bg bg-accent-muted text-accent" : "border-border bg-muted text-secondary"}`}><VStack gap={1} align="center"><Text size="sm" color="inherit">{new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`))}</Text><Text weight="bold" color="inherit">{d.slice(-2)}</Text></VStack></button>)}</Grid>
        <Field label="Другая дата" aria-label="Дата" type="date" min={minDate} max={maxDate} value={date} onChange={(e) => chooseDate(e.target.value)} />
        <Text size="sm" color="secondary">Свободное время · часовой пояс студии ({tenant.timezone})</Text>
        {availability.isFetching ? <Loading label="Ищем свободное время…" /> : availability.isError ? <><Notice error>Не удалось загрузить время.</Notice><Retry onClick={() => availability.refetch()} /></> : slots.length === 0 ? <Notice>На эту дату свободного времени нет. Выберите другой день.</Notice> : <Grid columns={4} gap={2}>{slots.map((item) => <Button key={item.starts_at} label={new Intl.DateTimeFormat("ru-RU", { timeZone: tenant.timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(item.starts_at))} variant={slot?.starts_at === item.starts_at ? "primary" : "secondary"} size="lg" aria-pressed={slot?.starts_at === item.starts_at} onClick={() => { setSlot(item); mutation.reset(); }} />)}</Grid>}
        {slot && <Text color="secondary" size="sm">Ориентир выдачи: {dateTime(slot.ends_at, tenant.timezone)}</Text>}
        <Button variant="primary" label="Продолжить" size="lg" isDisabled={!slot || availability.isFetching} onClick={() => { const saved = profile.data; if (saved) setForm((old) => ({ customerName: old.customerName || saved.name, customerPhone: old.customerPhone || saved.phone, customerEmail: old.customerEmail || session?.user.email || "", vehicleBrand: old.vehicleBrand || saved.vehicle_brand, vehicleModel: old.vehicleModel || saved.vehicle_model, licensePlate: old.licensePlate || saved.license_plate })); setStep(2); }} />
      </VStack>}
      {step === 2 && <form onSubmit={(e) => { e.preventDefault(); vehicleNext(); }} noValidate><VStack gap={4}>
        {!!Object.keys(errors).length && <VStack ref={errorRef} tabIndex={-1} gap={2}><Notice error>Проверьте отмеченные поля. Введённые данные сохранены.</Notice>{Object.entries(errors).map(([field, message]) => <a className="text-sm text-error underline" key={field} href={`#${field}`}>{message}</a>)}</VStack>}
        <Grid columns={1} gap={4} className="sm:grid-cols-2">{([
          ["customerName", "Имя", "text", "given-name"], ["customerPhone", "Телефон", "tel", "tel"],
          ["vehicleBrand", "Марка", "text", "off"], ["vehicleModel", "Модель", "text", "off"],
          ["licensePlate", "Госномер (необязательно)", "text", "off"], ["customerEmail", "Email (необязательно)", "email", "email"],
        ] as const).map(([key, label, type, autoComplete]) => <Field key={key} name={key} label={label} type={type} autoComplete={autoComplete} value={form[key]} error={errors[key]} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} />)}</Grid>
        <Button variant="primary" label="Проверить запись" type="submit" size="lg" />
      </VStack></form>}
      {step === 3 && service && slot && <VStack gap={4}>
        <Card padding={4}><DetailRow label="Услуга">{service.name}</DetailRow><DetailRow label="Дата и время">{dateTime(slot.starts_at, tenant.timezone)}</DetailRow><DetailRow label="Автомобиль">{form.vehicleBrand} {form.vehicleModel}</DetailRow><DetailRow label="Контакт">{form.customerName} · {form.customerPhone}</DetailRow><DetailRow label="Адрес">{tenant.address ?? "Уточняется"}</DetailRow><DetailRow label="Стоимость">{money(service.price, service.currency)}</DetailRow></Card>
        {mutation.isError && <><Notice error>{mutation.error.message || "Не удалось создать запись. Попробуйте снова."}</Notice><Button label="Выбрать другое время" variant="secondary" onClick={() => { setStep(1); setSlot(null); availability.refetch(); mutation.reset(); }} /></>}
        <Button variant="primary" label={mutation.isPending ? "Создаём запись…" : "Подтвердить запись"} onClick={submit} isLoading={mutation.isPending} isDisabled={mutation.isPending} size="lg" icon={<Check />} />
        <Text size="sm" color="secondary" justify="center">Нажимая кнопку, вы подтверждаете корректность данных.</Text>
      </VStack>}
      </>}
      </VStack>
    </VStack>
  </Dialog>;
}
