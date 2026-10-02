import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useTenant } from "@/features/tenant/context";
import { getAvailability, createBooking } from "@/features/booking/api";
import { bookingSchema, type BookingForm } from "@/features/booking/schema";
import { createIdempotencyKey, durationLabel, money } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const steps = ["Услуга", "Автомобиль", "Дата и время", "Подтверждение"];
const initial = { customerName: "", customerPhone: "", customerEmail: "", vehicleBrand: "", vehicleModel: "", licensePlate: "" };

export function BookingFlow() {
  const { tenant, services, settings } = useTenant();
  const [params] = useSearchParams(); const navigate = useNavigate();
  const preselected = services.some((s) => s.id === params.get("service")) ? params.get("service")! : "";
  const [step, setStep] = useState(preselected ? 1 : 0);
  const [serviceId, setServiceId] = useState(preselected);
  const [date, setDate] = useState(""); const [slot, setSlot] = useState<{ starts_at: string; resource_id: string } | null>(null);
  const [form, setForm] = useState(initial); const [errors, setErrors] = useState<Record<string, string>>({});
  const [today] = useState(() => new Date());
  const service = services.find((item) => item.id === serviceId);
  const availability = useQuery({ queryKey: ["availability", tenant.slug, serviceId, date], queryFn: () => getAvailability(tenant.slug, serviceId, date), enabled: Boolean(serviceId && date) });
  const [idempotencyKey] = useState(() => createIdempotencyKey());
  const mutation = useMutation({ mutationFn: (values: BookingForm) => createBooking(tenant.slug, values, idempotencyKey), onSuccess: ({ token }) => navigate(`/s/${tenant.slug}/booking/${token}`) });
  const maxDate = new Date(today.getTime() + settings.maximum_booking_days * 86400000).toISOString().slice(0, 10);
  const minDate = today.toISOString().slice(0, 10);

  function nextFromVehicle() {
    const result = bookingSchema.pick({ customerName: true, customerPhone: true, customerEmail: true, vehicleBrand: true, vehicleModel: true, licensePlate: true }).safeParse(form);
    if (!result.success) { setErrors(Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return; }
    setErrors({}); setStep(2);
  }
  function submit() {
    if (!slot || !service) return;
    const result = bookingSchema.safeParse({ ...form, serviceId, resourceId: slot.resource_id, startsAt: slot.starts_at });
    if (!result.success) return;
    mutation.mutate(result.data);
  }
  return <main className="mx-auto min-h-screen max-w-3xl px-4 pb-28 pt-24">
    <button onClick={() => step ? setStep(step - 1) : navigate(-1)} className="mb-8 flex min-h-11 items-center gap-2 text-sm text-white/65 hover:text-white"><ArrowLeft size={18} /> Назад</button>
    <div className="mb-8 flex gap-2" aria-label={`Шаг ${step + 1} из ${steps.length}`}>{steps.map((name, index) => <div key={name} className="flex-1"><div className={`h-1 ${index <= step ? "bg-[var(--accent)]" : "bg-white/10"}`} /><span className="mt-2 hidden text-xs text-white/45 sm:block">{name}</span></div>)}</div>
    <p className="text-sm font-medium text-[var(--accent)]">Шаг {step + 1} из {steps.length}</p><h1 className="mt-2 text-3xl font-bold">{steps[step]}</h1>
    <div className="mt-8">
      {step === 0 && <div className="grid gap-3">{services.map((item) => <button key={item.id} onClick={() => { setServiceId(item.id); setStep(1); }} className="flex min-h-24 items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5 text-left hover:border-[var(--accent)]"><div><strong>{item.name}</strong><p className="mt-1 text-sm text-white/50">{durationLabel(item.duration_minutes)}</p></div><span className="shrink-0 font-semibold">{money(item.price, item.currency)}</span></button>)}</div>}
      {step === 1 && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Марка" name="vehicleBrand" value={form.vehicleBrand} error={errors.vehicleBrand} set={setForm} /><Field label="Модель" name="vehicleModel" value={form.vehicleModel} error={errors.vehicleModel} set={setForm} /><Field label="Госномер (необязательно)" name="licensePlate" value={form.licensePlate} error={errors.licensePlate} set={setForm} /></div><div className="border-t border-white/10 pt-6"><h2 className="mb-4 font-semibold">Контактные данные</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="Имя" name="customerName" value={form.customerName} error={errors.customerName} set={setForm} /><Field label="Телефон" name="customerPhone" type="tel" value={form.customerPhone} error={errors.customerPhone} set={setForm} /><Field label="Email (необязательно)" name="customerEmail" type="email" value={form.customerEmail} error={errors.customerEmail} set={setForm} /></div></div><Button onClick={nextFromVehicle} className="w-full sm:w-auto">Продолжить <ArrowRight size={18} /></Button></div>}
      {step === 2 && <div><label className="mb-2 block text-sm font-medium" htmlFor="date">Дата</label><Input id="date" type="date" min={minDate} max={maxDate} value={date} onChange={(e) => { setDate(e.target.value); setSlot(null); }} /><div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">{availability.isFetching && <p className="col-span-full flex items-center gap-2 text-white/60"><Loader2 className="animate-spin" size={18} /> Ищем время...</p>}{availability.isError && <p className="col-span-full text-red-400">Не удалось загрузить время.</p>}{availability.data?.length === 0 && <p className="col-span-full py-6 text-white/55">На эту дату свободного времени нет.</p>}{availability.data?.map((item) => <button key={`${item.resource_id}-${item.starts_at}`} onClick={() => setSlot(item)} className={`min-h-12 rounded-md border text-sm font-semibold ${slot?.starts_at === item.starts_at && slot.resource_id === item.resource_id ? "border-[var(--accent)] bg-[var(--accent)] text-black" : "border-white/15 bg-white/5 hover:border-white/40"}`}>{new Intl.DateTimeFormat("ru-RU", { timeZone: tenant.timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(item.starts_at))}</button>)}</div>{slot && <Button className="mt-8 w-full sm:w-auto" onClick={() => setStep(3)}>Продолжить <ArrowRight size={18} /></Button>}</div>}
      {step === 3 && service && slot && <div><Card className="divide-y divide-white/10 p-2"><Summary label="Услуга" value={service.name} /><Summary label="Автомобиль" value={`${form.vehicleBrand} ${form.vehicleModel}${form.licensePlate ? ` · ${form.licensePlate}` : ""}`} /><Summary label="Дата и время" value={new Intl.DateTimeFormat("ru-RU", { timeZone: tenant.timezone, dateStyle: "long", timeStyle: "short" }).format(new Date(slot.starts_at))} /><Summary label="Длительность" value={durationLabel(service.duration_minutes)} /><Summary label="Стоимость" value={money(service.price, service.currency)} /><Summary label="Адрес" value={tenant.address ?? "Уточняется"} /></Card>{mutation.isError && <p className="mt-4 rounded-md bg-red-500/10 p-4 text-sm text-red-300">{mutation.error.message}</p>}<Button onClick={submit} disabled={mutation.isPending} className="mt-6 w-full">{mutation.isPending ? <><Loader2 className="animate-spin" size={18} /> Создаём запись...</> : <><Check size={18} /> Подтвердить запись</>}</Button><p className="mt-3 text-center text-xs text-white/40">Нажимая кнопку, вы подтверждаете корректность данных.</p></div>}
    </div>
  </main>;
}

function Field({ label, name, value, type = "text", error, set }: { label: string; name: keyof typeof initial; value: string; type?: string; error?: string; set: React.Dispatch<React.SetStateAction<typeof initial>> }) { return <label className="block text-sm"><span className="mb-2 block font-medium">{label}</span><Input type={type} value={value} onChange={(e) => set((prev) => ({ ...prev, [name]: e.target.value }))} aria-invalid={Boolean(error)} />{error && <span className="mt-1 block text-xs text-red-400">{error}</span>}</label>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-5 px-3 py-4 text-sm"><span className="text-white/50">{label}</span><strong className="text-right font-medium">{value}</strong></div>; }
