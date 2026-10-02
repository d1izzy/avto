import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell, Button, HStack, Text, VStack } from "@astryxdesign/core";
import { CalendarDays, Gauge, ListChecks, LogOut, Settings, Users, Wrench, Warehouse, ArrowUpRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/features/tenant/context";
import { cn } from "@/lib/utils";

const nav = [{ to: "dashboard", label: "Обзор", icon: Gauge }, { to: "bookings", label: "Записи", icon: ListChecks }, { to: "calendar", label: "Календарь", icon: CalendarDays }, { to: "services", label: "Услуги", icon: Wrench }, { to: "resources", label: "Боксы", icon: Warehouse }, { to: "customers", label: "Клиенты", icon: Users }, { to: "settings", label: "Настройки", icon: Settings }];
export function OwnerLayout() {
  const { tenant } = useTenant(); const base = `/s/${tenant.slug}/owner`; const navigate = useNavigate(); const client = useQueryClient();
  async function logout() { const { error } = await supabase.auth.signOut(); if (!error) { client.clear(); navigate(base, { replace: true }); } }
  return <AppShell height="auto" contentPadding={0} topNav={<HStack as="header" justify="between" align="center" wrap="wrap" gap={3} padding={5} className="border-b border-border"><VStack gap={1}><Text weight="bold">{tenant.name}</Text><Text size="sm" color="secondary">Кабинет студии</Text></VStack><HStack gap={2}><Button label="На сайт" variant="secondary" href={`/s/${tenant.slug}`} icon={<ArrowUpRight />} /><Button label="Выйти" variant="ghost" onClick={logout} icon={<LogOut />} /></HStack></HStack>}>
    <VStack gap={6} maxWidth={1200} width="100%" padding={5} className="mx-auto">
      <HStack as="nav" aria-label="Управление студией" gap={2} wrap="wrap">{nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={`${base}/${to}`} className={({ isActive }) => cn("rounded-lg px-4 py-3 text-sm transition-colors", isActive ? "bg-accent-muted text-accent" : "bg-surface text-secondary hover:text-primary")}><HStack gap={2} align="center"><Icon className="size-4" aria-hidden /><Text color="inherit" size="sm">{label}</Text></HStack></NavLink>)}</HStack>
      <VStack gap={6} className="min-w-0 pb-10"><Outlet /></VStack>
    </VStack>
  </AppShell>;
}
