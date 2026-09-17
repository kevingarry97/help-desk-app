import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

import { formatDateTime } from "@/lib/format-date";
import TicketDetailPage from "@/pages/TicketDetailPage";
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

/** Stands in for the list page, and shows the query string it was reached with. */
function ListProbe() {
  return <h1>Ticket list {useLocation().search}</h1>;
}

function renderPage(entry: string | { pathname: string; state?: unknown } = "/tickets/t42") {
  return renderWithQuery(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/tickets" element={<ListProbe />} />
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const skeletons = (container: HTMLElement) => container.querySelectorAll('[data-slot="skeleton"]');

beforeEach(() => {
  vi.mocked(api.get).mockReset();
});

describe("TicketDetailPage", () => {
  it("asks the API for the ticket named in the URL", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: TICKET });

    renderPage();

    await screen.findByRole("heading", { level: 1, name: TICKET.subject });
    expect(api.get).toHaveBeenCalledWith("/tickets/t42", expect.anything());
  });

  it("shows the subject, status, reference, category and sender", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: TICKET });

    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: TICKET.subject })).toBeInTheDocument();
    expect(screen.getByText("Resolved")).toBeInTheDocument();
    expect(screen.getByText("#T42")).toBeInTheDocument();
    expect(screen.getByText("Refund request")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "sam@example.com" })).toHaveAttribute(
      "href",
      "mailto:sam@example.com",
    );
  });

  it("shows when the ticket arrived and when it last changed", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: TICKET });

    renderPage();
    await screen.findByRole("heading", { level: 1, name: TICKET.subject });

    const received = screen.getByText(formatDateTime(TICKET.createdAt));
    const updated = screen.getByText(formatDateTime(TICKET.updatedAt));

    expect(received.closest("time")).toHaveAttribute("datetime", TICKET.createdAt);
    expect(updated.closest("time")).toHaveAttribute("datetime", TICKET.updatedAt);
  });

  it("shows the message exactly as it arrived, line breaks and indentation included", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: TICKET });

    renderPage();
    await screen.findByRole("heading", { level: 1, name: TICKET.subject });

    // getByText normalises whitespace, which would hide exactly the thing under test.
    const message = screen.getByText((_content, element) =>
      element?.tagName === "P" && element.textContent === TICKET.body,
    );
    expect(message).toBeInTheDocument();
  });

  it("shows a skeleton, and nothing else, while the ticket loads", () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    expect(screen.getByRole("link", { name: "All tickets" })).toBeInTheDocument();
    expect(skeletons(container).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says the ticket was not found when the API answers 404", async () => {
    vi.mocked(api.get).mockRejectedValue({
      response: { status: 404, data: { error: "No ticket with id t42" } },
    });

    const { container } = renderPage();

    expect(await screen.findByRole("heading", { name: "Ticket not found" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(skeletons(container)).toHaveLength(0);
  });

  it("reports any other failure as an error, not as a missing ticket", async () => {
    vi.mocked(api.get).mockRejectedValue({
      response: { status: 500, data: { error: "Internal server error" } },
    });

    const { container } = renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Internal server error");
    expect(screen.queryByRole("heading", { name: "Ticket not found" })).not.toBeInTheDocument();
    expect(skeletons(container)).toHaveLength(0);
  });

  describe("the All tickets link", () => {
    it("returns to the list", async () => {
      const user = userEvent.setup();
      vi.mocked(api.get).mockResolvedValue({ data: TICKET });

      renderPage();
      await screen.findByRole("heading", { level: 1, name: TICKET.subject });

      await user.click(screen.getByRole("link", { name: "All tickets" }));

      expect(await screen.findByRole("heading", { name: "Ticket list" })).toBeInTheDocument();
    });

    it("keeps the filters the list was showing", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: TICKET });

      renderPage({ pathname: "/tickets/t42", state: { listSearch: "?status=OPEN&category=REFUND_REQUEST" } });

      await screen.findByRole("heading", { level: 1, name: TICKET.subject });
      expect(screen.getByRole("link", { name: "All tickets" })).toHaveAttribute(
        "href",
        "/tickets?status=OPEN&category=REFUND_REQUEST",
      );
    });

    it.each([
      ["no state", undefined],
      ["a non-string", { listSearch: 42 }],
      ["a string that is not a query", { listSearch: "//evil.example" }],
    ])("falls back to the plain list given %s", async (_label, state) => {
      vi.mocked(api.get).mockResolvedValue({ data: TICKET });

      renderPage({ pathname: "/tickets/t42", state });

      await screen.findByRole("heading", { level: 1, name: TICKET.subject });
      expect(screen.getByRole("link", { name: "All tickets" })).toHaveAttribute("href", "/tickets");
    });
  });

  it.each([
    ["OPEN", "Open"],
    ["RESOLVED", "Resolved"],
    ["CLOSED", "Closed"],
  ] as const)("labels the %s status in words", async (status, label) => {
    vi.mocked(api.get).mockResolvedValue({ data: { ...TICKET, status } });

    renderPage();

    const header = (await screen.findByRole("heading", { level: 1, name: TICKET.subject })).closest("header");
    expect(within(header as HTMLElement).getByText(label)).toBeInTheDocument();
  });
});
