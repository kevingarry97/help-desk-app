import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserListItem } from "core/schemas/users";

import UserRow from "@/components/users/UserRow";
import { makeUser } from "@/test/fixtures";

import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";

function renderRow(
  overrides: Partial<UserListItem> = {},
  position = 1,
  onEdit = vi.fn(),
) {
  const item = makeUser(overrides);

  const view = render(
    <DndContext>
      <SortableContext items={[item.id]}>
        <ul>
          <UserRow
            user={item}
            position={position}
            disabled={false}
            onEdit={onEdit}
          />
        </ul>
      </SortableContext>
    </DndContext>,
  );

  return { ...view, item, onEdit };
}

describe("UserRow", () => {
  it("shows the user's name and email", () => {
    renderRow({ name: "Grace Hopper", email: "grace@example.com" });

    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.getByText("grace@example.com")).toBeInTheDocument();
  });

  it("labels the drag handle with the name, so it is distinguishable from the other rows", () => {
    renderRow({ name: "Alan Turing" });

    expect(screen.getByRole("button", { name: "Reorder Alan Turing" })).toBeInTheDocument();
  });

  it("carries the user id, which is what the reorder request is built from", () => {
    renderRow({ id: "abc123" });

    expect(screen.getByTestId("user-row").dataset.userId).toBe("abc123");
  });

  describe("avatar initials", () => {
    it("takes the first letter of the first two names", () => {
      renderRow({ name: "Ada Lovelace" });

      expect(screen.getByText("AL")).toBeInTheDocument();
    });

    it("uses a single letter for a mononym", () => {
      renderRow({ name: "Prince" });

      expect(screen.getByText("P")).toBeInTheDocument();
    });

    it("ignores a third name rather than crowding the circle", () => {
      renderRow({ name: "Ada King Lovelace" });

      expect(screen.getByText("AK")).toBeInTheDocument();
    });

    it("copes with extra whitespace between names", () => {
      renderRow({ name: "  Ada   Lovelace  " });

      expect(screen.getByText("AL")).toBeInTheDocument();
    });

    it("falls back to ? rather than rendering an empty circle", () => {
      renderRow({ name: "   " });

      expect(screen.getByText("?")).toBeInTheDocument();
    });
  });

  describe("joined date", () => {
    it("formats the ISO timestamp as a readable date", () => {
      renderRow({ createdAt: "2026-03-04T10:00:00.000Z" });

      // Asserted through the same formatter rather than a hardcoded string: the output is
      // locale-dependent, and pinning "4 Mar 2026" would fail on a machine set to en-US.
      const expected = new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date("2026-03-04T10:00:00.000Z"));

      expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it("shows a dash instead of 'Invalid Date' when the timestamp is unparseable", () => {
      renderRow({ createdAt: "not-a-date" });

      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  describe("role badge", () => {
    it("shows the role each user holds", () => {
      renderRow({ role: "admin" });

      expect(screen.getByText("admin")).toBeInTheDocument();
    });

    it("renders the agent role too", () => {
      renderRow({ role: "agent" });

      expect(screen.getByText("agent")).toBeInTheDocument();
    });
  });

  it("shows the 1-based position it was given, not the array index", () => {
    renderRow({}, 3);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("names its edit button for the user, so it is distinguishable from the other rows", () => {
    renderRow({ name: "Grace Hopper" });

    expect(screen.getByRole("button", { name: "Edit Grace Hopper" })).toBeInTheDocument();
  });

  it("hands the row's user to onEdit", async () => {
    const { item, onEdit } = renderRow();

    await userEvent.setup().click(screen.getByRole("button", { name: "Edit Ada Lovelace" }));

    expect(onEdit).toHaveBeenCalledExactlyOnceWith(item);
  });

  it("does not start editing when the drag handle is pressed", async () => {
    const { onEdit } = renderRow();

    await userEvent.setup().click(screen.getByRole("button", { name: "Reorder Ada Lovelace" }));

    expect(screen.getByRole("button", { name: "Edit Ada Lovelace" })).toBeInTheDocument();
    expect(onEdit).not.toHaveBeenCalled();
  });
});
