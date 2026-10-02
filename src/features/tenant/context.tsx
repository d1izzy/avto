import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Theme } from "@astryxdesign/core/theme";
import { VStack, Heading, Text } from "@astryxdesign/core";
import { studioTheme } from "@/app/theme";
import { Loading, Retry } from "@/components/studio-ui";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPublicTenant } from "./api";
import type { PublicTenantBundle } from "@/types/database";

const TenantContext = createContext<PublicTenantBundle | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { tenantSlug = "" } = useParams();
  const query = useQuery({ queryKey: ["tenant", tenantSlug], queryFn: () => getPublicTenant(tenantSlug), retry: 1 });
  const theme = useMemo(() => studioTheme(query.data?.tenant.accent_color, `studio-${tenantSlug}`), [query.data?.tenant.accent_color, tenantSlug]);
  if (query.isPending) return <Loading label="Загружаем студию…" />;
  if (query.isError || !query.data) return <VStack as="main" gap={4} padding={8} align="center"><Heading level={1}>Сервис не найден</Heading><Text color="secondary">Проверьте адрес или попробуйте позже.</Text><Retry onClick={() => query.refetch()} /></VStack>;
  return <TenantContext.Provider value={query.data}><Theme theme={theme} mode="dark">{children}</Theme></TenantContext.Provider>;
}

// Context hooks intentionally live beside their provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useTenant() {
  const value = useContext(TenantContext);
  if (!value) throw new Error("TenantContext is missing");
  return value;
}
