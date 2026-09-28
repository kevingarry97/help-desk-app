import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigationType } from "react-router";

import TicketDetailSheet from "@/components/tickets/TicketDetailSheet";
import { formatDateTime } from "@/lib/format-date";
import { useSession } from "@/lib/auth-client";
import { makeTicketAssignee, makeTicketDetail, makeUsers } from "@/test/fixtures";
import { renderWithQuery } from "@/test/render";

vi.mock("axios", () => {
  const instance = { get: vi.fn(), patch: vi.fn(), post: vi.fn() };
  return { default: { create: vi.fn(() => instance) } };
});

vi.mock("@/lib/auth-client", () => ({ useSession: vi.fn(), signOut: vi.fn() }));

const api = vi.mocked(axios, { deep: true }).create();

const AGENTS = makeUsers({ name: "Ada Lovelace" }, { name: "Grace Hopper" });

/** Drives the session states the sheet branches on. */
function signedInAs(role: "admin" | "agent") {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { id: "me", role } },
    isPending: false,
  } as unknown as ReturnType<typeof useSession>);
}

const TICKET = makeTicketDetail({
  id: "t42",
  subject: "Refund for the spring course",
  requesterEmail: "sam@example.com",
  status: "RESOLVED",
  category: "REFUND_REQUEST",
  createdAt: "2026-09-16T15:45:00.000Z",
  updatedAt: "2026-09-17T09:05:00.000Z",
  body: "Hi,\n\nI was charged twice.\n  Order #1234\n\nThanks, Sam",
});

/** Stands in for the list behind the sheet: where the router is, and how it got there. */
function ListProbe() {
  const { pathname, search } = useLocation();
  return (
    <p data-testid="location">
      {useNavigationType()} {pathname}
      {search}
    </p>
  );
}

type Entry = string | { pathname: string; search?: string; state?: unknown };

function renderSheet(entries: Entry[] = ["/tickets/t42"]) {
  return renderWithQuery(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes>
        <Route
          path="/tickets"
          element={
            <>
              <ListProbe />
              <Outlet />
            </>
          }
        >
          <Route path=":id" element={<TicketDetailSheet />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const location = () => screen.getByTestId("location").textContent;

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.patch).mockReset();
  vi.mocked(api.post).mockReset();
  signedInAs("agent");
});

