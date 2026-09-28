import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import type { TicketDetail } from "core/schemas/tickets";

import TicketConversation from "@/components/tickets/TicketConversation";
import { formatDateTime } from "@/lib/format-date";
import { makeTicketAssignee, makeTicketDetail, makeTicketReplies } from "@/test/fixtures";
import { renderWithQuery } from "@/test/render";

vi.mock("axios", () => {
  const instance = { get: vi.fn(), patch: vi.fn(), post: vi.fn() };
  return { default: { create: vi.fn(() => instance) } };
});

const api = vi.mocked(axios, { deep: true }).create();

const TICKET = makeTicketDetail({
  id: "t42",
  requesterEmail: "sam@example.com",
  body: "I reset my password twice\n  and still can't get in.",
  createdAt: "2026-09-16T09:30:00.000Z",
  status: "OPEN",
});

/** The component takes the ticket as a prop and does no routing, so no router is needed. */
function renderConversation(ticket: Partial<TicketDetail> = {}) {
  return renderWithQuery(
    <TicketConversation ticket={{ ...TICKET, ...ticket }} headingId="conversation" />,
  );
}

const thread = () => screen.getByRole("region", { name: "Conversation" });
const entries = () => within(thread()).getAllByRole("listitem");
const body = () => screen.getByRole("textbox");
const sendButton = () => screen.getByRole("button", { name: "Send reply" });

beforeEach(() => {
  vi.mocked(api.post).mockReset();
});

describe("the thread", () => {
  it("opens with the requester's original email, exactly as it arrived", () => {
    renderConversation();

    const first = entries()[0];
    expect(within(first).getByText(TICKET.requesterEmail)).toBeInTheDocument();
    expect(first.querySelector("p")?.textContent).toBe(TICKET.body);
    expect(within(first).getByText(formatDateTime(TICKET.createdAt)).closest("time"))
      .toHaveAttribute("datetime", TICKET.createdAt);
  });

  it("shows a ticket with no replies as just that original message", () => {
    renderConversation({ replies: [] });

    expect(entries()).toHaveLength(1);
  });

  it("lists replies under the original, in the order the server sent them", () => {
    renderConversation({
      replies: makeTicketReplies(
        { body: "First answer", author: makeTicketAssignee({ name: "Ada Lovelace" }) },
        { body: "Second answer", author: makeTicketAssignee({ name: "Grace Hopper" }) },
      ),
    });

    const [original, first, second] = entries();
    expect(original.querySelector("p")?.textContent).toBe(TICKET.body);
    expect(within(first).getByText("First answer")).toBeInTheDocument();
    expect(within(first).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(second).getByText("Second answer")).toBeInTheDocument();
    expect(within(second).getByText("Grace Hopper")).toBeInTheDocument();
  });

  it("still names the author of a reply whose account has been deleted", () => {
    renderConversation({
      replies: makeTicketReplies({ authorName: "Grace Hopper", author: null }),
    });

    expect(within(entries()[1]).getByText("Grace Hopper")).toBeInTheDocument();
  });

  it("marks an internal note, and leaves a public reply unmarked", () => {
    renderConversation({
      replies: makeTicketReplies(
        { body: "Sent to the student", isInternal: false },
        { body: "Team only", isInternal: true },
      ),
    });

    const [, published, note] = entries();
    expect(within(note).getByText("Internal note")).toBeInTheDocument();
    expect(within(published).queryByText("Internal note")).not.toBeInTheDocument();
  });
});

describe("the composer", () => {
  it("posts a public reply and clears the box", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValue({ data: { ...TICKET, replies: [] } });

    renderConversation();
    await user.type(body(), "Try the reset link once more.");
    await user.click(sendButton());

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/tickets/t42/replies", {
        body: "Try the reset link once more.",
        isInternal: false,
        resolve: false,
      }),
    );
    await waitFor(() => expect(body()).toHaveValue(""));
  });

  it("posts an internal note when the note toggle is chosen", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValue({ data: { ...TICKET, replies: [] } });

    renderConversation();
    await user.click(screen.getByRole("button", { name: "Internal note" }));
    await user.type(body(), "Escalated to billing.");
    await user.click(screen.getByRole("button", { name: "Add note" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/tickets/t42/replies", {
        body: "Escalated to billing.",
        isInternal: true,
        resolve: false,
      }),
    );
  });

  it("asks for resolution in the same request when Reply & resolve is used", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValue({ data: { ...TICKET, status: "RESOLVED", replies: [] } });

    renderConversation();
    await user.type(body(), "All sorted.");
    await user.click(screen.getByRole("button", { name: "Reply & resolve" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/tickets/t42/replies", {
        body: "All sorted.",
        isInternal: false,
        resolve: true,
      }),
    );
  });

  it("offers no resolve button on a ticket that is already resolved", () => {
    renderConversation({ status: "RESOLVED" });

    expect(sendButton()).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reply & resolve" })).not.toBeInTheDocument();
  });

  it("refuses to send an empty reply", async () => {
    const user = userEvent.setup();

    renderConversation();
    await user.click(sendButton());

    expect(await screen.findByText("Write a reply first")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("refuses to send a reply that is only whitespace", async () => {
    const user = userEvent.setup();

    renderConversation();
    await user.type(body(), "   ");
    await user.click(sendButton());

    expect(await screen.findByText("Write a reply first")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("says so when the reply cannot be posted, and keeps what was typed", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValue({
      response: { status: 500, data: { error: "Database is down" } },
    });

    renderConversation();
    await user.type(body(), "Please hold.");
    await user.click(sendButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Database is down");
    expect(body()).toHaveValue("Please hold.");
  });

  it("disables both buttons and the box while the reply is in flight", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockReturnValue(new Promise(() => {}));

    renderConversation();
    await user.type(body(), "Sending…");
    await user.click(sendButton());

    expect(await screen.findByRole("button", { name: "Sending…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reply & resolve" })).toBeDisabled();
    expect(body()).toBeDisabled();
  });
});
