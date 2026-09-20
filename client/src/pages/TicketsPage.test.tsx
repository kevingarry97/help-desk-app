import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import {
  TICKET_GROUP_PAGE_PARAM,
  TICKET_GROUP_PAGE_SIZE,
  TICKET_STATUS_ORDER,
  type TicketStatus,
} from "core/constants/ticket";
import type { TicketGroup, TicketListItem } from "core/schemas/tickets";

import { formatDateTime } from "@/lib/format-date";
import { ticketReference } from "@/lib/ticket-reference";
import TicketsPage from "@/pages/TicketsPage";
import { makeTicket, makeTickets } from "@/test/fixtures";
import { renderWithQuery } from "@/test/render";

vi.mock("axios", () => {
  const instance = { get: vi.fn() };
  return { default: { create: vi.fn(() => instance) } };
});

const api = vi.mocked(axios, { deep: true }).create();

type Params = Record<string, unknown>;

/** Answers GET /tickets/by-status the way the server does: one page per status section. */
function groupsFrom(tickets: TicketListItem[], params: Params = {}): TicketGroup[] {
  const statuses = params.status ? [params.status as TicketStatus] : TICKET_STATUS_ORDER;
  const size = TICKET_GROUP_PAGE_SIZE;

  return statuses.map((status) => {
    const matching = tickets.filter((ticket) => ticket.status === status);
    const pageCount = Math.max(1, Math.ceil(matching.length / size));
    const page = Math.min(Number(params[TICKET_GROUP_PAGE_PARAM[status]] ?? 1), pageCount);

    return {
      status,
      total: matching.length,
      page,
      pageSize: size,
      tickets: matching.slice((page - 1) * size, page * size),
    };
  });
}

function serve(tickets: TicketListItem[] | ((params: Params) => TicketListItem[])) {
  vi.mocked(api.get).mockImplementation(async (_url, config) => {
    const params = (config?.params ?? {}) as Params;
    const list = typeof tickets === "function" ? tickets(params) : tickets;
    return { data: { groups: groupsFrom(list, params) } } as never;
  });
}

// Newest first, the way GET /api/tickets sends them.
const TICKETS = makeTickets(
  {
    subject: "Refund for the spring course",
    requesterEmail: "sam@example.com",
    status: "OPEN",
    category: "REFUND_REQUEST",
    createdAt: "2026-09-16T15:45:00.000Z",
  },
  {
    subject: "Video lessons will not play",
    requesterEmail: "lee@example.com",
    status: "RESOLVED",
    category: "TECHNICAL_QUESTION",
    createdAt: "2026-09-15T08:10:00.000Z",
  },
  {
    subject: "When does enrolment close?",
    requesterEmail: "kim@example.com",
    status: "CLOSED",
    category: "GENERAL_QUESTION",
    createdAt: "2026-09-12T19:00:00.000Z",
  },
);

beforeEach(() => {
  vi.mocked(api.get).mockReset();
});

/** Prints the query string, so a test can see what the filters wrote to the URL. */
function LocationProbe() {
  return <p data-testid="location-search">{useLocation().search}</p>;
}

/** Stands in for the detail page: says which ticket opened, and what the list handed it. */
function DetailProbe() {
  const { pathname, state } = useLocation();
  return (
    <>
      <h1>Detail for {pathname}</h1>
      <p data-testid="detail-state">{JSON.stringify(state)}</p>
    </>
  );
}

