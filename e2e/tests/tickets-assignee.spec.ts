import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";

import { adminApiContext, createTicketByApi, uniqueTag } from "../helpers";
import { ADMIN, AGENT, STORAGE_STATE } from "../test-env";

/**
 * Assigning a ticket to a user. Component tests already cover what the detail sheet renders —
 * the agent's read-only line, the admin's picker, its loading, error and in-flight states —
 * against a mocked API, and ticketListWhere is unit-tested as a plain object. None of that
 * touches the guard on PATCH /api/tickets/:id/assignee, Postgres, or the foreign key.
 *
 * What is here, and why each needs the real stack:
 *
 *   - The role boundary, with real session cookies. AdminRoute and TicketAssignee only decide
 *     what renders; requireRole(Role.Admin) on that one route is the boundary, and only an
 *     agent's cookie against the running server can show it holding — and holding *there*
 *     rather than on the router, since the same agent still reads and moves the ticket.
 *   - A click in the browser reaching Postgres: the choice is still pressed after a reload,
 *     with a new document and an empty query cache.
 *   - `?assignee=me|none`, proved on the API response. The list groups rows into status
 *     sections in the browser, so a server that ignored the parameter would look the same on
 *     screen — the same reason status filtering is asserted on the response (see
 *     e2e/tests/README.md and tickets-filters.spec.ts).
 *   - `onDelete: SetNull`. Nothing but a real delete against a real foreign key can show that
 *     the ticket outlives the person it was assigned to.
 *
 * Three open tickets are made once for the file — one assigned to the admin, one to the agent,
 * one left unassigned — so each filter below has a row it must keep and two it must drop. The
 * database resets once per run, not per test, so every assertion reads only the rows carrying
 * this run's tag, and tests that mutate something else (a throwaway account) clean it up.
 */

type Listed = { id: string; subject: string };

let tag = "";
let adminId = "";
let agentId = "";
let assignedToAdmin = "";
let assignedToAgent = "";
let unassigned = "";

const sorted = (...ids: string[]) => [...ids].sort();

function patchAssignee(
  api: APIRequestContext,
  ticketId: string,
  assigneeId: string | null,
): Promise<APIResponse> {
  return api.patch(`/api/tickets/${ticketId}/assignee`, { data: { assigneeId } });
}

/** Setup rather than behaviour under test, so it fails the test unless the write landed. */
async function assign(api: APIRequestContext, ticketId: string, assigneeId: string) {
  const response = await patchAssignee(api, ticketId, assigneeId);

  expect(response.status(), `expected to assign ${ticketId} to ${assigneeId}`).toBe(200);
}

/** The seeded accounts' ids, read from the admin-only directory the picker itself loads. */
async function userIdByEmail(api: APIRequestContext, email: string): Promise<string> {
  const response = await api.get("/api/users");
  expect(response.status(), "GET /api/users with the admin's session").toBe(200);

  const users = (await response.json()) as { id: string; email: string }[];
  const user = users.find((candidate) => candidate.email === email);

  expect(user, `no seeded account for ${email}`).toBeTruthy();

  return user!.id;
}

/** This run's tickets in the response to GET /api/tickets with `params`, sorted. */
async function taggedIds(
  api: APIRequestContext,
  params: Record<string, string>,
): Promise<string[]> {
  const response = await api.get("/api/tickets", { params });
  expect(response.status(), `GET /api/tickets ${JSON.stringify(params)}`).toBe(200);

  const tickets = (await response.json()) as Listed[];

  return tickets
    .filter((ticket) => ticket.subject.includes(tag))
    .map((ticket) => ticket.id)
    .sort();
}

test.beforeAll(async ({ playwright }) => {
  tag = uniqueTag();
  const api = await adminApiContext(playwright);

  try {
    adminId = await userIdByEmail(api, ADMIN.email);
    agentId = await userIdByEmail(api, AGENT.email);

    const create = (owner: string) =>
      createTicketByApi(api, {
        subject: `Assignee e2e ${owner} ${tag}`,
        requesterEmail: `assignee.${owner}.${tag}@example.com`,
        category: "GENERAL_QUESTION",
        status: "OPEN",
      });

    assignedToAdmin = await create("admin");
    assignedToAgent = await create("agent");
    unassigned = await create("nobody");

    await assign(api, assignedToAdmin, adminId);
    await assign(api, assignedToAgent, agentId);
  } finally {
    await api.dispose();
  }
});

