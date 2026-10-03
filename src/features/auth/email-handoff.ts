import { useQuery } from "@tanstack/react-query";
import { emailSessionInitialization, supabase } from "@/lib/supabase";
import { readPendingEmail, rememberPendingEmail, usePendingEmail } from "./email-link";

type Handoff = { status: "waiting" | "ready" | "expired"; code?: string; flow_id?: string };
const { channel: returnedChannel, code: returnedCode, flowId: returnedFlow } = (() => {
  const url = new URL(window.location.href);
  return { channel: url.searchParams.get("email_flow"), code: url.searchParams.get("code"), flowId: url.searchParams.get("sb_flow_id") };
})();
export const isHandoffReturn = !!returnedChannel;
const channelPattern = /^[a-f0-9]{64}$/;

export function newEmailChannel() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function handoffRequest(channel: string, action: "start" | "read" | "deliver" | "finish", code?: string, flowId?: string): Promise<Handoff> {
  const { data, error } = await supabase.rpc("email_login_handoff", { p_channel: channel, p_action: action, p_code: code ?? null, p_flow_id: flowId ?? null });
  if (error) throw new Error("Не удалось проверить вход. Проверьте подключение и попробуйте ещё раз.");
  return data as Handoff;
}

// Only the PKCE authorization code crosses contexts. The verifier never leaves
// the requesting app except for the direct exchange with Supabase Auth.
let delivery: Promise<{ remote: boolean }> | null = null;
export function deliverEmailReturn() {
  // Logout clears the query cache. A processed callback must not run again.
  if (!delivery) delivery = deliverReturn().catch((error) => { delivery = null; throw error; });
  return delivery;
}
async function deliverReturn() {
  if (!returnedChannel || !channelPattern.test(returnedChannel) || !returnedCode || !returnedFlow) throw new Error("Ссылка недействительна или устарела. Вернитесь в приложение и запросите новое письмо.");
  const remote = readPendingEmail()?.channel !== returnedChannel;
  const result = await handoffRequest(returnedChannel, "deliver", returnedCode, returnedFlow);
  if (result.status === "expired") throw new Error("Время подтверждения истекло. Вернитесь в приложение и запросите новое письмо.");
  return { remote };
}

let exchanging: Promise<{ status: string; slug?: string }> | null = null;
async function resumeEmailLogin() {
  const pending = readPendingEmail();
  if (!pending?.channel || pending.failed) return { status: "idle" };
  await emailSessionInitialization;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return { status: "idle" }; // Never replace an already signed-in account.
  const result = await handoffRequest(pending.channel, "read");
  if (result.status === "waiting") return result;
  if (result.status === "expired") {
    rememberPendingEmail({ ...pending, failed: true });
    return result;
  }
  // A resend/address change may have superseded the pending request during I/O.
  if (readPendingEmail()?.channel !== pending.channel) return { status: "idle" };
  const { error } = await supabase.auth.exchangeCodeForSession(result.code!, { flowId: result.flow_id! });
  if (error) {
    rememberPendingEmail({ ...pending, failed: true });
    throw new Error("Не удалось завершить вход: ссылка устарела или уже использована. Получите новое письмо.");
  }
  rememberPendingEmail(null);
  // Best-effort cleanup: expired codes are unreadable even if this request fails.
  void handoffRequest(pending.channel, "finish").catch(() => {});
  return { status: "signed-in", slug: pending.slug };
}

async function resumeOnce() {
  if (!exchanging) {
    const run = () => resumeEmailLogin();
    exchanging = (async () => navigator.locks ? await navigator.locks.request("studio:email-login", run) : await run())().finally(() => { exchanging = null; });
  }
  return exchanging;
}

export function useEmailHandoff() {
  const pending = usePendingEmail();
  return useQuery({
    queryKey: ["email-handoff", pending?.channel], queryFn: resumeOnce,
    enabled: !!pending?.channel && !pending.failed,
    staleTime: 0, retry: false, refetchOnWindowFocus: "always", refetchOnReconnect: true,
    refetchInterval: (query) => query.state.error || pending?.failed || !readPendingEmail()?.channel ? false : 4000,
    refetchIntervalInBackground: false,
  });
}
