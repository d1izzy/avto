import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import type { AvailabilitySlot, BookingPublic, PublicTenantBundle } from "../../src/types/database";

test("customer can confirm, reload and cancel a persisted booking", async ({ page, request }) => {
  test.skip(process.env.E2E_SUPABASE_READY !== "1", "Requires an explicitly enabled seeded Supabase project");
  test.setTimeout(90_000);
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Public Supabase configuration is required");

  async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const response = await request.post(`${url}/rest/v1/rpc/${name}`, {
      headers: { apikey: key! }, data: body
    });
    expect(response.ok(), `${name} HTTP status ${response.status()}`).toBe(true);
    return response.status() === 204 ? undefined as T : await response.json() as T;
  }

  const bundle = await rpc<PublicTenantBundle>("get_public_tenant", { p_slug: "graphite" });
  const service = bundle.services.find((item) => item.id === "20000000-0000-0000-0000-000000000001");
  if (!service) throw new Error("The regression fixture service is missing");
  expect(bundle.settings.customer_can_cancel).toBe(true);
  const firstDay = Math.max(3, Math.ceil(Math.max(bundle.settings.cancellation_deadline_minutes, bundle.settings.minimum_booking_notice_minutes) / 1440) + 2);
  let date = "";
  let available: AvailabilitySlot[] = [];
  for (let offset = firstDay; offset <= Math.min(firstDay + 7, bundle.settings.maximum_booking_days); offset++) {
    date = new Intl.DateTimeFormat("en-CA", { timeZone: bundle.tenant.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + offset * 86400000));
    available = await rpc<AvailabilitySlot[]>("get_availability", { p_slug: "graphite", p_service_id: service.id, p_local_date: date });
    if (available.length) break;
  }
  if (!available.length) throw new Error("No cancellable future slot available for verification");
  // Prefer a box other than the automatic first choice, to verify an explicit selection.
  const slot = available.find((item) => item.resource_id !== available[0].resource_id) ?? available[0];
  const slotLabel = new Intl.DateTimeFormat("ru-RU", { timeZone: bundle.tenant.timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(slot.starts_at));
  const customerName = `E2E verification ${randomUUID().slice(0, 8)}`;
  let token: string | undefined;

  try {
    await page.goto("/s/graphite/book");
    await page.getByRole("dialog").getByRole("button", { name: new RegExp(service.name) }).click();
    await page.getByRole("radio", { name: slot.resource_name, exact: true }).check();
    await page.getByLabel("Дата", { exact: true }).fill(date);
    await page.getByRole("button", { name: slotLabel, exact: true }).first().click();
    await page.getByRole("button", { name: /Продолжить/ }).click();
    // Wheel input must expose the last form action without locator auto-scroll.
    const originalViewport = page.viewportSize()!;
    await page.setViewportSize({ width: 375, height: 420 });
    const scroll = page.getByTestId("booking-scroll");
    await scroll.hover();
    await page.mouse.wheel(0, 2000);
    await expect.poll(async () => scroll.evaluate((e) => e.scrollTop > 0)).toBe(true);
    const proceed = page.getByRole("button", { name: "Проверить запись", exact: true });
    await expect(proceed).toBeInViewport();
    await page.setViewportSize(originalViewport);
    await page.getByRole("button", { name: /Проверить запись/ }).click();
    await expect(page.getByRole("alert")).toContainText("Проверьте отмеченные поля");
    await page.getByLabel("Марка", { exact: true }).fill("Volvo");
    await page.getByLabel("Модель", { exact: true }).fill("XC60");
    await page.getByLabel("Имя", { exact: true }).fill(customerName);
    // Deliberately non-deliverable contact; never use a real customer's phone.
    await page.getByLabel("Телефон", { exact: true }).fill("+00000000000");
    await page.getByRole("button", { name: /Проверить запись/ }).click();
    await expect(page.getByRole("dialog").getByText(slot.resource_name, { exact: true })).toBeVisible();
    const responsePromise = page.waitForResponse((response) => response.url() === `${url}/rest/v1/rpc/create_public_booking` && response.request().method() === "POST");
    await page.getByRole("button", { name: /Подтвердить запись/ }).click();
    const response = await responsePromise;
    expect(response.request().postDataJSON().p_resource_id).toBe(slot.resource_id);
    expect(response.ok(), `Booking confirmation HTTP status ${response.status()}`).toBe(true);
    const result = await response.json() as { token: string; booking_id: string };
    token = result.token;
    expect(Boolean(token)).toBe(true);
    await expect(page.getByText("Запись подтверждена", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Запись подтверждена", { exact: true })).toBeVisible();

    const booking = await rpc<BookingPublic>("get_public_booking", { p_token: token });
    expect(booking.id).toBe(result.booking_id);
    expect(booking.status).toBe("confirmed");
    expect(booking.customer_name).toBe(customerName);
    expect(booking.vehicle).toMatchObject({ brand: "Volvo", model: "XC60" });
    expect(booking.resource_name).toBe(slot.resource_name);
    expect(new Date(booking.starts_at).getTime()).toBe(new Date(slot.starts_at).getTime());

    await page.getByRole("button", { name: "Отменить запись", exact: true }).click();
    await page.getByRole("button", { name: "Отменить запись", exact: true }).click();
    await expect(page.getByText("Запись отменена", { exact: true })).toBeVisible();
    const cancelled = await rpc<BookingPublic>("get_public_booking", { p_token: token });
    expect(cancelled.status).toBe("cancelled");
    const released = await rpc<AvailabilitySlot[]>("get_availability", { p_slug: "graphite", p_service_id: service.id, p_local_date: date });
    expect(released.some((item) => item.resource_id === slot.resource_id && new Date(item.starts_at).getTime() === new Date(slot.starts_at).getTime())).toBe(true);
  } finally {
    if (token) {
      const booking = await rpc<BookingPublic>("get_public_booking", { p_token: token });
      if (booking.status !== "cancelled") await rpc<void>("cancel_public_booking", { p_token: token });
    }
  }
});
