import { Outlet, Link } from "react-router-dom";
import { Phone, MapPin } from "lucide-react";
import { useTenant } from "@/features/tenant/context";

export function PublicLayout() {
  const { tenant } = useTenant();
  return <div className="min-h-screen bg-[#0a0a0a] text-white">
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-black/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to={`/s/${tenant.slug}`} className="flex min-w-0 items-center gap-3 font-bold"><span className="size-2.5 shrink-0 bg-[var(--accent)]" /><span className="truncate">{tenant.name}</span></Link>
        <div className="flex items-center gap-1">
          {tenant.phone && <a href={`tel:${tenant.phone}`} className="grid size-11 place-items-center rounded-md hover:bg-white/10" aria-label="Позвонить"><Phone size={19} /></a>}
          {tenant.address && <a href={`https://maps.google.com/?q=${encodeURIComponent(tenant.address)}`} target="_blank" rel="noreferrer" className="grid size-11 place-items-center rounded-md hover:bg-white/10" aria-label="Открыть карту"><MapPin size={19} /></a>}
        </div>
      </div>
    </header>
    <Outlet />
    <footer className="border-t border-white/10 px-4 py-8 text-center text-sm text-white/40">{tenant.name} · онлайн-запись</footer>
  </div>;
}
