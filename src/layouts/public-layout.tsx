import { Outlet, Link, NavLink, useLocation } from "react-router-dom";
import { AppShell, HStack, VStack, Text } from "@astryxdesign/core";
import { CalendarCheck2, House, Sparkles, UserRound } from "lucide-react";
import { useTenant } from "@/features/tenant/context";
import { cn } from "@/lib/utils";

export function PublicLayout() {
  const { tenant } = useTenant(); const location = useLocation(); const base = `/s/${tenant.slug}`;
  if (location.pathname.includes("/owner")) return <Outlet />;
  return <AppShell height="auto" variant="wash" contentPadding={0} topNav={
    <HStack as="header" justify="between" align="center" paddingBlock={4} paddingInline={5} maxWidth={1080} width="100%" className="mx-auto">
      <Link to={base} aria-label={`${tenant.name} — главная`}><HStack gap={3} align="center">{tenant.logo_url ? <img src={tenant.logo_url} alt="" className="size-9 rounded-lg object-contain" /> : <Sparkles aria-hidden className="size-7 text-accent" />}<Text weight="bold">{tenant.name}</Text></HStack></Link>
      <Link to={`${base}/account`} aria-label="Мой профиль" className="rounded-full border border-border p-3 text-secondary hover:text-primary"><UserRound aria-hidden className="size-5" /></Link>
    </HStack>
  }>
    <VStack gap={8} maxWidth={1080} width="100%" paddingInline={5} className="mx-auto pb-32"><Outlet /><Text as="p" size="sm" color="secondary" justify="center">{tenant.name} · онлайн-запись</Text></VStack>
    <HStack as="nav" aria-label="Главная навигация" gap={1} padding={2} className="fixed bottom-[max(var(--spacing-5),env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 rounded-full border border-border bg-popover shadow-lg">
      {[{ to: base, label: "Главная", icon: House, end: true }, { to: `${base}/services`, label: "Услуги", icon: Sparkles }, { to: `${base}/booking`, label: "Моя запись", icon: CalendarCheck2 }].map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => cn("rounded-full px-4 py-3 text-sm whitespace-nowrap transition-colors", isActive ? "bg-muted text-primary" : "text-secondary hover:text-primary")}><HStack gap={2} align="center"><Icon className="size-4" aria-hidden /><Text color="inherit" size="sm">{label}</Text></HStack></NavLink>)}
    </HStack>
  </AppShell>;
}
