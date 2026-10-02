import { Link } from "react-router-dom";
import { ArrowRight, Clock3, MapPin, Phone, ShieldCheck } from "lucide-react";
import { useTenant } from "@/features/tenant/context";
import { Button } from "@/components/ui/button";
import { money, durationLabel } from "@/lib/utils";

export function TenantHome() {
  const { tenant, services, hours, assets } = useTenant();
  const hero = tenant.hero_url || assets.find((asset) => asset.type === "hero")?.public_url;
  return <main>
    <section className="relative flex min-h-[88svh] items-end overflow-hidden pt-16">
      {hero && <img src={hero} alt="" className="absolute inset-0 size-full object-cover" fetchPriority="high" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/20" />
      <div className="noise absolute inset-0" />
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-14 sm:pb-20">
        <div className="max-w-3xl">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase text-[var(--accent)]"><ShieldCheck size={17} /> Профессиональный сервис</p>
          <h1 className="text-4xl font-black leading-[1.03] sm:text-6xl lg:text-7xl">{tenant.name}</h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">{tenant.description}</p>
          <Button asChild className="mt-8 w-full sm:w-auto"><Link to={`/s/${tenant.slug}/book`}>Выбрать время <ArrowRight size={18} /></Link></Button>
        </div>
      </div>
    </section>

    <section className="border-y border-white/10 bg-[#111]">
      <div className="mx-auto grid max-w-6xl gap-px bg-white/10 sm:grid-cols-3">
        <Info icon={<MapPin />} label="Адрес" value={tenant.address ?? "Уточняется"} />
        <Info icon={<Phone />} label="Телефон" value={tenant.phone ?? "Уточняется"} href={tenant.phone ? `tel:${tenant.phone}` : undefined} />
        <Info icon={<Clock3 />} label="Сегодня" value={todayHours(hours)} />
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24" id="services">
      <div className="mb-8 flex items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase text-[var(--accent)]">Услуги</p><h2 className="mt-2 text-3xl font-bold sm:text-4xl">Выберите нужный уход</h2></div></div>
      <div className="divide-y divide-white/10 border-y border-white/10">
        {services.map((service, index) => <Link key={service.id} to={`/s/${tenant.slug}/book?service=${service.id}`} className="group grid gap-3 py-6 transition-colors hover:bg-white/[0.025] sm:grid-cols-[3rem_1fr_auto] sm:items-center sm:px-4">
          <span className="text-sm text-white/35">{String(index + 1).padStart(2, "0")}</span>
          <div><h3 className="text-lg font-semibold group-hover:text-[var(--accent)]">{service.name}</h3><p className="mt-1 max-w-xl text-sm text-white/55">{service.description}</p><p className="mt-2 text-xs text-white/45">{durationLabel(service.duration_minutes)}</p></div>
          <div className="flex items-center justify-between gap-4 sm:justify-end"><strong>{money(service.price, service.currency)}</strong><ArrowRight className="text-[var(--accent)]" size={20} /></div>
        </Link>)}
      </div>
    </section>
  </main>;
}

function Info({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const content = <><span className="text-[var(--accent)]">{icon}</span><div><p className="text-xs uppercase text-white/40">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div></>;
  return href ? <a href={href} className="flex min-h-28 items-center gap-4 bg-[#111] px-6 hover:bg-[#151515]">{content}</a> : <div className="flex min-h-28 items-center gap-4 bg-[#111] px-6">{content}</div>;
}
function todayHours(hours: Array<{ weekday: number; start_time: string; end_time: string; active: boolean }>) {
  const day = new Date().getDay(); const row = hours.find((item) => item.weekday === day && item.active);
  return row ? `${row.start_time.slice(0, 5)}–${row.end_time.slice(0, 5)}` : "Выходной";
}