test.describe("the assignee boundary, signed in as an agent", () => {
  test.use({ storageState: STORAGE_STATE.agent });

  test("an agent is refused the assignee route while an admin assigns and unassigns", async ({
    page,
    playwright,
  }) => {
    const ownTag = uniqueTag();
    const id = await createTicketByApi(page.request, {
      subject: `Assignee boundary e2e ${ownTag}`,
      requesterEmail: `assignee.boundary.${ownTag}@example.com`,
      category: "GENERAL_QUESTION",
      status: "OPEN",
    });

    // page.request, not the bare fixture: it carries the browser's own session cookie, which
    // is what makes this the real agent rather than an anonymous caller (who would get 401).
    const refused = await patchAssignee(page.request, id, agentId);
    expect(refused.status(), "the agent's PATCH of the assignee").toBe(403);

    const afterRefusal = await page.request.get(`/api/tickets/${id}`);
    expect(afterRefusal.status(), "the agent can still read the ticket").toBe(200);
    expect(await afterRefusal.json(), "the refusal wrote nothing").toMatchObject({
      assignee: null,
    });

    // The guard is on this one route, not on ticketsRouter: the same cookie still moves status.
    const moved = await page.request.patch(`/api/tickets/${id}`, { data: { status: "RESOLVED" } });
    expect(moved.status(), "the agent can still change the status").toBe(200);

    // Control: the same call with an admin cookie. Without it this test would still pass if
    // the route were unmounted, or broken for everyone.
    const api = await adminApiContext(playwright);

    try {
      const assigned = await patchAssignee(api, id, agentId);
      expect(assigned.status(), "the admin's PATCH of the assignee").toBe(200);

      const ticket = (await assigned.json()) as { assignee: Record<string, unknown> };
      expect(ticket).toMatchObject({
        id,
        assignee: { id: agentId, name: AGENT.name, email: AGENT.email },
      });
      expect(
        Object.keys(ticket.assignee).sort(),
        "the embedded assignee carries only the four public fields",
      ).toEqual(["email", "id", "image", "name"]);
      expect(ticket, "the detail must not carry the messageId").not.toHaveProperty("messageId");

      const cleared = await patchAssignee(api, id, null);
      expect(cleared.status(), "unassigning").toBe(200);
      expect(await cleared.json()).toMatchObject({ id, assignee: null });
    } finally {
      await api.dispose();
    }
  });

  test("?assignee=me is the signed-in agent's own tickets", async ({ page }) => {
    // The premise: all three of this run's tickets are visible to the agent unfiltered, so
    // the two that disappear below were removed by the filter rather than never stored.
    expect(await taggedIds(page.request, {}), "unfiltered").toEqual(
      sorted(assignedToAdmin, assignedToAgent, unassigned),
    );

    // "me" resolves on the server to whoever is asking — the same parameter answers with the
    // admin's ticket below, so this cannot be a constant or a client-side guess.
    expect(await taggedIds(page.request, { assignee: "me" }), "assigned to the agent").toEqual([
      assignedToAgent,
    ]);
  });
});

