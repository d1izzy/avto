import type { BookingPublic } from "@/types/database";

const esc = (value: string) => value.replace(/[\\,;]/g, "\\$&").replace(/\n/g, "\\n");
const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function downloadIcs(booking: BookingPublic) {
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ServiceSlot//Booking//RU", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${booking.id}@serviceslot`, `DTSTAMP:${stamp(new Date().toISOString())}`, `DTSTART:${stamp(booking.starts_at)}`, `DTEND:${stamp(booking.ends_at)}`,
    `SUMMARY:${esc(`${booking.service_name} — ${booking.tenant_name}`)}`, `LOCATION:${esc(booking.address ?? "")}`, `DESCRIPTION:${esc(`Ресурс: ${booking.resource_name}`)}`,
    "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `booking-${booking.id}.ics`; link.click(); URL.revokeObjectURL(url);
}
