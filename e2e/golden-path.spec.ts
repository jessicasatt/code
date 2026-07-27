import { expect, test } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  await request.post("/api/test/reset-demo");
});

test("sign-in screen offers to continue in demo mode", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Jessica OS" })).toBeVisible();
  await page.getByRole("link", { name: "Continue in demo mode" }).click();
  await expect(page).toHaveURL(/\/today$/);
});

test("root redirects a signed-in, onboarded user straight to Today", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByText("Demo mode")).toBeVisible();
});

test("Today screen shows MRR progress, call pace, and a single next action", async ({ page }) => {
  await page.goto("/today");
  await expect(page.getByText("Next action")).toBeVisible();
  await expect(page.getByText("Current MRR / Goal")).toBeVisible();
  await expect(page.getByText("$4,250", { exact: false })).toBeVisible();
  await expect(page.getByText("Calls today", { exact: true })).toBeVisible();
});

test("bottom navigation reaches all five tabs", async ({ page }) => {
  await page.goto("/today");
  for (const [label, urlPart] of [
    ["Pipeline", "pipeline"],
    ["Patterns", "patterns"],
    ["Review", "review"],
    ["Settings", "settings"],
    ["Today", "today"],
  ] as const) {
    await page.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`/${urlPart}$`));
  }
});

test("completing onboarding from scratch reaches Today with the entered targets", async ({ page, request }) => {
  await request.post("/api/test/reset-demo?onboarded=false");
  await page.goto("/onboarding");

  await page.getByLabel("Your name").fill("Test Owner");
  await page.getByLabel("Daily call target").fill("25");
  await page.getByLabel("Weekly call target").fill("120");
  await page.getByRole("button", { name: "Complete setup" }).click();

  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByText("/ 25", { exact: false })).toBeVisible();
});

test("starting a call block and logging a result updates block progress", async ({ page }) => {
  await page.goto("/today");

  await page.getByRole("button", { name: "Start call block" }).click();
  await page.getByRole("button", { name: "Start now" }).click();

  await expect(page.getByText("Active call block")).toBeVisible();
  await expect(page.getByText("0 / 20 calls")).toBeVisible();

  await page.getByRole("button", { name: "Log quick result" }).click();
  await page.getByRole("button", { name: "Answered — meaningful conversation" }).click();

  await expect(page.getByText("1 / 20 calls")).toBeVisible();
});

test("ending an incomplete block prompts a two-tap behavioral check-in", async ({ page }) => {
  await page.goto("/today");

  await page.getByRole("button", { name: "Start call block" }).click();
  await page.getByRole("button", { name: "Start now" }).click();
  await expect(page.getByText("Active call block")).toBeVisible();

  // Tap 1: end the block before reaching its target.
  await page.getByRole("button", { name: "End call block" }).click();

  await expect(page.getByText("What interrupted the block?")).toBeVisible();
  // Tap 2: choose a reason.
  await page.getByRole("button", { name: "Distracted" }).click();

  await expect(page.getByText("Thanks — logged.")).toBeVisible();
});

test("settings changes to call targets persist across reload", async ({ page }) => {
  await page.goto("/settings");

  const dailyTargetInput = page.getByLabel("Daily call target");
  await dailyTargetInput.fill("33");
  await page.getByRole("button", { name: "Save revenue goal" }).click();
  await expect(page.getByText(/Saved at/)).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Daily call target")).toHaveValue("33");
});

test("daily review shows recorded facts and calculated metrics", async ({ page }) => {
  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "Today's review" })).toBeVisible();
  await expect(page.getByText("Calls completed")).toBeVisible();
  await expect(page.getByText("Target completion")).toBeVisible();
});
