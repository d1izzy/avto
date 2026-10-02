import { NavLink, Outlet, useParams } from "react-router-dom";
import { CalendarDays, Gauge, ListChecks, LogOut, Settings, Users, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/features/tenant/context";
import { cn } from "@/lib/utils";

const nav = [{ to: "dashboard", label: "Обзор", icon: Gauge }, { to: "bookings", label: "Записи", icon: ListChecks }, { to: "calendar", label: "Календарь", icon: CalendarDays }, { to: "services", label: "Услуги", icon: Wrench }, { to: "resources", label: "Ресурсы", icon: Wrench }, { to: "customers", label: "Клиенты", icon: Users }, { to: "settings", label: "Настройки", icon: Settings }];
export function OwnerLayout() {
  const { tenant } = useTenant(); const { tenantSlug } = useParams(); const base = `/s/${tenantSlug}/owner`;
  return <div className="min-h-screen bg-[#0b0b0b] text-white lg:grid lg:grid-cols-[240px_1fr]">
    <aside className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#101010]/95 px-2 backdrop-blur lg:inset-y-0 lg:left-0 lg:right-auto lg:w-60 lg:border-r lg:border-t-0 lg:p-4">
      <div className="hidden px-2 py-4 lg:block"><p className="font-bold">{tenant.name}</p><p className="mt-1 text-xs text-white/40">Управление сервисом</p></div>
      <nav className="flex overflow-x-auto lg:mt-6 lg:block lg:space-y-1">{nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={`${base}/${to}`} className={({ isActive }) => cn("flex min-w-16 flex-1 flex-col items-center gap-1 rounded-md px-2 py-2 text-[11px] text-white/50 hover:bg-white/5 hover:text-white lg:min-w-0 lg:flex-row lg:gap-3 lg:px-3 lg:text-sm", isActive && "bg-white/10 text-[var(--accent)]")}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
      <button onClick={() => supabase.auth.signOut()} className="absolute bottom-5 left-4 hidden items-center gap-3 rounded-md px-3 py-2 text-sm text-white/50 hover:text-white lg:flex"><LogOut size={18} /> Выйти</button>
    </aside>
    <main className="min-w-0 pb-24 lg:col-start-2 lg:pb-8"><header className="border-b border-white/10 px-4 py-5 sm:px-8"><p className="text-sm text-white/45">Кабинет владельца</p></header><div className="mx-auto max-w-7xl px-4 py-7 sm:px-8"><Outlet /></div></main>
  </div>;
}
