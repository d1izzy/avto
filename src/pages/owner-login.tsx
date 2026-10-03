import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell, Button, Card, Heading, Text, VStack } from "@astryxdesign/core";
import { LockKeyhole } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/features/tenant/context";
import { Field, Notice } from "@/components/studio-ui";

export function OwnerLogin() {
  const { tenant } = useTenant(); const navigate = useNavigate(); const client = useQueryClient();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) navigate(`/s/${tenant.slug}/owner/dashboard`, { replace: true }); }); }, [navigate, tenant.slug]);
  const login = useMutation({ mutationFn: async () => {
    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (result.error) throw new Error("Не удалось войти. Проверьте почту и пароль.");
    client.setQueryData(["session"], result.data.session);
  }, onSuccess: () => navigate(`/s/${tenant.slug}/owner/dashboard`, { replace: true }) });
  return <AppShell height="auto" contentPadding={5}><VStack minHeight="100svh" align="center" justify="center" gap={5}><Card padding={6} maxWidth={440} width="100%"><VStack gap={5}><LockKeyhole className="size-8 text-accent" /><VStack gap={2}><Heading level={1}>Кабинет студии</Heading><Text color="secondary">{tenant.name}</Text></VStack><form onSubmit={(e) => { e.preventDefault(); if (!login.isPending) login.mutate(); }}><VStack gap={4}><Field label="Почта" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /><Field label="Пароль" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />{login.isError && <Notice error>{login.error.message}</Notice>}<Button variant="primary" label="Войти" type="submit" size="lg" isLoading={login.isPending} isDisabled={login.isPending} /></VStack></form><Text size="sm" color="secondary">Вход доступен только владельцу студии.</Text></VStack></Card><Link to={`/s/${tenant.slug}`} className="text-sm text-secondary">← На сайт студии</Link></VStack></AppShell>;
}
