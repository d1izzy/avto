import { test, expect } from "@playwright/test";
test("customer booking and owner visibility", async ({ page }) => {
  test.skip(!process.env.E2E_SUPABASE_READY, "Requires seeded local Supabase");
  await page.goto("/s/graphite"); await expect(page.getByRole("heading",{level:1})).toContainText("GRAPHITE");
  await page.getByRole("link",{name:/Выбрать время/}).click(); await page.locator("button").filter({hasText:"Комплексный детейлинг"}).click();
  await page.getByLabel("Марка").fill("Volvo"); await page.getByLabel("Модель").fill("XC60"); await page.getByLabel("Имя").fill("E2E Client"); await page.getByLabel("Телефон").fill("+79990001122");
  await page.getByRole("button",{name:/Продолжить/}).click();
  const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10); await page.getByLabel("Дата").fill(tomorrow);
  const slot=page.locator("button").filter({hasText:/\d{2}:\d{2}/}).first(); await expect(slot).toBeVisible(); await slot.click(); await page.getByRole("button",{name:/Продолжить/}).click(); await page.getByRole("button",{name:/Подтвердить запись/}).click();
  await expect(page.getByText("Запись подтверждена")).toBeVisible();
});
