import { useEffect, useState } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/features/tenant/context";
import { Button, VStack } from "@astryxdesign/core";
import { Loading, Notice } from "@/components/studio-ui";

export function OwnerGuard() {
  const { tenantSlug } = useParams(); const [session, setSession] = useState<Session | null | undefined>();
  const { tenant } = useTenant();
  const access = useQuery({ queryKey: ["membership", tenant.id, session?.user.id], enabled: !!session, queryFn: async () => {
    const { data, error } = await supabase.from("tenant_memberships").select("role").eq("tenant_id", tenant.id).eq("user_id", session!.user.id).maybeSingle();
    if (error) throw error; return data;
  } });
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSession(data.session)); const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next)); return () => data.subscription.unsubscribe(); }, []);
  if (session === undefined) return <Loading label="Проверяем доступ…" />;
  if (!session) return <Navigate to={`/s/${tenantSlug}/owner`} replace />;
  if (access.isPending) return <Loading label="Проверяем права…" />;
  if (access.isError || access.data?.role !== "owner") return <VStack gap={4} padding={8}><Notice error>Нет доступа к этой студии. Войдите с учётной записью её владельца.</Notice><Button label="Выйти" onClick={() => supabase.auth.signOut()} /></VStack>;
  return <Outlet />;
}
