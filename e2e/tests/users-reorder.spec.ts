import { expect, test, type Locator, type Page } from "@playwright/test";

import { adminApiContext, userRows } from "../helpers";
import { STORAGE_STATE } from "../test-env";

/**
 * The one thing about the user list that cannot be proved anywhere else: a real mouse drag,
 * driving dnd-kit's pointer sensor against real layout, whose result is still there after a
 * full page reload. A component test can assert that dropping a row calls `onReorder` with
 * the new ids; it cannot show that the order came back from Postgres.
 *
 * This spec mutates persisted state — `user.sortOrder` — and the database is reset once per
 * run, not per test. Two things keep that honest:
 *
 *   1. It reads the order it finds instead of assuming the seeded one, so a run that starts
 *      from an already-rearranged table still passes.
 *   2. `afterEach` PATCHes that original order back, so nothing downstream — another spec, a
 *      second run against the same database, a `--repeat-each` — inherits a list this spec
 *      rearranged. The restore goes through the API on purpose: it is cleanup, not the
 *      assertion, and the assertion above it has already run.
 */

/** Row ids, top to bottom. Deliberately non-waiting, so `expect.poll` can retry it. */
function readOrder(page: Page): Promise<string[]> {
  return userRows(page).evaluateAll((rows) =>
    rows.map((row) => row.getAttribute("data-user-id") ?? ""),
  );
}

/**
 * dnd-kit's PointerSensor ignores the first 6px of travel, and the sortable strategy reads
 * intermediate positions to work out what the row is over — a single jump to the destination
 * moves nothing at all. So: press, a short nudge to cross the activation distance, then a
 * stepped move to the target.
 */
async function dragHandleTo(page: Page, handle: Locator, targetY: number) {
  const box = await handle.boundingBox();
  if (!box) throw new Error("The drag handle has no bounding box — did the row render?");

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, targetY > y ? y + 20 : y - 20, { steps: 5 });
  await page.mouse.move(x, targetY, { steps: 12 });
  await page.mouse.up();
}

test.describe("reordering the user directory as an admin", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  let orderToRestore: string[] = [];

  test.afterEach(async ({ playwright }) => {
    if (orderToRestore.length === 0) return;

    const admin = await adminApiContext(playwright);
    const response = await admin.patch("/api/users/order", { data: { ids: orderToRestore } });
    orderToRestore = [];

    // Asserted rather than ignored: a restore that silently 401s or 409s would leave the
    // next run starting from a list this spec rearranged, with nothing to show for it.
    expect(response.ok()).toBe(true);
    await admin.dispose();
  });

  test("a row dragged past its neighbour keeps its new position after a reload", async ({
    page,
  }) => {
    await page.goto("/users");

    const rows = userRows(page);

    // Two seeded accounts and no way to make a third — sign-up is disabled. The second row
    // is the one the first gets dragged past.
    await expect(rows.nth(1)).toBeVisible();

    orderToRestore = await readOrder(page);
    const [first, second, ...rest] = orderToRestore;
    const swapped = [second!, first!, ...rest];

    // Registered before the drag: the reload below must not race the write it depends on.
    const saved = page.waitForResponse(
      (response) =>
        response.url().includes("/api/users/order") &&
        response.request().method() === "PATCH",
    );

    const target = await rows.nth(1).boundingBox();
    if (!target) throw new Error("The second row has no bounding box.");

    await dragHandleTo(
      page,
      rows.nth(0).getByRole("button", { name: /^Reorder / }),
      // Past the neighbour's centre. `restrictToParentElement` clamps the row to the list,
      // so aiming beyond the drop point is safe and leaves margin for row height changes.
      target.y + target.height * 0.75,
    );

    // The list updates optimistically, so this proves only that the drop was registered.
    await expect.poll(() => readOrder(page)).toEqual(swapped);

    const response = await saved;
    expect(response.status()).toBe(200);

    await page.reload();

    // New document, new query cache, no optimistic state: this order can only have come
    // back from GET /api/users, which means the drag was stored.
    await expect(rows.nth(1)).toBeVisible();
    await expect.poll(() => readOrder(page)).toEqual(swapped);
  });
});
