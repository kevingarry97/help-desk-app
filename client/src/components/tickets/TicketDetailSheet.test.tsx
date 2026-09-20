import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigationType } from "react-router";

import TicketDetailSheet from "@/components/tickets/TicketDetailSheet";
import { formatDateTime } from "@/lib/format-date";
import { makeTicketDetail } from "@/test/fixtures";
import { renderWithQuery } from "@/test/render";

vi.mock("axios", () => {
  const instance = { get: vi.fn() };
  return { default: { create: vi.fn(() => instance) } };
});

const api = vi.mocked(axios, { deep: true }).create();

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
    expect(within(dialog).getByText("Resolved")).toBeInTheDocument();
    expect(within(dialog).getByText("#T42")).toBeInTheDocument();
    expect(within(dialog).getByText("Refund request")).toBeInTheDocument();
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

    expect(within(dialog).getByText(formatDateTime(TICKET.createdAt)).closest("time")).toHaveAttribute(
      "datetime",
      TICKET.createdAt,
    );
    expect(within(dialog).getByText(formatDateTime(TICKET.updatedAt)).closest("time")).toHaveAttribute(
      "datetime",
      TICKET.updatedAt,
    );
  });

  it("shows the message exactly as it arrived, line breaks and indentation included", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: TICKET });

    renderSheet();
    const dialog = await screen.findByRole("dialog", { name: TICKET.subject });

    const message = within(dialog).getByRole("region", { name: "Message" });
    expect(message.querySelector("p")?.textContent).toBe(TICKET.body);
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