describe("TicketDetailSheet", () => {
  it("asks the API for the ticket named in the URL", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: TICKET });

    renderSheet();

    await screen.findByRole("dialog", { name: TICKET.subject });
    expect(api.get).toHaveBeenCalledWith("/tickets/t42", expect.anything());
  });

  it("opens as a dialog named for the ticket, over the list", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: TICKET });

    renderSheet();

    const dialog = await screen.findByRole("dialog", { name: TICKET.subject });
    expect(within(dialog).getAllByText("Resolved").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("#T42")).toBeInTheDocument();
    expect(within(dialog).getByText("Refund Request")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "sam@example.com" })).toHaveAttribute(
      "href",
      "mailto:sam@example.com",
    );
    expect(location()).toContain("/tickets/t42");
  });

  it("shows when the ticket arrived and when it last changed", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: TICKET });

    renderSheet();
    const dialog = await screen.findByRole("dialog", { name: TICKET.subject });

    // Scoped to the summary grid: the conversation's first entry carries createdAt too.
    const meta = (label: string) => within(dialog).getByText(label).closest("div")!;

    expect(within(meta("Received")).getByText(formatDateTime(TICKET.createdAt)).closest("time"))
      .toHaveAttribute("datetime", TICKET.createdAt);
    expect(within(meta("Last updated")).getByText(formatDateTime(TICKET.updatedAt)).closest("time"))
      .toHaveAttribute("datetime", TICKET.updatedAt);
  });

  it("opens the conversation with the message exactly as it arrived", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: TICKET });

    renderSheet();
    const dialog = await screen.findByRole("dialog", { name: TICKET.subject });

    const conversation = within(dialog).getByRole("region", { name: "Conversation" });
    const first = within(conversation).getAllByRole("listitem")[0];
    expect(first.querySelector("p")?.textContent).toBe(TICKET.body);
  });

  it("is a named dialog with a skeleton, and nothing else, while the ticket loads", async () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));

    renderSheet();

    const dialog = await screen.findByRole("dialog", { name: "Loading ticket" });
    expect(dialog.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says the ticket was not found when the API answers 404", async () => {
    vi.mocked(api.get).mockRejectedValue({
      response: { status: 404, data: { error: "No ticket with id t42" } },
    });

    renderSheet();

    const dialog = await screen.findByRole("dialog", { name: "Ticket not found" });
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    expect(dialog.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0);
  });

  it("reports any other failure as an error, not as a missing ticket", async () => {
    vi.mocked(api.get).mockRejectedValue({
      response: { status: 500, data: { error: "Internal server error" } },
    });

    renderSheet();

    const dialog = await screen.findByRole("dialog", { name: "Couldn't load this ticket" });
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Internal server error");
  });

  describe("assignee", () => {
    /**
     * The picker is a Base UI Select, which jsdom cannot open — a click on the trigger never
     * reaches the listbox. These cover what renders; choosing a person is proved end to end in
     * e2e/tests/tickets-assignee.spec.ts, in a real browser.
     */
    const serveTicket = (assignee: ReturnType<typeof makeTicketAssignee> | null = null) => {
      vi.mocked(api.get).mockImplementation(async (url: string) =>
        url === "/users" ? { data: AGENTS } : { data: { ...TICKET, assignee } },
      );
    };

    const trigger = () => screen.findByRole("combobox", { name: "Assignee" });

    it("shows an agent who owns the ticket, without offering to change it", async () => {
      serveTicket(makeTicketAssignee({ name: "Grace Hopper" }));
      renderSheet();

      const dialog = await screen.findByRole("dialog", { name: TICKET.subject });
      expect(within(dialog).getByText("Grace Hopper")).toBeInTheDocument();
      expect(screen.queryByRole("combobox", { name: "Assignee" })).not.toBeInTheDocument();
    });

    it("tells an agent when nobody owns the ticket", async () => {
      serveTicket(null);
      renderSheet();

      const dialog = await screen.findByRole("dialog", { name: TICKET.subject });
      expect(within(dialog).getByText("Unassigned")).toBeInTheDocument();
      expect(screen.queryByRole("combobox", { name: "Assignee" })).not.toBeInTheDocument();
    });

    it("gives an admin a picker showing who currently owns the ticket", async () => {
      signedInAs("admin");
      serveTicket(makeTicketAssignee({ id: AGENTS[1].id, name: AGENTS[1].name }));
      renderSheet();

      await screen.findByRole("dialog", { name: TICKET.subject });
      expect(await trigger()).toHaveTextContent(AGENTS[1].name);
    });

    it("shows an admin Unassigned when nobody owns the ticket", async () => {
      signedInAs("admin");
      serveTicket(null);
      renderSheet();

      await screen.findByRole("dialog", { name: TICKET.subject });
      expect(await trigger()).toHaveTextContent("Unassigned");
    });

    it("says so when the list of people cannot be loaded", async () => {
      signedInAs("admin");
      vi.mocked(api.get).mockImplementation(async (url: string) => {
        if (url === "/users") throw { response: { status: 500, data: { error: "Nope" } } };
        return { data: { ...TICKET, assignee: null } };
      });
      renderSheet();

      await screen.findByRole("dialog", { name: TICKET.subject });

      expect(await screen.findByRole("alert")).toHaveTextContent("Nope");
      expect(screen.queryByRole("combobox", { name: "Assignee" })).not.toBeInTheDocument();
    });
  });

  describe("editing status and category", () => {
    /**
     * Same Select limitation as the assignee picker: jsdom cannot open one, so changing a value
     * and saving is proved in a real browser. These cover who gets the button and what the form
     * shows.
     */
    const serve = () => {
      vi.mocked(api.get).mockImplementation(async (url: string) =>
        url === "/users" ? { data: AGENTS } : { data: { ...TICKET, assignee: null } },
      );
    };

    it("offers no Edit button to an agent", async () => {
      serve();
      renderSheet();

      const dialog = await screen.findByRole("dialog", { name: TICKET.subject });
      expect(within(dialog).getByText("Refund Request")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    });

    it("opens a form on the ticket's current status and category for an admin", async () => {
      signedInAs("admin");
      serve();
      renderSheet();

      await screen.findByRole("dialog", { name: TICKET.subject });
      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

      expect(await screen.findByRole("combobox", { name: "Status" })).toHaveTextContent("Resolved");
      expect(screen.getByRole("combobox", { name: "Category" })).toHaveTextContent("Refund Request");
    });

    it("keeps Save disabled until something is changed", async () => {
      signedInAs("admin");
      serve();
      renderSheet();

      await screen.findByRole("dialog", { name: TICKET.subject });
      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

      expect(await screen.findByRole("button", { name: "Save" })).toBeDisabled();
    });

    it("returns to the read view on Cancel, saving nothing", async () => {
      signedInAs("admin");
      serve();
      renderSheet();

      await screen.findByRole("dialog", { name: TICKET.subject });
      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
      await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

      expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
      expect(screen.queryByRole("combobox", { name: "Status" })).not.toBeInTheDocument();
      expect(api.patch).not.toHaveBeenCalled();
    });
  });

  describe("closing", () => {
    it.each([
      ["the close button", (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole("button", { name: "Close" }))],
      ["Escape", (user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}")],
    ])("with %s returns to the list, keeping its filters", async (_label, close) => {
      const user = userEvent.setup();
      vi.mocked(api.get).mockResolvedValue({ data: TICKET });

      renderSheet(["/tickets/t42?status=RESOLVED&sort=subject&dir=asc"]);
      await screen.findByRole("dialog", { name: TICKET.subject });

      await close(user);

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(location()).toBe("REPLACE /tickets?status=RESOLVED&sort=subject&dir=asc");
    });

    it("steps back through history when the ticket was opened from the list", async () => {
      const user = userEvent.setup();
      vi.mocked(api.get).mockResolvedValue({ data: TICKET });

      renderSheet([
        "/tickets?category=REFUND_REQUEST",
        { pathname: "/tickets/t42", search: "?category=REFUND_REQUEST", state: { fromList: true } },
      ]);
      await screen.findByRole("dialog", { name: TICKET.subject });

      await user.click(screen.getByRole("button", { name: "Close" }));

      await waitFor(() => expect(location()).toBe("POP /tickets?category=REFUND_REQUEST"));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("replaces the entry for a ticket opened from a link, however its state looks", async () => {
      const user = userEvent.setup();
      vi.mocked(api.get).mockResolvedValue({ data: TICKET });

      renderSheet([{ pathname: "/tickets/t42", state: { fromList: "yes" } }]);
      await screen.findByRole("dialog", { name: TICKET.subject });

      await user.click(screen.getByRole("button", { name: "Close" }));

      await waitFor(() => expect(location()).toBe("REPLACE /tickets"));
    });
  });
});
