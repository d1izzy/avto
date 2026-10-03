/// <reference lib="dom" />
import { test, expect, type Page } from "@playwright/test";

// PWA network interception would bypass page.route and send fixture JWTs to the live API.
test.use({ serviceWorkers: "block" });

const account = "/s/graphite/account";
const address = "customer@example.com";
const user = {
  id: "a08b965b-22a1-4aca-93c2-701121f400dd", aud: "authenticated", role: "authenticated", email: address,
  email_confirmed_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [],
};
function callbackHash() {
  const now = Math.floor(Date.now() / 1000);
  const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: user.id, exp: now + 3600, iat: now, role: "authenticated" })).toString("base64url"), "test-signature"].join(".");
  return `#${new URLSearchParams({ access_token: token, refresh_token: "test-refresh-token", expires_in: "3600", expires_at: String(now + 3600), token_type: "bearer", type: "magiclink" })}`;
}
async function mockAuth(page: Page, options: { status?: number; code?: string; unconfirmed?: boolean; userFailure?: boolean } = {}) {
  const requests: Array<{ email: string; redirect: string | null }> = [];
  await page.route("**/auth/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/otp")) {
      requests.push({ email: route.request().postDataJSON().email, redirect: url.searchParams.get("redirect_to") });
      await route.fulfill({ status: options.status ?? 200, headers: { "x-supabase-api-version": "2024-01-01", "access-control-expose-headers": "x-supabase-api-version" }, json: options.code ? { code: options.code, msg: "Test email error" } : {} });
    } else if (url.pathname.endsWith("/user")) {
      await route.fulfill({ status: options.userFailure ? 503 : 200, json: options.userFailure ? { msg: "Unavailable" } : { ...user, email_confirmed_at: options.unconfirmed ? undefined : user.email_confirmed_at } });
    } else if (url.pathname.endsWith("/logout")) {
      await route.fulfill({ status: 204 });
    } else { await route.abort(); }
  });
  // Public studio data still comes from the real API, without the fixture's fake JWT.
  await page.route("**/rest/v1/rpc/get_public_tenant", async (route) => {
    const headers = { ...route.request().headers() };
    delete headers.authorization;
    await route.fulfill({ response: await route.fetch({ headers }) });
  });
  await page.route("**/rest/v1/rpc/customer_saved_bookings", (route) => route.fulfill({ json: [] }));
  await page.route("**/rest/v1/customer_profiles**", (route) => route.fulfill({ json: null }));
  return requests;
}

test("email request shows a persistent pending screen, cooldown and change-address action", async ({ page }) => {
  const requests = await mockAuth(page);
  await page.goto(account);
  await page.getByLabel("Почта", { exact: true }).fill(address);
  await page.getByRole("button", { name: "Получить ссылку", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Письмо отправлено" })).toBeVisible();
  await expect(page.getByText(address, { exact: true })).toBeVisible();
  await expect(page.getByText("Почта подтверждена", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Отправить повторно через/ })).toBeDisabled();
  expect(requests).toEqual([{ email: address, redirect: new URL(account, test.info().project.use.baseURL).href }]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Письмо отправлено" })).toBeVisible();
  expect(requests).toHaveLength(1);
  await page.getByRole("button", { name: "Изменить адрес почты" }).click();
  await expect(page.getByLabel("Почта", { exact: true })).toHaveValue(address);
  await page.getByLabel("Почта", { exact: true }).fill("corrected@example.com");
  // Advance the cooldown stored for this test tab; no real mail is ever sent.
  await page.clock.install(); await page.clock.fastForward(61_000);
  await page.getByRole("button", { name: "Получить ссылку", exact: true }).click();
  await expect(page.getByText("corrected@example.com", { exact: true })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("email-pending.png"), fullPage: true });
});

test("email confirmation callback opens a verified profile, persists it and signs out", async ({ page }) => {
  await mockAuth(page);
  // The mocked Auth server verifies the link. This tests the app, not delivery to an inbox.
  await page.goto(`${account}${callbackHash()}`);
  await expect(page.getByText("Почта подтверждена", { exact: true })).toBeVisible();
  await expect(page.getByText(address, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Сохранить профиль" })).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe("");
  await page.screenshot({ path: test.info().outputPath("email-confirmed.png"), fullPage: true });
  await page.getByRole("button", { name: "Редактировать данные" }).click();
  await expect(page.getByRole("button", { name: "Сохранить профиль" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Почта подтверждена", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Выйти из профиля" }).click();
  await expect(page.getByRole("button", { name: "Получить ссылку", exact: true })).toBeVisible();
  await expect(page.getByText("Почта подтверждена", { exact: true })).toHaveCount(0);
});

test("callback through site root arrives in the profile", async ({ page }) => {
  await mockAuth(page);
  await page.goto(`/${callbackHash()}`);
  await expect(page.getByText("Почта подтверждена", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${account}$`));
});

test("expired link and rejected delivery never report successful confirmation", async ({ page }) => {
  await mockAuth(page, { status: 403, code: "email_address_not_authorized" });
  await page.goto(`${account}#error=access_denied&error_code=otp_expired&error_description=expired`);
  await expect(page.getByRole("alert")).toContainText("Ссылка для входа недействительна");
  await page.getByLabel("Почта", { exact: true }).fill(address);
  await page.getByRole("button", { name: "Получить ссылку", exact: true }).click();
  await expect(page.getByText(/Сейчас отправка писем недоступна/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Письмо отправлено" })).toHaveCount(0);
  await expect(page.getByText("Почта подтверждена", { exact: true })).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe("");
});

test("rate limiting shows a retry explanation and preserves the address", async ({ page }) => {
  await mockAuth(page, { status: 429, code: "over_email_send_rate_limit" });
  await page.goto(account);
  await page.getByLabel("Почта", { exact: true }).fill(address);
  await page.getByRole("button", { name: "Получить ссылку", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Слишком много запросов");
  await expect(page.getByLabel("Почта", { exact: true })).toHaveValue(address);
  await expect(page.getByRole("button", { name: /Получить ссылку через/ })).toBeDisabled();
});

test("an unconfirmed account is not labelled as verified", async ({ page }) => {
  await mockAuth(page, { unconfirmed: true });
  await page.goto(`${account}${callbackHash()}`);
  await expect(page.getByRole("alert")).toContainText("Почта ещё не подтверждена");
  await expect(page.getByText("Почта подтверждена", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Редактировать данные" })).toHaveCount(0);
});

test("existing real account is verified by Auth and can read its saved profile", async ({ page }) => {
  test.skip(!process.env.E2E_OWNER_EMAIL || !process.env.E2E_OWNER_PASSWORD, "Requires explicit test credentials; sends no email");
  await page.goto("/s/graphite/owner");
  await page.getByLabel("Почта", { exact: true }).fill(process.env.E2E_OWNER_EMAIL!);
  await page.getByLabel("Пароль", { exact: true }).fill(process.env.E2E_OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Обзор студии" })).toBeVisible();
  await page.goto(account);
  await expect(page.getByText("Почта подтверждена", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Редактировать данные" }).click();
  await expect(page.getByRole("button", { name: "Сохранить профиль" })).toBeVisible();
  await page.getByRole("button", { name: "Выйти из профиля" }).click();
  await expect(page.getByRole("button", { name: "Получить ссылку", exact: true })).toBeVisible();
});