function renderPage(url = "/tickets") {
  return renderWithQuery(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/tickets"
          element={
            <>
              <TicketsPage />
              <LocationProbe />
            </>
          }
        >
          <Route path=":id" element={<DetailProbe />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const rows = () => screen.getAllByTestId("ticket-row");
const rowIds = (scope: HTMLElement = document.body) =>
  within(scope).getAllByTestId("ticket-row").map((row) => row.dataset.ticketId);
const section = (name: string) => screen.getByRole("region", { name: `${name} tickets` });
const sectionOrder = () => screen.getAllByTestId("ticket-group").map((group) => group.dataset.status);
const rowFor = (subject: string) => screen.getByText(subject).closest("tr") as HTMLElement;

// The skeleton has no text or role of its own, so it is counted through shadcn's data-slot
// contract rather than its Tailwind classes, which change with any restyle.
const skeletons = (container: HTMLElement) => container.querySelectorAll('[data-slot="skeleton"]');

describe("TicketsPage", () => {
  it("asks the API for the ticket list", async () => {
    serve(TICKETS);

    renderPage();

    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(api.get).toHaveBeenCalledWith("/tickets/by-status", expect.anything());
  });

  describe("grouping by status", () => {
    // Newest first overall, statuses interleaved — the way the API really sends them.
    const MIXED = makeTickets(
      { subject: "Closed newest", status: "CLOSED" },
      { subject: "Open newer", status: "OPEN" },
      { subject: "Resolved only", status: "RESOLVED" },
      { subject: "Open older", status: "OPEN" },
    );

    it("puts tickets into Open, Resolved and Closed sections, in that order", async () => {
      serve(MIXED);

      renderPage();

      await waitFor(() => expect(rows()).toHaveLength(4));
      expect(sectionOrder()).toEqual(["OPEN", "RESOLVED", "CLOSED"]);
      expect(rowIds(section("Open"))).toEqual(["t2", "t4"]);
      expect(rowIds(section("Resolved"))).toEqual(["t3"]);
      expect(rowIds(section("Closed"))).toEqual(["t1"]);
    });

    it("keeps the API's newest-first order inside a section", async () => {
      serve(MIXED);

      renderPage();

      await waitFor(() => expect(rows()).toHaveLength(4));
      const open = within(section("Open")).getAllByRole("link").map((link) => link.textContent);
      expect(open).toEqual(["Open newer", "Open older"]);
    });

    it("heads each section with its status and how many tickets it holds", async () => {
      serve(makeTickets({ status: "OPEN" }, { status: "OPEN" }, { status: "RESOLVED" }));

      renderPage();

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(screen.getByRole("button", { name: "Open, 2 tickets", expanded: true })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Resolved, 1 ticket", expanded: true })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Closed, 0 tickets" })).toBeDisabled();
    });

    it("collapses a section and opens it again", async () => {
      const user = userEvent.setup();
      serve(MIXED);

      renderPage();
      await waitFor(() => expect(rows()).toHaveLength(4));

      await user.click(screen.getByRole("button", { name: "Open, 2 tickets" }));

      expect(screen.getByRole("button", { name: "Open, 2 tickets", expanded: false })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Resolved only" })).toBeVisible();
      expect(screen.getByText("Open newer")).not.toBeVisible();

      await user.click(screen.getByRole("button", { name: "Open, 2 tickets" }));

      expect(screen.getByRole("link", { name: "Open newer" })).toBeVisible();
    });

    it("shows only the chosen status's section when filtered by status", async () => {
      serve(makeTickets({ subject: "Resolved only", status: "RESOLVED" }));

      renderPage("/tickets?status=RESOLVED");

      expect(await screen.findByRole("link", { name: "Resolved only" })).toBeInTheDocument();
      expect(sectionOrder()).toEqual(["RESOLVED"]);
    });
  });

  it("says the list is grouped by status and sortable", () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Tickets" })).toBeInTheDocument();
    expect(screen.getByText(/by status\. Sort by any column/)).toBeInTheDocument();
  });

  it("shows each ticket's reference, subject, requester, category and when it arrived", async () => {
    serve(TICKETS);

    renderPage();

    await waitFor(() => expect(rows()).toHaveLength(3));
    const row = within(rowFor("Refund for the spring course"));

    expect(row.getByText(ticketReference("t1"))).toBeInTheDocument();
    expect(row.getByText("sam@example.com")).toBeInTheDocument();
    expect(row.getByText("Refund request")).toBeInTheDocument();

    const received = row.getByText(formatDateTime("2026-09-16T15:45:00.000Z"));
    expect(received.closest("time")).toHaveAttribute("datetime", "2026-09-16T15:45:00.000Z");
  });

  it("labels every status and category in words, not as stored values", async () => {
    serve(TICKETS);

    renderPage();

    await waitFor(() => expect(rows()).toHaveLength(3));

    expect(within(section("Resolved")).getByText("Video lessons will not play")).toBeInTheDocument();
    expect(within(rowFor("Video lessons will not play")).getByText("Technical question")).toBeInTheDocument();
    expect(within(section("Closed")).getByText("When does enrolment close?")).toBeInTheDocument();
    expect(within(rowFor("When does enrolment close?")).getByText("General question")).toBeInTheDocument();
    expect(screen.queryByText(/TECHNICAL_QUESTION|RESOLVED/)).not.toBeInTheDocument();
  });

  it("shows a dash rather than crashing on a date it cannot read", async () => {
    serve(makeTickets({ subject: "Odd timestamp", createdAt: "not a date" }));

    renderPage();

    expect(await screen.findByText("Odd timestamp")).toBeInTheDocument();
    expect(within(rowFor("Odd timestamp")).getByText("—")).toBeInTheDocument();
  });

  it("shows a skeleton, not an empty queue, while the list is still loading", () => {
    // Never settles: the page stays in its pending branch. The bug this guards is the page
    // flashing "No tickets yet" before the first response, which reads as an empty queue.
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Tickets" })).toBeInTheDocument();
    expect(skeletons(container).length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId("ticket-row")).toHaveLength(0);
    expect(screen.queryByText("No tickets yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("replaces the skeleton with the rows once they arrive", async () => {
    serve(TICKETS);

    const { container } = renderPage();

    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(skeletons(container)).toHaveLength(0);
    expect(screen.queryByText("No tickets yet")).not.toBeInTheDocument();
  });

  it("says so when there are no tickets, instead of drawing an empty table", async () => {
    serve([]);

    const { container } = renderPage();

    expect(await screen.findByText("No tickets yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(skeletons(container)).toHaveLength(0);
  });

  it("reports a failed load, with no skeleton, rows or empty state left behind", async () => {
    vi.mocked(api.get).mockRejectedValue({
      response: { status: 500, data: { error: "Internal server error" } },
    });

    const { container } = renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Internal server error");
    expect(skeletons(container)).toHaveLength(0);
    expect(screen.queryAllByTestId("ticket-row")).toHaveLength(0);
    expect(screen.queryByText("No tickets yet")).not.toBeInTheDocument();
  });

  describe("opening a ticket", () => {
    it("links each subject to that ticket, carrying the list's query string", async () => {
      serve(TICKETS);

      renderPage();

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(screen.getByRole("link", { name: "Video lessons will not play" })).toHaveAttribute(
        "href",
        "/tickets/t2",
      );
    });

    it("opens the ticket when its row is clicked", async () => {
      const user = userEvent.setup();
      serve(TICKETS);

      renderPage();
      await waitFor(() => expect(rows()).toHaveLength(3));

      await user.click(screen.getByRole("link", { name: "Refund for the spring course" }));

      expect(await screen.findByRole("heading", { name: "Detail for /tickets/t1" })).toBeInTheDocument();
    });

    it("keeps the current filters in the ticket's URL, and marks it as opened from the list", async () => {
      const user = userEvent.setup();
      serve(TICKETS);

      renderPage("/tickets?status=OPEN");

      await user.click(await screen.findByRole("link", { name: "Refund for the spring course" }));

      await screen.findByRole("heading", { name: "Detail for /tickets/t1" });
      expect(screen.getByTestId("location-search")).toHaveTextContent("?status=OPEN");
      expect(screen.getByTestId("detail-state")).toHaveTextContent('{"fromList":true}');
    });
  });

  describe("filtering", () => {
    const statusGroup = () => screen.getByRole("group", { name: "Status" });
    const categoryGroup = () => screen.getByRole("group", { name: "Category" });
    const lastParams = () => vi.mocked(api.get).mock.lastCall?.[1]?.params;
    const search = () => screen.getByTestId("location-search").textContent;

    it("offers every status and category, with All chosen for both by default", async () => {
      serve(TICKETS);

      renderPage();

      await waitFor(() => expect(rows()).toHaveLength(3));

      for (const name of ["Open", "Resolved", "Closed"]) {
        expect(within(statusGroup()).getByRole("button", { name, pressed: false })).toBeInTheDocument();
      }
      for (const name of ["General question", "Technical question", "Refund request"]) {
        expect(within(categoryGroup()).getByRole("button", { name, pressed: false })).toBeInTheDocument();
      }
      expect(within(statusGroup()).getByRole("button", { name: "All", pressed: true })).toBeInTheDocument();
      expect(within(categoryGroup()).getByRole("button", { name: "All", pressed: true })).toBeInTheDocument();
    });

    it("asks for every ticket when no filter is chosen", async () => {
      serve(TICKETS);

      renderPage();

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(lastParams()).toEqual({});
      expect(search()).toBe("");
    });

    it("asks the API for the chosen status and records it in the URL", async () => {
      const user = userEvent.setup();
      serve(TICKETS);

      renderPage();
      await waitFor(() => expect(rows()).toHaveLength(3));

      await user.click(within(statusGroup()).getByRole("button", { name: "Resolved" }));

      await waitFor(() => expect(lastParams()).toEqual({ status: "RESOLVED" }));
      expect(search()).toBe("?status=RESOLVED");
      expect(within(statusGroup()).getByRole("button", { name: "Resolved", pressed: true })).toBeInTheDocument();
      expect(within(statusGroup()).getByRole("button", { name: "All", pressed: false })).toBeInTheDocument();
    });

    it("combines a status and a category", async () => {
      const user = userEvent.setup();
      serve(TICKETS);

      renderPage();
      await waitFor(() => expect(rows()).toHaveLength(3));

      await user.click(within(statusGroup()).getByRole("button", { name: "Open" }));
      await user.click(within(categoryGroup()).getByRole("button", { name: "Refund request" }));

      await waitFor(() =>
        expect(lastParams()).toEqual({ status: "OPEN", category: "REFUND_REQUEST" }),
      );
      expect(search()).toBe("?status=OPEN&category=REFUND_REQUEST");
    });

    it("starts from the filters in the URL", async () => {
      serve(TICKETS);

      renderPage("/tickets?status=CLOSED&category=TECHNICAL_QUESTION");

      await waitFor(() => expect(rows()).toHaveLength(1));
      expect(vi.mocked(api.get).mock.calls[0]?.[1]?.params).toEqual({
        status: "CLOSED",
        category: "TECHNICAL_QUESTION",
      });
      expect(within(statusGroup()).getByRole("button", { name: "Closed", pressed: true })).toBeInTheDocument();
      expect(
        within(categoryGroup()).getByRole("button", { name: "Technical question", pressed: true }),
      ).toBeInTheDocument();
    });

    it("treats an unknown value in the URL as no filter, rather than failing the request", async () => {
      serve(TICKETS);

      renderPage("/tickets?status=bogus");

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(lastParams()).toEqual({});
      expect(within(statusGroup()).getByRole("button", { name: "All", pressed: true })).toBeInTheDocument();
    });

    it.each([
      ["All", "All"],
      ["the chosen status again", "Open"],
    ])("goes back to every ticket when %s is clicked", async (_label, button) => {
      const user = userEvent.setup();
      serve(TICKETS);

      renderPage("/tickets?status=OPEN");
      await waitFor(() => expect(rows()).toHaveLength(1));

      await user.click(within(statusGroup()).getByRole("button", { name: button }));

      await waitFor(() => expect(search()).toBe(""));
      expect(lastParams()).toEqual({});
      expect(within(statusGroup()).getByRole("button", { name: "All", pressed: true })).toBeInTheDocument();
    });

    it("says nothing matches, and offers to clear the filters, when a filter finds no tickets", async () => {
      const user = userEvent.setup();
      serve((params) => (params.status ? [] : TICKETS));

      renderPage("/tickets?status=CLOSED&category=REFUND_REQUEST");

      expect(await screen.findByText("No tickets match these filters")).toBeInTheDocument();
      expect(screen.queryByText("No tickets yet")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Clear filters" }));

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(search()).toBe("");
      expect(lastParams()).toEqual({});
    });

    it("keeps the current rows on screen, marked busy, while a new filter loads", async () => {
      const user = userEvent.setup();
      vi.mocked(api.get)
        .mockResolvedValueOnce({ data: { groups: groupsFrom(TICKETS) } })
        .mockReturnValueOnce(new Promise(() => {}));

      const { container } = renderPage();
      await waitFor(() => expect(rows()).toHaveLength(3));

      await user.click(within(statusGroup()).getByRole("button", { name: "Closed" }));

      await waitFor(() => expect(lastParams()).toEqual({ status: "CLOSED" }));
      expect(rowIds()).toEqual(["t1", "t2", "t3"]);
      expect(screen.getAllByRole("table")[0].closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
      expect(skeletons(container)).toHaveLength(0);
    });
  });

  describe("searching", () => {
    const searchBox = () => screen.getByRole("searchbox", { name: "Search tickets" });
    const search = () => screen.getByTestId("location-search").textContent;
    const paramsSent = () =>
      vi.mocked(api.get).mock.calls.map((call) => call[1]?.params as { q?: string } | undefined);

    it("applies the search once typing pauses, not on every keystroke", async () => {
      const user = userEvent.setup();
      serve(TICKETS);

      renderPage();
      await waitFor(() => expect(rows()).toHaveLength(3));

      await user.type(searchBox(), "refund");

      await waitFor(() => expect(search()).toBe("?q=refund"));
      await waitFor(() => expect(paramsSent()).toContainEqual({ q: "refund" }));
      expect(paramsSent().filter((params) => params?.q)).toEqual([{ q: "refund" }]);
    });

    it("sends the search along with the filters", async () => {
      const user = userEvent.setup();
      serve(TICKETS);

      renderPage("/tickets?status=OPEN");
      await waitFor(() => expect(rows()).toHaveLength(1));

      await user.type(searchBox(), "  sam  ");

      await waitFor(() => expect(paramsSent()).toContainEqual({ status: "OPEN", q: "sam" }));
      expect(search()).toBe("?status=OPEN&q=sam");
    });

    it("starts from the search in the URL", async () => {
      serve(TICKETS);

      renderPage("/tickets?q=sam");

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(searchBox()).toHaveValue("sam");
      expect(paramsSent()[0]).toEqual({ q: "sam" });
    });

    it.each([
      ["the clear button", async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole("button", { name: "Clear search" }))],
      ["Escape", async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(searchBox());
        await user.keyboard("{Escape}");
      }],
    ])("clears the search with %s", async (_label, clear) => {
      const user = userEvent.setup();
      serve(TICKETS);

      renderPage("/tickets?q=sam");
      await waitFor(() => expect(rows()).toHaveLength(3));

      await clear(user);

      await waitFor(() => expect(search()).toBe(""));
      expect(searchBox()).toHaveValue("");
      expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
    });

    it("says nothing matches a search, and Clear filters empties the search box too", async () => {
      const user = userEvent.setup();
      serve((params) => (params.q ? [] : TICKETS));

      renderPage("/tickets?q=nothing-like-this");

      expect(await screen.findByText("No tickets match these filters")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Clear filters" }));

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(search()).toBe("");
      expect(searchBox()).toHaveValue("");
    });
  });

  describe("sorting", () => {
    const header = (name: string, group = "Open") =>
      within(section(group)).getByRole("columnheader", { name });
    const sortBy = (name: string) => within(header(name)).getByRole("button", { name });
    const lastParams = () => vi.mocked(api.get).mock.lastCall?.[1]?.params;
    const firstParams = () => vi.mocked(api.get).mock.calls[0]?.[1]?.params;
    const search = () => screen.getByTestId("location-search").textContent;

    it("starts newest first, marked on Received, with Status left out of the columns", async () => {
      serve(TICKETS);

      renderPage();
      await waitFor(() => expect(rows()).toHaveLength(3));

      expect(within(section("Open")).getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
        "Ref",
        "Ticket",
        "Category",
        "Received",
      ]);
      expect(header("Received")).toHaveAttribute("aria-sort", "descending");
      expect(header("Ticket")).toHaveAttribute("aria-sort", "none");
      expect(header("Category")).toHaveAttribute("aria-sort", "none");
      expect(header("Ref")).not.toHaveAttribute("aria-sort");
      expect(within(header("Ref")).queryByRole("button")).not.toBeInTheDocument();
      expect(lastParams()).toEqual({});
    });

    it("asks the server to sort by subject A–Z, then Z–A on a second click", async () => {
      const user = userEvent.setup();
      serve(TICKETS);

      renderPage();
      await waitFor(() => expect(rows()).toHaveLength(3));

      await user.click(sortBy("Ticket"));

      await waitFor(() => expect(lastParams()).toEqual({ sort: "subject", dir: "asc" }));
      expect(search()).toBe("?sort=subject&dir=asc");
      expect(header("Ticket")).toHaveAttribute("aria-sort", "ascending");
      expect(header("Received")).toHaveAttribute("aria-sort", "none");

      await user.click(sortBy("Ticket"));

      await waitFor(() => expect(lastParams()).toEqual({ sort: "subject", dir: "desc" }));
      expect(header("Ticket")).toHaveAttribute("aria-sort", "descending");
    });

    it("never drops back to no sort: a third click flips the direction again", async () => {
      const user = userEvent.setup();
      serve(TICKETS);

      renderPage();
      await waitFor(() => expect(rows()).toHaveLength(3));

      await user.click(sortBy("Category"));
      await user.click(sortBy("Category"));
      await user.click(sortBy("Category"));

      await waitFor(() => expect(header("Category")).toHaveAttribute("aria-sort", "ascending"));
      expect(lastParams()).toEqual({ sort: "category", dir: "asc" });
    });

    it("sorts received oldest first, and back to newest first without any parameters", async () => {
      const user = userEvent.setup();
      serve(TICKETS);

      renderPage();
      await waitFor(() => expect(rows()).toHaveLength(3));

      await user.click(sortBy("Received"));
      await waitFor(() => expect(lastParams()).toEqual({ sort: "createdAt", dir: "asc" }));
      expect(header("Received")).toHaveAttribute("aria-sort", "ascending");

      await user.click(sortBy("Received"));
      await waitFor(() => expect(search()).toBe(""));
      expect(lastParams()).toEqual({});
      expect(header("Received")).toHaveAttribute("aria-sort", "descending");
    });

    it("sorts category A–Z first", async () => {
      const user = userEvent.setup();
      serve(TICKETS);

      renderPage();
      await waitFor(() => expect(rows()).toHaveLength(3));

      await user.click(sortBy("Category"));

      await waitFor(() => expect(lastParams()).toEqual({ sort: "category", dir: "asc" }));
    });

    it("shows rows in whatever order the server sorted them", async () => {
      const user = userEvent.setup();
      const [zebra, apple] = makeTickets(
        { subject: "Zebra crossing permit", status: "OPEN" },
        { subject: "Apple Pay declined", status: "OPEN" },
      );
      serve((params) => (params.sort === "subject" ? [apple, zebra] : [zebra, apple]));

      renderPage();
      await waitFor(() => expect(rowIds(section("Open"))).toEqual(["t1", "t2"]));

      await user.click(sortBy("Ticket"));

      await waitFor(() => expect(rowIds(section("Open"))).toEqual(["t2", "t1"]));
    });

    it("starts from the sort in the URL", async () => {
      serve(TICKETS);

      renderPage("/tickets?sort=category&dir=desc");
      await waitFor(() => expect(rows()).toHaveLength(3));

      expect(firstParams()).toEqual({ sort: "category", dir: "desc" });
      expect(header("Category")).toHaveAttribute("aria-sort", "descending");
      expect(header("Received")).toHaveAttribute("aria-sort", "none");
    });

    it("treats an unknown sort in the URL as the default", async () => {
      serve(TICKETS);

      renderPage("/tickets?sort=bogus&dir=sideways");
      await waitFor(() => expect(rows()).toHaveLength(3));

      expect(firstParams()).toEqual({});
      expect(header("Received")).toHaveAttribute("aria-sort", "descending");
    });

    it("keeps the filters and search when the sort changes", async () => {
      const user = userEvent.setup();
      serve(TICKETS);

      renderPage("/tickets?status=OPEN&q=sam");
      await waitFor(() => expect(rows()).toHaveLength(1));

      await user.click(sortBy("Ticket"));

      await waitFor(() =>
        expect(lastParams()).toEqual({ status: "OPEN", q: "sam", sort: "subject", dir: "asc" }),
      );
      expect(search()).toBe("?status=OPEN&q=sam&sort=subject&dir=asc");
    });

    it("keeps the sort when filters are cleared", async () => {
      const user = userEvent.setup();
      serve((params) => (params.q ? [] : TICKETS));

      renderPage("/tickets?q=nothing&sort=subject&dir=desc");

      await user.click(await screen.findByRole("button", { name: "Clear filters" }));

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(search()).toBe("?sort=subject&dir=desc");
      expect(header("Ticket")).toHaveAttribute("aria-sort", "descending");
    });
  });

  describe("paging each status section", () => {
    const many = (count: number, status: TicketStatus, prefix: string) =>
      Array.from({ length: count }, (_, index) =>
        makeTicket({ id: `${prefix}${index + 1}`, subject: `${prefix} ${index + 1}`, status }),
      );
    const QUEUE = [...many(23, "OPEN", "open"), ...many(12, "RESOLVED", "resolved"), ...many(4, "CLOSED", "closed")];

    const pages = (label: string) => screen.getByRole("navigation", { name: `${label} tickets pages` });
    const next = (label: string) =>
      within(pages(label)).getByRole("button", { name: `Next page of ${label.toLowerCase()} tickets` });
    const previous = (label: string) =>
      within(pages(label)).getByRole("button", { name: `Previous page of ${label.toLowerCase()} tickets` });
    const lastParams = () => vi.mocked(api.get).mock.lastCall?.[1]?.params;
    const search = () => screen.getByTestId("location-search").textContent;

    it("shows one page per section, headed by the section's full count", async () => {
      serve(QUEUE);

      renderPage();

      await waitFor(() => expect(rows()).toHaveLength(10 + 10 + 4));
      expect(rowIds(section("Open"))).toHaveLength(10);
      expect(screen.getByRole("button", { name: "Open, 23 tickets" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Resolved, 12 tickets" })).toBeInTheDocument();
      expect(within(pages("Open")).getByText("1–10 of 23")).toBeInTheDocument();
      expect(within(pages("Open")).getByText("Page 1 of 3")).toBeInTheDocument();
      expect(previous("Open")).toBeDisabled();
      expect(next("Open")).toBeEnabled();
    });

    it("offers no page controls to a section that fits on one page", async () => {
      serve(QUEUE);

      renderPage();
      await waitFor(() => expect(rows()).toHaveLength(24));

      expect(within(section("Closed")).getAllByTestId("ticket-row")).toHaveLength(4);
      expect(within(section("Closed")).queryByRole("navigation")).not.toBeInTheDocument();
    });

    it("pages one section without moving the others", async () => {
      const user = userEvent.setup();
      serve(QUEUE);

      renderPage();
      await waitFor(() => expect(rows()).toHaveLength(24));

      await user.click(next("Open"));

      await waitFor(() => expect(rowIds(section("Open"))[0]).toBe("open11"));
      expect(search()).toBe("?openPage=2");
      expect(lastParams()).toEqual({ openPage: 2 });
      expect(rowIds(section("Resolved"))[0]).toBe("resolved1");
      expect(within(pages("Open")).getByText("11–20 of 23")).toBeInTheDocument();
      expect(previous("Open")).toBeEnabled();
    });

    it("stops at the last page, and steps back to the first without a page parameter", async () => {
      const user = userEvent.setup();
      serve(QUEUE);

      renderPage("/tickets?resolvedPage=2");
      await waitFor(() => expect(within(pages("Resolved")).getByText("11–12 of 12")).toBeInTheDocument());

      expect(rowIds(section("Resolved"))).toEqual(["resolved11", "resolved12"]);
      expect(next("Resolved")).toBeDisabled();

      await user.click(previous("Resolved"));

      await waitFor(() => expect(search()).toBe(""));
      expect(rowIds(section("Resolved"))[0]).toBe("resolved1");
    });

    it("shows the page the server settled on when the URL asks for one past the end", async () => {
      serve(QUEUE);

      renderPage("/tickets?openPage=99");

      await waitFor(() => expect(within(pages("Open")).getByText("Page 3 of 3")).toBeInTheDocument());
      expect(rowIds(section("Open"))).toEqual(["open21", "open22", "open23"]);
    });

    it.each([
      ["sorting", "sort=subject", async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(within(section("Open")).getByRole("columnheader", { name: "Ticket" }).querySelector("button")!)],
      ["a status filter", "status=OPEN", async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(within(screen.getByRole("group", { name: "Status" })).getByRole("button", { name: "Open" }))],
      ["a category filter", "category=REFUND_REQUEST", async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(within(screen.getByRole("group", { name: "Category" })).getByRole("button", { name: "Refund request" }))],
      ["a search", "q=open", async (user: ReturnType<typeof userEvent.setup>) =>
        user.type(screen.getByRole("searchbox", { name: "Search tickets" }), "open")],
    ])("sends every section back to its first page on %s", async (_label, applied, change) => {
      const user = userEvent.setup();
      serve(QUEUE);

      renderPage("/tickets?openPage=3&resolvedPage=2");
      await waitFor(() => expect(within(pages("Open")).getByText("Page 3 of 3")).toBeInTheDocument());
      expect(search()).toContain("openPage=3");

      await change(user);

      await waitFor(() => expect(search()).toContain(applied));
      expect(search()).not.toMatch(/openPage|resolvedPage/);
      expect(lastParams()).not.toHaveProperty("openPage", 3);
      expect(lastParams()).not.toHaveProperty("resolvedPage", 2);
    });

    it("clears every section's page along with the filters", async () => {
      const user = userEvent.setup();
      serve((params) => (params.q ? [] : QUEUE));

      renderPage("/tickets?q=nothing&openPage=2&closedPage=1");

      await user.click(await screen.findByRole("button", { name: "Clear filters" }));

      await waitFor(() => expect(search()).toBe(""));
      expect(rowIds(section("Open"))[0]).toBe("open1");
    });
  });
});
