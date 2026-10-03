/// <reference lib="dom" />
import { test, expect, type Page } from "@playwright/test";
import type { PublicTenantBundle } from "../../src/types/database";

test.use({ serviceWorkers: "block" });
test.setTimeout(60_000);
const serviceOne = "20000000-0000-0000-0000-000000000001";
const serviceTwo = "20000000-0000-0000-0000-000000000002";
const boxOne = "30000000-0000-0000-0000-000000000001";
const boxTwo = "30000000-0000-0000-0000-000000000002";
const token = "b".repeat(64);

async function fixture(page: Page, conflict = false) {
  let day = ""; let nextDay = "";
  const requests: Record<string, unknown>[] = [];
  await page.route("**/rest/v1/rpc/get_public_tenant", async (route) => {
    const response = await route.fetch();
    const bundle = await response.json() as PublicTenantBundle;
    const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: bundle.tenant.timezone });
    day = dateFormatter.format(new Date(Date.now() + 3 * 86400000));
    nextDay = dateFormatter.format(new Date(Date.now() + 4 * 86400000));
    bundle.services = [
      { ...bundle.services[0], id: serviceOne, name: "Мойка двух боксов", duration_minutes: 60 },
      { ...bundle.services[0], id: serviceTwo, name: "Полировка одного бокса", duration_minutes: 60 },
    ];
    bundle.resources = [
      { id: boxOne, name: "Бокс №1", description: "Контролируемый свет", service_ids: [serviceOne, serviceTwo] },
      { id: boxTwo, name: "Бокс №2", description: "Универсальный пост", service_ids: [serviceOne] },
    ];
    await route.fulfill({ json: bundle });
  });
  await page.route("**/rest/v1/rpc/get_availability", async (route) => {
    const body = route.request().postDataJSON();
    const slot = (id: string, name: string, hour: number) => ({
      resource_id: id, resource_name: name,
      starts_at: `${body.p_local_date}T${hour}:00:00+05:00`, ends_at: `${body.p_local_date}T${hour + 1}:00:00+05:00`,
    });
    const slots = [slot(boxOne, "Бокс №1", 10), slot(boxOne, "Бокс №1", 11)];
    if (body.p_local_date !== nextDay && body.p_service_id === serviceOne) slots.push(slot(boxTwo, "Бокс №2", 10), slot(boxTwo, "Бокс №2", 12));
    await route.fulfill({ json: slots });
  });
  await page.route("**/rest/v1/rpc/create_public_booking", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill(conflict ? { status: 400, json: { message: "BOOKING_SLOT_UNAVAILABLE", code: "P0001" } } : { json: { token, booking_id: "test-booking" } });
  });
  await page.route("**/rest/v1/rpc/get_public_booking", async (route) => {
    const request = requests.at(-1)!;
    await route.fulfill({ json: {
      id: "test-booking", status: "confirmed", resource_name: request.p_resource_id === boxTwo ? "Бокс №2" : "Бокс №1",
      service_name: "Мойка двух боксов", tenant_slug: "graphite", tenant_name: "GRAPHITE", address: "Адрес студии",
      starts_at: request.p_requested_start, ends_at: `${day}T13:00:00+05:00`, price: 1000, currency: "RUB",
      customer_name: "Тест выбора", vehicle: { brand: "Volvo", model: "XC60" }, can_cancel: false, can_reschedule: false,
    } });
  });
  await page.goto(`/s/graphite/book?service=${serviceOne}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("radio", { name: "Любой свободный", exact: true })).toBeChecked({ timeout: 15_000 });
  await page.getByLabel("Дата", { exact: true }).fill(day);
  await expect(page.getByRole("button", { name: "10:00", exact: true })).toBeVisible();
  return { requests, day, nextDay };
}
async function fillDetails(page: Page) {
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.getByLabel("Марка", { exact: true }).fill("Volvo");
  await page.getByLabel("Модель", { exact: true }).fill("XC60");
  await page.getByLabel("Имя", { exact: true }).fill("Тест выбора");
  await page.getByLabel("Телефон", { exact: true }).fill("+00000000000");
  await page.getByRole("button", { name: "Проверить запись", exact: true }).click();
}

test("specific box filters times, clears stale selections and stays selected on a fully booked day", async ({ page }) => {
  const { nextDay } = await fixture(page);
  await expect(page.getByRole("button", { name: "10:00", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "11:00", exact: true }).click();
  await expect(page.getByRole("button", { name: "Продолжить", exact: true })).toBeEnabled();
  await page.getByRole("radio", { name: "Бокс №2", exact: true }).check();
  await expect(page.getByRole("button", { name: "Продолжить", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "11:00", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "12:00", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "12:00", exact: true }).click();
  await page.getByLabel("Дата", { exact: true }).fill(nextDay);
  await expect(page.getByText("В выбранном боксе на эту дату свободного времени нет. Выберите другой день или смените бокс.")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Бокс №2", exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: "Продолжить", exact: true })).toBeDisabled();
  await page.getByRole("radio", { name: "Любой свободный", exact: true }).check();
  await expect(page.getByRole("button", { name: "10:00", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Назад", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Полировка одного бокса/ }).click();
  await expect(page.getByRole("radio", { name: "Бокс №2", exact: true })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Бокс №1", exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Любой свободный", exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: "Продолжить", exact: true })).toBeDisabled();
});

test("chosen box is submitted and shown in review and persisted booking", async ({ page }) => {
  const { requests } = await fixture(page);
  await page.getByRole("radio", { name: "Бокс №2", exact: true }).check();
  await page.getByRole("button", { name: "12:00", exact: true }).click();
  await page.screenshot({ path: test.info().outputPath("box-selection.png"), scale: "css" });
  await fillDetails(page);
  await expect(page.getByRole("dialog").getByText("Бокс №2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Назад", exact: true }).click();
  await page.getByRole("button", { name: "Назад", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Бокс №2", exact: true })).toBeChecked();
  await fillDetails(page);
  await page.getByRole("button", { name: "Подтвердить запись", exact: true }).click();
  await expect(page.getByText("Запись подтверждена", { exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].p_resource_id).toBe(boxTwo);
  await page.reload();
  await expect(page.getByText("Бокс №2", { exact: true })).toBeVisible();
});

test("conflict never silently replaces the chosen box with another one", async ({ page }) => {
  const { requests } = await fixture(page, true);
  await page.getByRole("radio", { name: "Бокс №2", exact: true }).check();
  await page.getByRole("button", { name: "10:00", exact: true }).click();
  await fillDetails(page);
  await page.getByRole("button", { name: "Подтвердить запись", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Это время уже занято");
  expect(requests).toHaveLength(1);
  expect(requests[0].p_resource_id).toBe(boxTwo);
  await page.getByRole("button", { name: "Выбрать другое время", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Бокс №2", exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: "Продолжить", exact: true })).toBeDisabled();
});
