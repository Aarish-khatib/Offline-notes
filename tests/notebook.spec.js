import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

async function writeNote(page, title, body) {
  await page.getByRole("button", { name: "New note" }).click();
  await expect(page.getByLabel("Note title")).toBeFocused();
  await page.getByLabel("Note title").fill(title);
  await page.getByLabel("Note body").fill(body);
  await expect(page.getByRole("status")).toHaveText("Saved on this device.");
}

test("writes, searches and reopens notes without network access", async ({ page, context }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await writeNote(page, "Packing list", "Battery and charger.");
  await writeNote(page, "Workshop", "Bring apples.");
  const search = page.getByRole("searchbox", { name: "Search notes" });
  await search.fill("CHARGER");
  await expect(page.getByRole("button", { name: /Packing list/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Workshop/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Packing list/ }).click();
  await expect(page.getByLabel("Note body")).toHaveValue("Battery and charger.");
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: /Packing list/ })).toBeVisible();
  await page.getByRole("button", { name: /Packing list/ }).click();
  await expect(page.getByLabel("Note body")).toHaveValue("Battery and charger.");
  await page.getByLabel("Note body").fill("Battery, charger and cable.");
  await expect(page.getByRole("status")).toHaveText("Saved on this device.");
  await page.reload();
  await expect(page.getByLabel("Note body")).toHaveValue("Battery, charger and cable.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("exports, restores and deduplicates a backup without losing newer edits", async ({ page }) => {
  await page.goto("/");
  await writeNote(page, "Keep this", "Original text.");

  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const file = await downloaded;
  const buffer = await readFile(await file.path());
  const backup = JSON.parse(buffer.toString());
  expect(backup.notes).toMatchObject([{ title: "Keep this", body: "Original text." }]);

  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Delete note" }).click();
  await expect(page.getByLabel("Note body")).toHaveValue("Original text.");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Delete note" }).click();
  await expect(page.getByText("No note selected")).toBeVisible();

  const picker = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import backup" }).click();
  await (await picker).setFiles({ name: "backup.json", mimeType: "application/json", buffer });
  await expect(page.getByRole("status")).toHaveText("Imported 1 note.");
  await expect(page.getByLabel("Note body")).toHaveValue("Original text.");

  await page.getByLabel("Note body").fill("Newer text.");
  await expect(page.getByRole("status")).toHaveText("Saved on this device.");
  await page.locator("#backup").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer });
  await expect(page.getByRole("status")).toHaveText("This backup has no newer notes.");
  await page.locator("#backup").setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from("{") });
  await expect(page.getByRole("status")).toHaveText("The selected file is not valid JSON.");
  await expect(page.getByLabel("Note body")).toHaveValue("Newer text.");
  await expect(page.getByRole("button", { name: /Keep this/ })).toHaveCount(1);
});
