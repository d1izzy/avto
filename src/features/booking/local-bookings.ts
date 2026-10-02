// Store management links only; contact and vehicle details stay in the database.
const key = (slug: string) => `studio-bookings:${slug}`;
export function savedBookings(slug: string): string[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(key(slug)) ?? "[]"); return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, 20) : []; } catch { return []; }
}
export function rememberBooking(slug: string, token: string) {
  try { localStorage.setItem(key(slug), JSON.stringify([token, ...savedBookings(slug).filter((t) => t !== token)].slice(0, 20))); } catch { /* Private browsing: the confirmation URL still works. */ }
}
export function localDate(date: Date, timezone: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
export const statusLabels = { confirmed: "Подтверждена", in_progress: "В работе", completed: "Завершена", cancelled: "Отменена", no_show: "Не приехал" } as const;
