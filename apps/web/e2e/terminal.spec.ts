import { test, expect } from "@playwright/test";

/**
 * End-to-end smoke test of the full real-data flow:
 *   register (or login) -> dashboard with live tickers -> chart -> place a
 *   paper order -> see the position -> create an alert -> sign out.
 *
 * A unique email per run keeps the test idempotent against a persistent DB.
 */
const stamp = Date.now();
const email = `e2e_${stamp}@obsidian.test`;
const password = "playwright-strong-pass";

test.describe.configure({ mode: "serial" });

test("register and land on the dashboard with live markets", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Markets" })).toBeVisible();
  // A real ticker row exists.
  await expect(page.getByText("BTC", { exact: false }).first()).toBeVisible();
});

test("add a custom market to the watchlist", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Add market" }).click();
  await page.getByPlaceholder(/Search markets/).fill("DOGE");
  await page.getByRole("button", { name: /DOGE.*USDT.*Add/s }).first().click();
  // DOGE now appears in the watchlist and persists across a reload.
  await expect(page.getByText("DOGE", { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.reload();
  await expect(page.getByText("DOGE", { exact: false }).first()).toBeVisible();
});

test("open the chart, toggle indicators, and draw a level", async ({ page }) => {
  await login(page);
  await page.goto("/chart?symbol=BTCUSDT&tf=15m");
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });

  // Overlay toggles and sub-panes are present.
  await page.getByRole("button", { name: "BB", exact: true }).click();
  await page.getByRole("button", { name: "VWAP", exact: true }).click();
  await page.getByRole("button", { name: "STOCH", exact: true }).click();
  await page.getByRole("button", { name: "ATR", exact: true }).click();

  // Draw a horizontal level and confirm it persists across a reload.
  await page.getByRole("button", { name: "H-Line", exact: true }).click();
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (box) await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.4);
  await page.waitForTimeout(1500);
  await page.reload();
  // The Clear button is enabled only when at least one drawing exists.
  await expect(page.getByRole("button", { name: "Clear" })).toBeEnabled({
    timeout: 15_000,
  });
});

test("place a paper order and see an open position", async ({ page }) => {
  await login(page);
  await page.goto("/trade");
  await expect(page.getByRole("heading", { name: "Paper trading" })).toBeVisible();

  // Wait for a live price to populate, then buy.
  await expect(page.getByText("Live price")).toBeVisible();
  await page.getByLabel(/Quantity/).fill("0.01");
  await page.getByRole("button", { name: /Buy \/ Long/ }).click();

  // The order toast and the new position both appear.
  await expect(page.getByText(/Order filled|Bought/).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "Long" }).first()).toBeVisible({
    timeout: 20_000,
  });
});

test("close the position with one click", async ({ page }) => {
  await login(page);
  await page.goto("/trade");
  // A position from the previous test exists; close it.
  const closeBtn = page.getByRole("button", { name: /Close .* position/ }).first();
  await expect(closeBtn).toBeVisible({ timeout: 20_000 });
  await closeBtn.click();
  // After closing, the empty-state for positions appears.
  await expect(page.getByText("No open positions")).toBeVisible({ timeout: 20_000 });
  // The equity-curve panel is present on the trade page.
  await expect(page.getByText("Equity curve")).toBeVisible();
});

test("create a price alert", async ({ page }) => {
  await login(page);
  await page.goto("/alerts");
  await page.getByLabel("Price").fill("1");
  // price_above 1 will be true immediately for BTC; that's fine for the test.
  await page.getByRole("button", { name: "Create alert" }).click();
  await expect(page.getByText(/Alert created|Watching|Triggered/).first()).toBeVisible();
});

test("sign out returns to login", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /Account menu/i }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
});

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
