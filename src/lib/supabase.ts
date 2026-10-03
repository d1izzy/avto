import { createClient } from "@supabase/supabase-js";
import { readEmailCallback } from "@/features/auth/email-link";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key && !url.includes("your-project"));
// Capture only flags before Auth consumes the URL. Never retain the link's tokens.
export const emailCallback = readEmailCallback(window.location.href);
const legacyLink = new URLSearchParams(window.location.hash.slice(1)).has("access_token");

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  key || "placeholder",
  { auth: {
    persistSession: true, autoRefreshToken: true,
    // The requesting PWA performs PKCE exchange after the browser relays the code.
    // Legacy implicit links still work until their normal expiry.
    detectSessionInUrl: !legacyLink && !new URL(window.location.href).searchParams.has("email_flow"),
    flowType: "pkce", experimental: { appendPkceFlowIdToRedirects: true },
  } }
);

export const emailSessionInitialization = (async () => {
  // Accept still-valid links issued before PKCE was enabled. Tokens go directly
  // to Auth; only its normal session storage retains them.
  const legacy = new URLSearchParams(window.location.hash.slice(1));
  const initialized = await supabase.auth.initialize();
  if (!legacyLink) return initialized;
  const { error } = await supabase.auth.setSession({ access_token: legacy.get("access_token") ?? "", refresh_token: legacy.get("refresh_token") ?? "" });
  return { error };
})();
