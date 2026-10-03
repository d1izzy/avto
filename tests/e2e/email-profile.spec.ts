/// <reference lib="dom" />
import { test, expect, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";

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
type Mailbox = Map<string, { status: string; code?: string; flow_id?: string }>;
type AuthCode = { challenge: string; used?: boolean };
async function mockAuth(page: Page, options: { status?: number; code?: string; unconfirmed?: boolean; userFailure?: boolean; mailbox?: Mailbox; codes?: Map<string, AuthCode> } = {}) {
  const requests: Array<{ email: string; redirect: string | null; challenge: string }> = [];
  const mailbox = options.mailbox ?? new Map();
  await page.route("**/rest/v1/rpc/email_login_handoff", async (route) => {
    const body = route.request().postDataJSON();
    if (body.p_action === "start") mailbox.set(body.p_channel, { status: "waiting" });
    if (body.p_action === "deliver") mailbox.set(body.p_channel, { status: "ready", code: body.p_code, flow_id: body.p_flow_id });
    if (body.p_action === "finish") mailbox.delete(body.p_channel);
    await route.fulfill({ json: mailbox.get(body.p_channel) ?? { status: "expired" } });
  });
  await page.route("**/auth/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/otp")) {
      requests.push({ email: route.request().postDataJSON().email, redirect: url.searchParams.get("redirect_to"), challenge: route.request().postDataJSON().code_challenge });
      await route.fulfill({ status: options.status ?? 200, headers: { "x-supabase-api-version": "2024-01-01", "access-control-expose-headers": "x-supabase-api-version" }, json: options.code ? { code: options.code, msg: "Test email error" } : {} });
    } else if (url.pathname.endsWith("/token")) {
      const { auth_code, code_verifier } = route.request().postDataJSON();
      const code = options.codes?.get(auth_code);
      if (!code || code.used || createHash("sha256").update(code_verifier ?? "").digest("base64url") !== code.challenge) {
        await route.fulfill({ status: 400, json: { code: "bad_code_verifier", msg: "Invalid or used authorization code" } });
      } else {
        code.used = true;
        const hash = new URLSearchParams(callbackHash().slice(1));
        await route.fulfill({ json: { access_token: hash.get("access_token"), refresh_token: "test-refresh-token", expires_in: 3600, token_type: "bearer", user } });
      }
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
  expect(requests[0].email).toBe(address);
  const redirect = new URL(requests[0].redirect!);
  expect(redirect.pathname).toBe(account);
  expect(redirect.searchParams.get("email_flow")).toMatch(/^[a-f0-9]{64}$/);
  expect(redirect.searchParams.get("sb_flow_id")).toMatch(/^[a-f0-9]{32}$/);
  expect(requests[0].challenge).toHaveLength(43);
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
  const requests = await mockAuth(page, { status: 429, code: "over_email_send_rate_limit" });
  await page.goto(account);
  await page.getByLabel("Почта", { exact: true }).fill(address);
  await page.getByRole("button", { name: "Получить ссылку", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Лимит отправки писем временно исчерпан");
  await expect(page.getByLabel("Почта", { exact: true })).toHaveValue(address);
  await expect(page.getByRole("button", { name: /Получить ссылку через/ })).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("Почта", { exact: true })).toHaveValue(address);
  await expect(page.getByText(/Лимит отправки писем временно исчерпан/)).toBeVisible();
  await page.clock.install(); await page.clock.fastForward(61_000);
  await expect(page.getByRole("button", { name: /Получить ссылку через .* мин/ })).toBeDisabled();
  expect(requests).toHaveLength(1);
});

test("email opened in an isolated browser signs in only the requesting app, even after reopening", async ({ page, context, browser }) => {
  test.setTimeout(60_000);
  const mailbox: Mailbox = new Map(); const codes = new Map<string, AuthCode>();
  const requests = await mockAuth(page, { mailbox, codes });
  await page.goto(account);
  await page.getByLabel("Почта", { exact: true }).fill(address);
  await page.getByRole("button", { name: "Получить ссылку", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Письмо отправлено" })).toBeVisible();
  const code = randomUUID(); codes.set(code, { challenge: requests[0].challenge });
  const callback = new URL(requests[0].redirect!); callback.searchParams.set("code", code);
  await page.close(); // sessionStorage is gone; local storage contains the pending request and PKCE verifier.
  const mailContext = await browser.newContext({ serviceWorkers: "block" });
  const mailPage = await mailContext.newPage();
  await mockAuth(mailPage, { mailbox, codes });
  await mailPage.goto(callback.href);
  await expect(mailPage.getByRole("heading", { name: "Вернитесь в приложение" })).toBeVisible();
  await expect(mailPage.getByText("Почта подтверждена", { exact: true })).toHaveCount(0);
  expect(new URL(mailPage.url()).search).toBe("");
  expect(codes.get(code)?.used).toBeFalsy(); // Browser has no verifier and cannot consume the code.
  await mailPage.screenshot({ path: test.info().outputPath("return-to-app.png"), fullPage: true });
  const reopened = await context.newPage();
  await mockAuth(reopened, { mailbox, codes });
  await reopened.goto("/s/graphite"); // PWA manifest start_url, not the previously open profile.
  await expect.poll(() => codes.get(code)?.used).toBe(true);
  await reopened.goto(account);
  await expect(reopened.getByText("Почта подтверждена", { exact: true })).toBeVisible();
  await reopened.reload();
  await expect(reopened.getByText("Почта подтверждена", { exact: true })).toBeVisible();
  await reopened.screenshot({ path: test.info().outputPath("pwa-confirmed.png"), fullPage: true });
  expect(requests).toHaveLength(1);
  await mailContext.close();
});

test("a rejected resend keeps the first link usable and the server still requires its verifier", async ({ page }) => {
  const mailbox: Mailbox = new Map(); const codes = new Map<string, AuthCode>();
  const options = { mailbox, codes, status: 200, code: undefined as string | undefined };
  const requests = await mockAuth(page, options);
  await page.goto(account);
  await page.getByLabel("Почта", { exact: true }).fill(address);
  await page.getByRole("button", { name: "Получить ссылку", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Письмо отправлено" })).toBeVisible();
  await page.clock.install(); await page.clock.fastForward(61_000);
  options.status = 429; options.code = "over_email_send_rate_limit";
  await page.getByRole("button", { name: "Отправить письмо ещё раз" }).click();
  await expect(page.getByRole("alert")).toContainText("Лимит отправки");
  const redirect = new URL(requests[0].redirect!); const code = randomUUID();
  codes.set(code, { challenge: requests[0].challenge });
  mailbox.set(redirect.searchParams.get("email_flow")!, { status: "ready", code, flow_id: redirect.searchParams.get("sb_flow_id")! });
  await expect(page.getByText("Почта подтверждена", { exact: true })).toBeVisible({ timeout: 10_000 });
  expect(codes.get(code)?.used).toBe(true);
});

test("expired confirmation stays signed out and never retries sending automatically", async ({ page }) => {
  const mailbox: Mailbox = new Map();
  const requests = await mockAuth(page, { mailbox });
  await page.goto(account);
  await page.getByLabel("Почта", { exact: true }).fill(address);
  await page.getByRole("button", { name: "Получить ссылку", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Письмо отправлено" })).toBeVisible();
  mailbox.clear();
  await expect(page.getByRole("alert")).toContainText("Время подтверждения истекло", { timeout: 10_000 });
  await expect(page.getByText("Почта подтверждена", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Время подтверждения истекло");
  expect(requests).toHaveLength(1);
});

test("the link also completes sign-in in the original browser", async ({ page }) => {
  const mailbox: Mailbox = new Map(); const codes = new Map<string, AuthCode>();
  const requests = await mockAuth(page, { mailbox, codes });
  await page.goto(account);
  await page.getByLabel("Почта", { exact: true }).fill(address);
  await page.getByRole("button", { name: "Получить ссылку", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Письмо отправлено" })).toBeVisible();
  const code = randomUUID(); codes.set(code, { challenge: requests[0].challenge });
  const callback = new URL(requests[0].redirect!); callback.searchParams.set("code", code);
  await page.goto(callback.href);
  await expect(page.getByText("Почта подтверждена", { exact: true })).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  await expect(page.getByRole("heading", { name: "Вернитесь в приложение" })).toHaveCount(0);
  await expect.poll(() => mailbox.size).toBe(0);
  await page.getByRole("button", { name: "Выйти из профиля" }).click();
  await expect(page.getByRole("button", { name: /Получить ссылку/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Не удалось передать подтверждение" })).toHaveCount(0);
});

test("a relayed code from another login cannot authenticate the requesting app", async ({ page }) => {
  const mailbox: Mailbox = new Map(); const codes = new Map<string, AuthCode>();
  const requests = await mockAuth(page, { mailbox, codes });
  await page.goto(account);
  await page.getByLabel("Почта", { exact: true }).fill(address);
  await page.getByRole("button", { name: "Получить ссылку", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Письмо отправлено" })).toBeVisible();
  const callback = new URL(requests[0].redirect!); const code = randomUUID();
  codes.set(code, { challenge: "unrelated-login-challenge" });
  mailbox.set(callback.searchParams.get("email_flow")!, { status: "ready", code, flow_id: callback.searchParams.get("sb_flow_id")! });
  await expect(page.getByRole("alert")).toContainText("Время подтверждения истекло или ссылка уже использована", { timeout: 10_000 });
  await expect(page.getByText("Почта подтверждена", { exact: true })).toHaveCount(0);
  expect(codes.get(code)?.used).toBeFalsy();
  expect(requests).toHaveLength(1);
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
