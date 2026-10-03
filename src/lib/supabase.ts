import { createClient } from "@supabase/supabase-js";
import { readEmailCallback } from "@/features/auth/email-link";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key && !url.includes("your-project"));
// Capture only flags before Auth consumes the URL. Never retain the link's tokens.
export const emailCallback = readEmailCallback(window.location.href);

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  key || "placeholder",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } }
);
