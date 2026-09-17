import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

import { formatDateTime } from "@/lib/format-date";
import { ticketReference } from "@/lib/ticket-reference";
import TicketsPage from "@/pages/TicketsPage";
import { makeTickets } from "@/test/fixtures";
import { renderWithQuery } from "@/test/render";

vi.mock("axios", () => {
  const instance = { get: vi.fn() };
  return { default: { create: vi.fn(() => instance) } };
});

const api = vi.mocked(axios, { deep: true }).create();

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
        />
        <Route path="/tickets/:id" element={<DetailProbe />} />
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
    vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

    renderPage();

    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(api.get).toHaveBeenCalledWith("/tickets", expect.anything());
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
      vi.mocked(api.get).mockResolvedValue({ data: MIXED });

      renderPage();

      await waitFor(() => expect(rows()).toHaveLength(4));
      expect(sectionOrder()).toEqual(["OPEN", "RESOLVED", "CLOSED"]);
      expect(rowIds(section("Open"))).toEqual(["t2", "t4"]);
      expect(rowIds(section("Resolved"))).toEqual(["t3"]);
      expect(rowIds(section("Closed"))).toEqual(["t1"]);
    });

    it("keeps the API's newest-first order inside a section", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: MIXED });

      renderPage();

      await waitFor(() => expect(rows()).toHaveLength(4));
      const open = within(section("Open")).getAllByRole("link").map((link) => link.textContent);
      expect(open).toEqual(["Open newer", "Open older"]);
    });

    it("heads each section with its status and how many tickets it holds", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: makeTickets({ status: "OPEN" }, { status: "OPEN" }, { status: "RESOLVED" }) });

      renderPage();

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(screen.getByRole("button", { name: "Open, 2 tickets", expanded: true })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Resolved, 1 ticket", expanded: true })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Closed, 0 tickets" })).toBeDisabled();
    });

    it("collapses a section and opens it again", async () => {
      const user = userEvent.setup();
      vi.mocked(api.get).mockResolvedValue({ data: MIXED });

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
      vi.mocked(api.get).mockResolvedValue({ data: makeTickets({ subject: "Resolved only", status: "RESOLVED" }) });

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
    vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

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
    vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

    renderPage();

    await waitFor(() => expect(rows()).toHaveLength(3));

    expect(within(section("Resolved")).getByText("Video lessons will not play")).toBeInTheDocument();
    expect(within(rowFor("Video lessons will not play")).getByText("Technical question")).toBeInTheDocument();
    expect(within(section("Closed")).getByText("When does enrolment close?")).toBeInTheDocument();
    expect(within(rowFor("When does enrolment close?")).getByText("General question")).toBeInTheDocument();
    expect(screen.queryByText(/TECHNICAL_QUESTION|RESOLVED/)).not.toBeInTheDocument();
  });

  it("shows a dash rather than crashing on a date it cannot read", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: makeTickets({ subject: "Odd timestamp", createdAt: "not a date" }),
    });

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
    vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

    const { container } = renderPage();

    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(skeletons(container)).toHaveLength(0);
    expect(screen.queryByText("No tickets yet")).not.toBeInTheDocument();
  });

  it("says so when there are no tickets, instead of drawing an empty table", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });

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
    it("links each subject to that ticket's page", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

      renderPage();

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(screen.getByRole("link", { name: "Video lessons will not play" })).toHaveAttribute(
        "href",
        "/tickets/t2",
      );
    });

    it("opens the ticket when its row is clicked", async () => {
      const user = userEvent.setup();
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

      renderPage();
      await waitFor(() => expect(rows()).toHaveLength(3));

      await user.click(screen.getByRole("link", { name: "Refund for the spring course" }));

      expect(await screen.findByRole("heading", { name: "Detail for /tickets/t1" })).toBeInTheDocument();
    });

    it("hands the current filters to the ticket page, so it can link back to them", async () => {
      const user = userEvent.setup();
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

      renderPage("/tickets?status=OPEN");

      await user.click(await screen.findByRole("link", { name: "Refund for the spring course" }));

      await screen.findByRole("heading", { name: "Detail for /tickets/t1" });
      expect(screen.getByTestId("detail-state")).toHaveTextContent('{"listSearch":"?status=OPEN"}');
    });
  });

  describe("filtering", () => {
    const statusGroup = () => screen.getByRole("group", { name: "Status" });
    const categoryGroup = () => screen.getByRole("group", { name: "Category" });
    const lastParams = () => vi.mocked(api.get).mock.lastCall?.[1]?.params;
    const search = () => screen.getByTestId("location-search").textContent;

    it("offers every status and category, with All chosen for both by default", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

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
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

      renderPage();

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(lastParams()).toEqual({});
      expect(search()).toBe("");
    });

    it("asks the API for the chosen status and records it in the URL", async () => {
      const user = userEvent.setup();
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

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
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

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
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

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
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

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
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

      renderPage("/tickets?status=OPEN");
      await waitFor(() => expect(rows()).toHaveLength(1));

      await user.click(within(statusGroup()).getByRole("button", { name: button }));

      await waitFor(() => expect(search()).toBe(""));
      expect(lastParams()).toEqual({});
      expect(within(statusGroup()).getByRole("button", { name: "All", pressed: true })).toBeInTheDocument();
    });

    it("says nothing matches, and offers to clear the filters, when a filter finds no tickets", async () => {
      const user = userEvent.setup();
      // Filtered requests find nothing; the unfiltered one finds everything.
      vi.mocked(api.get).mockImplementation(async (_url, config) => {
        const filtered = (config?.params as { status?: string } | undefined)?.status;
        return { data: filtered ? [] : TICKETS } as never;
      });

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
        .mockResolvedValueOnce({ data: TICKETS })
        .mockReturnValueOnce(new Promise(() => {}));

      const { container } = renderPage();
      await waitFor(() => expect(rows()).toHaveLength(3));

      await user.click(within(statusGroup()).getByRole("button", { name: "Closed" }));

      await waitFor(() => expect(lastParams()).toEqual({ status: "CLOSED" }));
      expect(rowIds()).toEqual(["t3"]);
      expect(screen.getByRole("table").closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
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
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

      renderPage();
      await waitFor(() => expect(rows()).toHaveLength(3));

      await user.type(searchBox(), "refund");

      await waitFor(() => expect(search()).toBe("?q=refund"));
      await waitFor(() => expect(paramsSent()).toContainEqual({ q: "refund" }));
      expect(paramsSent().filter((params) => params?.q)).toEqual([{ q: "refund" }]);
    });

    it("sends the search along with the filters", async () => {
      const user = userEvent.setup();
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

      renderPage("/tickets?status=OPEN");
      await waitFor(() => expect(rows()).toHaveLength(1));

      await user.type(searchBox(), "  sam  ");

      await waitFor(() => expect(paramsSent()).toContainEqual({ status: "OPEN", q: "sam" }));
      expect(search()).toBe("?status=OPEN&q=sam");
    });

    it("starts from the search in the URL", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

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
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

      renderPage("/tickets?q=sam");
      await waitFor(() => expect(rows()).toHaveLength(3));

      await clear(user);

      await waitFor(() => expect(search()).toBe(""));
      expect(searchBox()).toHaveValue("");
      expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
    });

    it("says nothing matches a search, and Clear filters empties the search box too", async () => {
      const user = userEvent.setup();
      vi.mocked(api.get).mockImplementation(async (_url, config) => {
        const q = (config?.params as { q?: string } | undefined)?.q;
        return { data: q ? [] : TICKETS } as never;
      });

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
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

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
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

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
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

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
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

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
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

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
      vi.mocked(api.get).mockImplementation(async (_url, config) => {
        const sort = (config?.params as { sort?: string } | undefined)?.sort;
        return { data: sort === "subject" ? [apple, zebra] : [zebra, apple] } as never;
      });

      renderPage();
      await waitFor(() => expect(rowIds(section("Open"))).toEqual(["t1", "t2"]));

      await user.click(sortBy("Ticket"));

      await waitFor(() => expect(rowIds(section("Open"))).toEqual(["t2", "t1"]));
    });

    it("starts from the sort in the URL", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

      renderPage("/tickets?sort=category&dir=desc");
      await waitFor(() => expect(rows()).toHaveLength(3));

      expect(firstParams()).toEqual({ sort: "category", dir: "desc" });
      expect(header("Category")).toHaveAttribute("aria-sort", "descending");
      expect(header("Received")).toHaveAttribute("aria-sort", "none");
    });

    it("treats an unknown sort in the URL as the default", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

      renderPage("/tickets?sort=bogus&dir=sideways");
      await waitFor(() => expect(rows()).toHaveLength(3));

      expect(firstParams()).toEqual({});
      expect(header("Received")).toHaveAttribute("aria-sort", "descending");
    });

    it("keeps the filters and search when the sort changes", async () => {
      const user = userEvent.setup();
      vi.mocked(api.get).mockResolvedValue({ data: TICKETS });

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
      vi.mocked(api.get).mockImplementation(async (_url, config) => {
        const q = (config?.params as { q?: string } | undefined)?.q;
        return { data: q ? [] : TICKETS } as never;
      });

      renderPage("/tickets?q=nothing&sort=subject&dir=desc");

      await user.click(await screen.findByRole("button", { name: "Clear filters" }));

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(search()).toBe("?sort=subject&dir=desc");
      expect(header("Ticket")).toHaveAttribute("aria-sort", "descending");
    });
  });
});
