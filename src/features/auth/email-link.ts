import type { AuthError } from "@supabase/supabase-js";

export const EMAIL_RETRY_MS = 60_000;
const PENDING_EMAIL_KEY = "studio:pending-email";
const PENDING_EMAIL_MAX_AGE = 60 * 60_000;

export type PendingEmail = { email: string; sentAt: number };

export function readPendingEmail(): PendingEmail | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(PENDING_EMAIL_KEY) ?? "null");
    if (typeof value?.email !== "string" || typeof value?.sentAt !== "number") return null;
    const age = Date.now() - value.sentAt;
    return age >= 0 && age < PENDING_EMAIL_MAX_AGE ? value : null;
  } catch { return null; }
}

export function rememberPendingEmail(value: PendingEmail | null) {
  try {
    if (value) sessionStorage.setItem(PENDING_EMAIL_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(PENDING_EMAIL_KEY);
  } catch { /* A blocked storage must not prevent email sign-in. */ }
}

export function emailLinkError(error: Pick<AuthError, "code" | "status">) {
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    return "Слишком много запросов. Подождите несколько минут и попробуйте снова.";
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
