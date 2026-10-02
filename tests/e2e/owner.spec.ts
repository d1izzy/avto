/// <reference lib="dom" />
import { test, expect } from "@playwright/test";
import type { Service } from "../../src/types/database";

test("owner can sign in, edit a service, save settings and sign out", async ({ page, request }) => {
  test.skip(!process.env.E2E_OWNER_EMAIL || !process.env.E2E_OWNER_PASSWORD, "Explicit owner test credentials required");
  test.setTimeout(90_000);
  const url = process.env.VITE_SUPABASE_URL!; const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  const authResponse = await request.post(`${url}/auth/v1/token?grant_type=password`, { headers: { apikey: key }, data: { email: process.env.E2E_OWNER_EMAIL, password: process.env.E2E_OWNER_PASSWORD } });
  expect(authResponse.ok()).toBe(true);
  const { access_token: accessToken } = await authResponse.json() as { access_token: string };
  const headers = { apikey: key, Authorization: `Bearer ${accessToken}` };
  const originalResponse = await request.post(`${url}/rest/v1/rpc/owner_catalog`, { headers, data: { p_slug: "graphite" } });
  expect(originalResponse.ok()).toBe(true);
  const { services } = await originalResponse.json() as { services: Service[] };
  const service = services.find((s) => s.id === "20000000-0000-0000-0000-000000000001")!;
  const changed = `${service.description ?? ""} [проверка редактирования]`;
  let edited = false;
  try {
    await page.goto("/s/graphite/owner/dashboard");
    await expect(page.getByRole("heading", { name: "Кабинет студии" })).toBeVisible();
    await page.getByLabel("Почта", { exact: true }).fill(process.env.E2E_OWNER_EMAIL!);
    await page.getByLabel("Пароль", { exact: true }).fill(process.env.E2E_OWNER_PASSWORD!);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Обзор студии" })).toBeVisible();
    await page.getByRole("link", { name: "Услуги", exact: true }).click();
    await page.getByRole("button", { name: `Редактировать ${service.name}`, exact: true }).click();
    await page.getByLabel("Описание", { exact: true }).fill(changed);
    edited = true;
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: `Редактировать ${service.name}`, exact: true }).click();
    await expect(page.getByLabel("Описание", { exact: true })).toHaveValue(changed);
    await page.getByLabel("Описание", { exact: true }).fill(service.description ?? "");
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    edited = false;
    await page.getByRole("link", { name: "Настройки", exact: true }).click();
    await page.getByRole("button", { name: "Сохранить данные студии", exact: true }).click();
    await expect(page.getByText("Сохранено", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Название", { exact: true })).toHaveValue("GRAPHITE Detailing");
    await page.getByRole("link", { name: "Записи", exact: true }).click();
    await page.getByLabel("Поиск по имени, телефону или услуге").fill("E2E verification");
    await expect(page.getByText(/E2E verification/).first()).toBeVisible();
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Кабинет студии" })).toBeVisible();
  } finally {
    if (edited) {
      const restored = await request.post(`${url}/rest/v1/rpc/owner_upsert_service`, { headers, data: { p_slug: "graphite", p_service: { id: service.id, description: service.description ?? "" } } });
      expect(restored.ok(), "Restore edited service description").toBe(true);
    }
  }
});

test("public navigation and modal layout", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "GRAPHITE Detailing", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("img", { name: "Автомобиль — атмосфера студии" }).evaluate((image) => (image as HTMLImageElement).decode());
  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true, scale: "css" });
  await page.getByRole("button", { name: "Записаться", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("booking.png"), scale: "css" });
  const dialog = await page.getByRole("dialog").boundingBox();
  expect(dialog!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: "Моя запись", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Пока нет записей" })).toBeVisible();
});