test.describe("assigning tickets, signed in as an admin", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  /** Set while a throwaway account exists, so a failed test cannot leave one behind. */
  let throwawayUserId = "";

  test.afterEach(async ({ playwright }) => {
    if (!throwawayUserId) return;

    const api = await adminApiContext(playwright);
    const response = await api.delete(`/api/users/${throwawayUserId}`);
    throwawayUserId = "";
    await api.dispose();

    expect([204, 404], "cleaning up the throwaway account").toContain(response.status());
  });

  test("a person chosen in the detail sheet is still chosen after a reload", async ({ page }) => {
    const ownTag = uniqueTag();
    const subject = `Assignee sheet e2e ${ownTag}`;
    const id = await createTicketByApi(page.request, {
      subject,
      requesterEmail: `assignee.sheet.${ownTag}@example.com`,
      category: "TECHNICAL_QUESTION",
      status: "OPEN",
    });

    // Searched down to this run's ticket: a status section pages at 10, and the tickets other
    // specs leave behind would otherwise push this one off the first page.
    await page.goto(`/tickets?q=${ownTag}`);
    await page.getByRole("link", { name: subject }).click();
    await expect(page).toHaveURL(`/tickets/${id}?q=${ownTag}`);

    const picker = page
      .getByRole("dialog", { name: subject })
      .getByRole("group", { name: "Assignee" });
    const agentOption = picker.getByRole("button", { name: AGENT.email });

    await expect(
      picker.getByRole("button", { name: "Unassigned" }),
      "a new ticket starts unassigned",
    ).toHaveAttribute("aria-pressed", "true");

    // Registered before the click: the reload below must not race the write it depends on.
    const saved = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/tickets/${id}/assignee`) &&
        response.request().method() === "PATCH",
    );

    await agentOption.click();

    expect((await saved).status(), "the click assigned the ticket").toBe(200);
    await expect(agentOption, "the agent is chosen").toHaveAttribute("aria-pressed", "true");

    await page.reload();

    // New document, new query cache, no component state: this can only have come back from
    // GET /api/tickets/:id, which means the click reached Postgres.
    const afterReload = page
      .getByRole("dialog", { name: subject })
      .getByRole("group", { name: "Assignee" });

    await expect(
      afterReload.getByRole("button", { name: AGENT.email }),
      "the agent is still chosen after the reload",
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      afterReload.getByRole("button", { name: "Unassigned" }),
      "and Unassigned is not",
    ).toHaveAttribute("aria-pressed", "false");
  });

  test("?assignee=me and ?assignee=none narrow the list, and an unknown value is refused", async ({
    page,
  }) => {
    expect(await taggedIds(page.request, {}), "unfiltered").toEqual(
      sorted(assignedToAdmin, assignedToAgent, unassigned),
    );

    expect(await taggedIds(page.request, { assignee: "me" }), "assigned to the admin").toEqual([
      assignedToAdmin,
    ]);
    expect(await taggedIds(page.request, { assignee: "none" }), "assigned to nobody").toEqual([
      unassigned,
    ]);

    // The endpoint the page actually reads, narrowed to this run by the same search the
    // browser uses, so the filter is shown to apply to every status section's page.
    const grouped = await page.request.get("/api/tickets/by-status", {
      params: { assignee: "none", q: tag },
    });
    expect(grouped.status(), "GET /api/tickets/by-status?assignee=none").toBe(200);

    const { groups } = (await grouped.json()) as { groups: { tickets: Listed[] }[] };
    expect(
      groups.flatMap((group) => group.tickets.map((ticket) => ticket.id)).sort(),
      "every section holds only the unassigned ticket",
    ).toEqual([unassigned]);

    const bogus = await page.request.get("/api/tickets", { params: { assignee: "bogus" } });
    expect(bogus.status(), "assignee=bogus").toBe(400);
    expect(await bogus.json()).toMatchObject({ error: "Invalid query parameters" });
  });

  test("a ticket outlives the person it was assigned to, unassigned", async ({ page }) => {
    const ownTag = uniqueTag();
    const email = `assignee.temp.${ownTag}@e2e.test`;

    const created = await page.request.post("/api/users", {
      data: {
        name: `Temp Assignee ${ownTag}`,
        email,
        password: "temp-assignee-password",
        role: "agent",
      },
    });
    expect(created.status(), "created a throwaway account to assign and then delete").toBe(201);

    const { id: userId } = (await created.json()) as { id: string };
    throwawayUserId = userId;

    const ticketId = await createTicketByApi(page.request, {
      subject: `Assignee cascade e2e ${ownTag}`,
      requesterEmail: `assignee.cascade.${ownTag}@example.com`,
      category: "REFUND_REQUEST",
      status: "OPEN",
    });

    const assigned = await patchAssignee(page.request, ticketId, userId);
    expect(assigned.status(), "assigned to the throwaway account").toBe(200);
    expect(await assigned.json()).toMatchObject({ assignee: { id: userId, email } });

    const deleted = await page.request.delete(`/api/users/${userId}`);
    expect(deleted.status(), "deleted the assignee's account").toBe(204);
    throwawayUserId = "";

    // onDelete: SetNull — the row is cleared, not cascaded away with its assignee.
    const after = await page.request.get(`/api/tickets/${ticketId}`);
    expect(after.status(), "the ticket survives its assignee").toBe(200);
    expect(await after.json()).toMatchObject({ id: ticketId, assignee: null });

    // And it is gone from the directory, so the 200 above is not a stale read.
    const directory = await page.request.get("/api/users");
    expect(directory.status()).toBe(200);
    const users = (await directory.json()) as { id: string }[];
    expect(
      users.map((user) => user.id),
      "the deleted account is gone",
    ).not.toContain(userId);
  });
});
