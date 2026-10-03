/// <reference lib="dom" />
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { AvailabilitySlot, OwnerBooking, Service } from "../../src/types/database";

test.beforeEach(() => test.skip(!process.env.E2E_OWNER_EMAIL || !process.env.E2E_OWNER_PASSWORD, "Requires explicit owner credentials"));
test.use({ actionTimeout: 15_000 });
async function login(page: Page) {
  await page.goto("/s/graphite/owner");
  await page.getByLabel("Почта", { exact: true }).fill(process.env.E2E_OWNER_EMAIL!);
  await page.getByLabel("Пароль", { exact: true }).fill(process.env.E2E_OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Обзор студии" })).toBeVisible();
}
async function api(request: APIRequestContext) {
  const url = process.env.VITE_SUPABASE_URL!; const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  const auth = await request.post(`${url}/auth/v1/token?grant_type=password`, { headers: { apikey: key }, data: { email: process.env.E2E_OWNER_EMAIL, password: process.env.E2E_OWNER_PASSWORD } });
  expect(auth.ok()).toBe(true);
  const session = await auth.json();
  const headers = { apikey: key, Authorization: `Bearer ${session.access_token}` };
  async function rpc<T>(name: string, data: Record<string, unknown>, succeeds = true): Promise<T> {
    const response = await request.post(`${url}/rest/v1/rpc/${name}`, { headers, data });
    expect(response.ok(), `${name}: ${await response.text()}`).toBe(succeeds);
    return response.status() === 204 ? undefined as T : await response.json();
  }
  return { rpc, headers, url, session };
}

test("owner manages a box, linked service, customer, gallery and closure", async ({ page, request }) => {
  test.setTimeout(150_000);
  const name = `E2E CRUD ${randomUUID().slice(0, 8)}`;
  const backend = await api(request); const tenantId = "10000000-0000-0000-0000-000000000001";
  let uploadedPath: string | undefined;
  await login(page);
  try {
    await page.getByRole("link", { name: "Боксы", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Боксы", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Добавить", exact: true }).click();
    await page.getByLabel("Название", { exact: true }).fill(name);
    await page.getByLabel("Порядок в списке").fill("99");
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await page.getByRole("link", { name: "Услуги", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Услуги", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Добавить", exact: true }).click();
    await page.getByLabel("Название", { exact: true }).fill(name);
    await page.getByLabel("Цена, ₽").fill("100");
    await page.getByLabel("Длительность, мин").fill("30");
    await page.getByRole("checkbox", { name, exact: true }).check();
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    const row = page.getByRole("button", { name: `Редактировать ${name}` }).locator("..");
    await row.getByRole("button", { name: "Удалить", exact: true }).click();
    await page.getByRole("button", { name: "Подтвердить удаление" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Показать архив", exact: true }).check();
    await expect(page.getByText(name, { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Клиенты", exact: true }).click();
    await page.getByRole("button", { name: "Добавить клиента" }).click();
    await page.getByLabel("Имя клиента").fill(name);
    await page.getByLabel("Телефон клиента").fill(`+000${Date.now()}`);
    await page.getByRole("button", { name: "Сохранить клиента" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await page.getByLabel("Поиск клиентов").fill(name);
    await page.getByRole("button", { name: `Изменить клиента ${name}` }).click();
    await page.getByLabel("Имя клиента").fill(`${name} edited`);
    await page.getByRole("button", { name: "Сохранить клиента" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(page.getByText(`${name} edited`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: `Изменить клиента ${name} edited` }).locator("..").getByRole("button", { name: "Удалить", exact: true }).click();
    await page.getByRole("button", { name: "Подтвердить удаление" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(page.getByText(`${name} edited`, { exact: true })).toHaveCount(0);

    await page.getByRole("link", { name: "Настройки", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Настройки студии", exact: true })).toBeVisible();
    const hoursBefore = await backend.rpc<{ hours: unknown[] }>("get_public_tenant", { p_slug: "graphite" });
    await page.getByRole("button", { name: "Сохранить рабочие часы" }).click();
    await expect(page.getByText("Сохранено", { exact: true })).toBeVisible();
    const hoursAfter = await backend.rpc<{ hours: unknown[] }>("get_public_tenant", { p_slug: "graphite" });
    expect(hoursAfter.hours).toEqual(hoursBefore.hours);
    await backend.rpc("owner_replace_hours", { p_slug: "graphite", p_hours: [{ weekday: 1, active: true, start_time: "18:00", end_time: "09:00" }] }, false);
    expect((await backend.rpc<{ hours: unknown[] }>("get_public_tenant", { p_slug: "graphite" })).hours).toEqual(hoursBefore.hours);
    await page.getByRole("button", { name: "Добавить фотографию" }).click();
    const image = await page.getByRole("heading", { name: "Новая фотография" }).screenshot();
    await page.getByLabel("Загрузить фотографию").setInputFiles({ name: "test.png", mimeType: "image/png", buffer: image });
    await expect(page.getByLabel("Ссылка на фото")).toHaveValue(/tenant-assets/);
    uploadedPath = new URL(await page.getByLabel("Ссылка на фото").inputValue()).pathname.split("/tenant-assets/")[1];
    await page.getByLabel("Подпись к фото").fill(name);
    await page.getByRole("button", { name: "Сохранить фотографию" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    const photo = page.getByText(name, { exact: true }).locator("../..");
    await photo.getByRole("button", { name: "Изменить фото", exact: true }).click();
    await page.getByLabel("Подпись к фото").fill(`${name} photo`);
    await page.getByLabel("Порядок фотографии").fill("90");
    await page.getByRole("button", { name: "Сохранить фотографию" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await page.getByText(`${name} photo`, { exact: true }).locator("../..").getByRole("button", { name: "Удалить фото" }).click();
    await page.getByRole("button", { name: "Подтвердить удаление" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);

    await page.getByRole("button", { name: "Добавить перерыв" }).click();
    await page.getByLabel("Дата перерыва").fill("2030-01-01");
    await page.getByLabel("Причина").fill(name);
    await page.getByRole("button", { name: "Сохранить перерыв" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await page.getByText(`Вся студия · ${name}`, { exact: true }).locator("../..").getByRole("button", { name: "Удалить", exact: true }).click();
    await page.getByRole("button", { name: "Подтвердить удаление" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  } finally {
    if (uploadedPath) { const removed = await request.delete(`${backend.url}/storage/v1/object/tenant-assets`, { headers: backend.headers, data: { prefixes: [uploadedPath] } }); expect(removed.ok()).toBe(true); }
    // Only this scenario's unique fixtures; never delete customer/business records.
    for (const [table, field] of [["services", "name"], ["resources", "name"], ["customers", "name"], ["tenant_assets", "alt_text"], ["schedule_exceptions", "reason"]]) {
      const response = await request.delete(`${backend.url}/rest/v1/${table}?tenant_id=eq.${tenantId}&${field}=like.${encodeURIComponent(name)}*`, { headers: backend.headers });
      expect(response.ok(), `cleanup ${table}`).toBe(true);
    }
  }
});

test("owner booking editor persists changes, rejects conflicts and archives", async ({ page, request }) => {
  test.setTimeout(120_000);
  const { rpc } = await api(request); const name = `E2E owner ${randomUUID().slice(0, 8)}`;
  const { services } = await rpc<{ services: Service[] }>("owner_catalog", { p_slug: "graphite" });
  const service = services.find((s) => s.active && !s.deleted_at)!;
  let slots: AvailabilitySlot[] = []; let day = "";
  for (let i = 5; i < 12 && !slots.length; i++) { day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Yekaterinburg" }).format(new Date(Date.now() + i * 86400000)); slots = await rpc("get_availability", { p_slug: "graphite", p_service_id: service.id, p_local_date: day }); }
  expect(slots.length).toBeGreaterThan(0); const slot = slots[0]; let id: string | undefined;
  try {
    await login(page); await page.getByRole("link", { name: "Записи", exact: true }).click();
    await page.getByRole("button", { name: "Добавить запись" }).click();
    await page.getByLabel("Услуга", { exact: true }).selectOption(service.id);
    await page.getByLabel("Дата визита").fill(day);
    await page.getByLabel("Время и бокс").selectOption(`${slot.starts_at}|${slot.resource_id}`);
    await page.getByLabel("Имя клиента").fill(name);
    await page.getByLabel("Телефон клиента").fill("+00000000001");
    await page.getByLabel("Марка", { exact: true }).fill("Test"); await page.getByLabel("Модель", { exact: true }).fill("Car");
    await page.getByRole("button", { name: "Сохранить запись" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect.poll(async () => { id = (await rpc<OwnerBooking[]>("owner_list_bookings", { p_slug: "graphite" })).find((b) => b.customer_name === name)?.id; return id; }).toBeTruthy();
    await rpc("owner_save_booking", { p_slug: "graphite", p_booking: { service_id: service.id, resource_id: slot.resource_id, starts_at: slot.starts_at, customer_name: name, customer_phone: "+00000000001", vehicle: { brand: "Test", model: "Car" }, idempotency_key: randomUUID() } }, false);
    await page.getByLabel("Поиск по имени, телефону или услуге").fill(name);
    await page.getByRole("button", { name: "Изменить запись", exact: true }).click();
    await page.getByLabel("Модель", { exact: true }).fill("Changed"); await page.getByLabel("Стоимость", { exact: true }).fill("1234");
    await page.getByRole("button", { name: "Сохранить запись" }).click(); await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect.poll(async () => { const updated = (await rpc<OwnerBooking[]>("owner_list_bookings", { p_slug: "graphite" })).find((b) => b.id === id)!; return { price: updated.price, model: updated.vehicle.model }; }).toEqual({ price: 1234, model: "Changed" });
    await page.getByRole("button", { name: "Удалить запись", exact: true }).click(); await page.getByRole("button", { name: "Подтвердить удаление" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect.poll(async () => (await rpc<OwnerBooking[]>("owner_list_bookings", { p_slug: "graphite" })).find((b) => b.id === id)?.deleted_at).toBeTruthy();
    expect((await rpc<OwnerBooking[]>("owner_list_bookings", { p_slug: "graphite" })).find((b) => b.id === id)?.status).toBe("cancelled");
  } finally { if (!id) id = (await rpc<OwnerBooking[]>("owner_list_bookings", { p_slug: "graphite" })).find((b) => b.customer_name === name)?.id; if (id) await rpc("owner_archive_booking", { p_slug: "graphite", p_id: id }); }
});

test("signed-in profile syncs a claimed booking across devices and denies anonymous owner access", async ({ page, request, browser }) => {
  test.setTimeout(60_000);
  const backend = await api(request);
  const deny = await request.post(`${backend.url}/rest/v1/rpc/owner_list_bookings`, { headers: { apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY! }, data: { p_slug: "graphite" } }); expect(deny.ok()).toBe(false);
  await backend.rpc("owner_catalog", { p_slug: "nova-garage" }, false);
  await backend.rpc("customer_claim_booking", { p_token: "invalid" }, false);
  await login(page); await page.goto("/s/graphite/account");
  await expect(page.getByText("Почта подтверждена", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Редактировать данные" }).click();
  await expect(page.getByRole("button", { name: "Сохранить профиль" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Получить ссылку" })).toHaveCount(0);
  const services = await backend.rpc<{ services: Service[] }>("owner_catalog", { p_slug: "graphite" });
  const service = services.services.find((s) => s.active && !s.deleted_at)!;
  let slots: AvailabilitySlot[] = [];
  for (let offset = 8; offset < 15 && !slots.length; offset++) {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Yekaterinburg" }).format(new Date(Date.now() + offset * 86400000));
    slots = await backend.rpc("get_availability", { p_slug: "graphite", p_service_id: service.id, p_local_date: day });
  }
  expect(slots.length).toBeGreaterThan(0);
  const booking = await backend.rpc<{ token: string; booking_id: string }>("create_public_booking", { p_slug: "graphite", p_service_id: service.id, p_resource_id: slots[0].resource_id, p_requested_start: slots[0].starts_at, p_customer_name: "E2E profile sync", p_customer_phone: "+00000000002", p_customer_email: null, p_vehicle: { brand: "Test", model: "Sync" }, p_idempotency_key: randomUUID() });
  await backend.rpc("customer_claim_booking", { p_token: booking.token });
  await backend.rpc("owner_archive_booking", { p_slug: "graphite", p_id: booking.booking_id });
  await page.reload();
  await expect(page.locator(`a[href$="/booking/${booking.token}"]`)).toBeVisible();
  const clean = await browser.newContext();
  try {
    await clean.addInitScript(({ session, key }) => localStorage.setItem(key, JSON.stringify(session)), { session: backend.session, key: "sb-mzaghgnxetlrbcpvdvzq-auth-token" });
    const other = await clean.newPage(); await other.goto(`${test.info().project.use.baseURL}/s/graphite/account`);
    await expect(other.getByText("Почта подтверждена", { exact: true })).toBeVisible();
    await expect(other.locator(`a[href$="/booking/${booking.token}"]`)).toBeVisible();
    expect(await other.evaluate(() => localStorage.getItem("studio-bookings:graphite"))).toBeNull();
    await other.getByRole("button", { name: "Выйти из профиля" }).click();
    await expect(other.getByRole("button", { name: "Получить ссылку" })).toBeVisible();
  } finally { await clean.close(); }
});
