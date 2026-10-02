import { createContext, useContext, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPublicTenant } from "./api";
import type { PublicTenantBundle } from "@/types/database";

const TenantContext = createContext<PublicTenantBundle | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { tenantSlug = "" } = useParams();
  const query = useQuery({ queryKey: ["tenant", tenantSlug], queryFn: () => getPublicTenant(tenantSlug), retry: 1 });
  if (query.isPending) return <main className="grid min-h-screen place-items-center"><p className="text-white/60">Загружаем сервис...</p></main>;
  if (query.isError || !query.data) return <main className="grid min-h-screen place-items-center px-6 text-center"><div><h1 className="text-2xl font-bold">Сервис не найден</h1><p className="mt-2 text-white/60">Проверьте адрес или попробуйте позже.</p></div></main>;
  const accent = query.data.tenant.accent_color;
  return <TenantContext.Provider value={query.data}><div style={{ "--accent": accent } as React.CSSProperties}>{children}</div></TenantContext.Provider>;
}

// Context hooks intentionally live beside their provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useTenant() {
  const value = useContext(TenantContext);
  if (!value) throw new Error("TenantContext is missing");
  return value;
}
