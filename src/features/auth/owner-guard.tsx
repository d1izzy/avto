import { useEffect, useState } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export function OwnerGuard() {
  const { tenantSlug } = useParams(); const [session, setSession] = useState<Session | null | undefined>();
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSession(data.session)); const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next)); return () => data.subscription.unsubscribe(); }, []);
  if (session === undefined) return <div className="grid min-h-screen place-items-center text-white/60">Проверяем доступ...</div>;
  if (!session) return <Navigate to={`/s/${tenantSlug}/owner`} replace />;
  return <Outlet />;
}
