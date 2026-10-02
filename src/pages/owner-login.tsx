import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LockKeyhole, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/features/tenant/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function OwnerLogin() {
  const { tenant } = useTenant(); const { tenantSlug } = useParams();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  const session = useQuery({ queryKey: ["session"], queryFn: async () => (await supabase.auth.getSession()).data.session });
  if (session.data) return <Navigate to={`/s/${tenantSlug}/owner/dashboard`} replace />;
  async function submit(e: React.FormEvent) { e.preventDefault(); setPending(true); setError(""); const result = await supabase.auth.signInWithPassword({ email, password }); setPending(false); if (result.error) setError("Неверный email или пароль."); }
  return <main className="grid min-h-screen place-items-center bg-[#0a0a0a] px-4"><Card className="w-full max-w-md p-6 sm:p-8"><LockKeyhole className="text-[var(--accent)]" /><h1 className="mt-5 text-2xl font-bold">Кабинет владельца</h1><p className="mt-2 text-sm text-white/50">{tenant.name}</p><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm"><span className="mb-2 block">Email</span><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label className="block text-sm"><span className="mb-2 block">Пароль</span><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{error && <p className="text-sm text-red-400">{error}</p>}<Button className="w-full" disabled={pending}>{pending && <Loader2 className="animate-spin" size={18} />} Войти</Button></form><p className="mt-5 text-center text-xs text-white/35">Регистрация владельцев выполняется администратором платформы.</p></Card></main>;
}
