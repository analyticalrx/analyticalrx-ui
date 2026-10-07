import { test, expect } from "@playwright/test";

const roles = ["owner", "bookkeeper", "technician", "store_manager", "pharmacist", "compliance_admin", "business_development", "tenant_admin", "internal_platform_admin"];

async function openWorkspace(page, role = "owner") {
  // Browser-only fixtures: no credentials, signing secrets or backend changes.
  await page.route("**/api/auth/session", (route) => route.fulfill({
    json: { user: {
      userId: "responsive-test", displayName: "Alexandra Longname Pharmacy Administrator",
      role, roles, tenantId: "tenant-with-a-long-identifier-for-layout-checks",
      expiresAt: Math.floor(Date.now() / 1000) + 1800,
    } },
  }));
  await page.addInitScript(() => sessionStorage.setItem("analyticalrx_access_token", "browser-test-fixture"));
  await page.goto(`/${role}`);
  await expect(page.locator(".role-dashboard h1")).toBeVisible();
}

async function noPageOverflow(page) {
  // Allow the drawer transition and browser resize layout to settle.
  await expect.poll(async () => page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
      - document.documentElement.clientWidth
  )).toBeLessThanOrEqual(1);
}

async function navigate(page, section) {
  if (await page.getByRole("button", { name: "Open navigation" }).isVisible()) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page.getByRole("button", { name: section, exact: true }).click();
}

test("login fits narrow and landscape screens with readable input sizing", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email address")).toBeVisible();
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await noPageOverflow(page);
    const fontSize = await page.getByLabel("Email address").evaluate((input) => parseFloat(getComputedStyle(input).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(16);
    await page.getByLabel("Email address").fill("mobile@example.com");
    await page.getByRole("button", { name: "Sign in", exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeInViewport();
  }
});

test("all role dashboards fit and their record dialogs remain usable", async ({ page }, testInfo) => {
  await openWorkspace(page);
  for (const role of roles) {
    await page.goto(`/${role}`);
    await expect(page.locator(".role-dashboard h1")).toBeVisible();
    await noPageOverflow(page);
    await page.getByRole("button", { name: "Show sample data" }).click();
    await noPageOverflow(page);
    if (role === "owner") await page.screenshot({ path: testInfo.outputPath("owner-dashboard.png"), fullPage: true });
    const region = page.locator(".dashboard-records .table-scroll");
    const bounds = await region.evaluate((element) => ({ width: element.clientWidth, content: element.scrollWidth }));
    expect(bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
    await page.locator(".dashboard-row-button").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close record details" })).toBeInViewport();
    await noPageOverflow(page);
    await dialog.getByRole("button", { name: "Close record details" }).click();
  }
});

test("dashboard adapts from 320px to ultrawide and landscape widths", async ({ page }) => {
  await openWorkspace(page);
  await page.getByRole("button", { name: "Show sample data" }).click();
  for (const [width, height] of [[320,568], [360,740], [390,844], [768,1024], [844,390], [1024,768], [1100,800], [1366,768], [1920,1080], [2560,1440]]) {
    await page.setViewportSize({ width, height });
    await noPageOverflow(page);
    await expect(page.getByRole("button", { name: "Hide sample data" })).toBeVisible();
    const controls = await page.locator(".dashboard-filters input, .dashboard-filters select").evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    }));
    for (const control of controls) {
      expect(control.left).toBeGreaterThanOrEqual(0);
      expect(control.right).toBeLessThanOrEqual(width + 1);
      expect(control.width).toBeGreaterThan(100);
    }
  }
});

test("mobile drawer locks background, traps focus, closes and handles rotation", async ({ page }) => {
  await openWorkspace(page);
  await page.setViewportSize({ width: 390, height: 500 });
  await page.evaluate(() => window.scrollTo(0, 300));
  const scrollY = await page.evaluate(() => window.scrollY);
  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  const drawer = page.getByRole("dialog", { name: "Workspace navigation" });
  await expect(drawer).toBeVisible();
  await expect(page.locator(".main-area")).toHaveAttribute("inert", "");
  await expect(drawer.getByRole("button", { name: "Close navigation" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(drawer.getByRole("button", { name: "Sign out" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(drawer.getByRole("button", { name: "Close navigation" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  await menu.click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".main-area")).not.toHaveAttribute("inert", "");
  await expect(page.locator(".sidebar")).toBeVisible();
  expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
});

test("user forms, long draft values and CSV previews fit mobile screens", async ({ page }, testInfo) => {
  await openWorkspace(page);
  await navigate(page, "User management");
  await page.getByLabel("User name", { exact: true }).fill("A long pharmacy staff member name".repeat(3));
  await page.getByLabel("User email", { exact: true }).fill("long-address-for-responsive-check@example.com");
  await page.getByLabel("User ID", { exact: true }).fill("staff-identifier-".repeat(6));
  await page.getByRole("button", { name: "Add to draft list", exact: true }).click();
  await expect(page.locator(".users-list tbody tr")).toHaveCount(1);
  await page.getByLabel("Choose a CSV file").setInputFiles({
    name: "responsive-preview.csv", mimeType: "text/csv",
    buffer: Buffer.from("user_name,email,user_id,password,role\nSample Technician,technician@example.com,tech-002,,technician"),
  });
  await expect(page.getByRole("heading", { name: "1 users ready for review" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("user-management.png"), fullPage: true });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await noPageOverflow(page);
  }
  await page.getByRole("button", { name: "Add 1 users to draft list" }).click();
  await expect(page.locator(".users-list tbody tr")).toHaveCount(2);
});

test("workflow preview wraps on phones and tablets without hiding actions", async ({ page }, testInfo) => {
  await openWorkspace(page);
  await navigate(page, /^Automations/);
  await page.screenshot({ path: testInfo.outputPath("workflow-preview.png"), fullPage: true });
  for (const [width, height] of [[320,568], [390,844], [844,390], [1024,768], [1100,800], [1440,900]]) {
    await page.setViewportSize({ width, height });
    await noPageOverflow(page);
    await expect(page.getByRole("button", { name: "Publish changes" })).toBeVisible();
    const step = await page.locator(".flow-step").first().boundingBox();
    expect(step.x).toBeGreaterThanOrEqual(0);
    expect(step.x + step.width).toBeLessThanOrEqual(width + 1);
  }
  await page.getByRole("button", { name: "Test workflow" }).click();
  await expect(page.getByRole("status")).toContainText("Test completed");
});
