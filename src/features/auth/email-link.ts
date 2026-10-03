import type { AuthError } from "@supabase/supabase-js";
import { useMemo, useSyncExternalStore } from "react";

export const EMAIL_RETRY_MS = 60_000;
const PENDING_EMAIL_KEY = "studio:pending-email";
const PENDING_EMAIL_MAX_AGE = 60 * 60_000;
const RETRY_KEY = "studio:email-retry";
const EMAIL_STATE_EVENT = "studio:email-state";

export type PendingEmail = { email: string; sentAt: number; channel?: string; slug?: string; failed?: boolean };
export type EmailRetry = { until: number; email: string; limited?: boolean };

function stored(key: string) {
  try { return localStorage.getItem(key) ?? (key === PENDING_EMAIL_KEY ? sessionStorage.getItem(key) : null); }
  catch { return null; }
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(EMAIL_STATE_EVENT, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(EMAIL_STATE_EVENT, listener); };
}
function parsePending(raw: string | null): PendingEmail | null {
  try {
    const value = JSON.parse(raw ?? "null");
    if (typeof value?.email !== "string" || !Number.isFinite(value?.sentAt)) return null;
    const age = Date.now() - value.sentAt;
    return age >= 0 && age < PENDING_EMAIL_MAX_AGE ? value : null;
  } catch { return null; }
}

export function usePendingEmail() {
  const raw = useSyncExternalStore(subscribe, () => stored(PENDING_EMAIL_KEY));
  return useMemo(() => parsePending(raw), [raw]);
}

export function readPendingEmail(): PendingEmail | null {
  return parsePending(stored(PENDING_EMAIL_KEY));
}

export function rememberPendingEmail(value: PendingEmail | null) {
  try {
    if (value) localStorage.setItem(PENDING_EMAIL_KEY, JSON.stringify(value));
    else localStorage.removeItem(PENDING_EMAIL_KEY);
    sessionStorage.removeItem(PENDING_EMAIL_KEY);
  } catch { /* A blocked storage must not prevent email sign-in. */ }
  window.dispatchEvent(new Event(EMAIL_STATE_EVENT));
}

export function readEmailRetry(): EmailRetry | null {
  try {
    const value = JSON.parse(stored(RETRY_KEY) ?? "null");
    return Number.isFinite(value?.until) && value.until > Date.now() && value.until <= Date.now() + PENDING_EMAIL_MAX_AGE && typeof value.email === "string" ? value : null;
  } catch { return null; }
}
export function rememberEmailRetry(value: EmailRetry) {
  try { localStorage.setItem(RETRY_KEY, JSON.stringify(value)); } catch { /* In-memory timer still applies. */ }
  window.dispatchEvent(new Event(EMAIL_STATE_EVENT));
}
export const EMAIL_LIMIT_MESSAGE = "Лимит отправки писем временно исчерпан. Если письмо уже пришло, используйте его — новое не требуется. Иначе повторите попытку примерно через час. Записаться можно и без входа.";

export function emailRetryDelay(error: Pick<AuthError, "code" | "status">) {
  if (error.code === "over_email_send_rate_limit") return PENDING_EMAIL_MAX_AGE;
  return EMAIL_RETRY_MS;
}

export function emailLinkError(error: Pick<AuthError, "code" | "status">) {
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    return error.code === "over_email_send_rate_limit" ? EMAIL_LIMIT_MESSAGE : "Запросы идут слишком часто. Подождите минуту перед повторной попыткой. Если письмо уже пришло, используйте его.";
  }
  if (error.code === "email_address_invalid" || error.code === "validation_failed") {
    return "Проверьте адрес почты и попробуйте снова.";
  }
  if (error.code === "email_address_not_authorized" || error.code === "email_provider_disabled" || error.code === "signup_disabled") {
    return "Сейчас отправка писем недоступна. Попробуйте позже — записаться можно и без входа.";
  }
  return "Не удалось отправить письмо. Проверьте подключение и попробуйте ещё раз. Записаться можно и без входа.";
}

export function readEmailCallback(url: string) {
  const parsed = new URL(url);
  const params = new URLSearchParams(`${parsed.search.slice(1)}&${parsed.hash.slice(1)}`);
  return {
    present: ["access_token", "refresh_token", "code", "error", "error_code", "error_description"].some((key) => params.has(key)),
    failed: ["error", "error_code", "error_description"].some((key) => params.has(key)),
  };
}
