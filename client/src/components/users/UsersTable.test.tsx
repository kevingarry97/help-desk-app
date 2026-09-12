import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UsersTable from "@/components/users/UsersTable";
import { makeUsers } from "@/test/fixtures";

const USERS = makeUsers(
  { name: "Ada Lovelace" },
  { name: "Grace Hopper" },
  { name: "Alan Turing" },
);

function renderTable(props: Partial<React.ComponentProps<typeof UsersTable>> = {}) {
  return render(
    <UsersTable
      users={USERS}
      onReorder={vi.fn()}
      isSaving={false}
      onEdit={vi.fn()}
      {...props}
    />,
  );
}

describe("UsersTable", () => {
  it("renders a row per user, in the order given", () => {
    renderTable();

    expect(screen.getAllByTestId("user-row").map((row) => row.dataset.userId)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });

  it("numbers rows from 1, so the position matches what an admin sees", () => {
    renderTable();

    const positions = screen
      .getAllByTestId("user-row")
      .map((row) => row.querySelector("span")?.textContent);

    expect(positions).toEqual(["1", "2", "3"]);
  });

  it("labels its columns", () => {
    renderTable();

    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Joined")).toBeInTheDocument();
  });

  describe("while a reorder is saving", () => {
    // Each request carries the whole order, so a second drag landing mid-flight would put
    // two full-list writes in the air with no guarantee the later one answers last.
    it("marks the list busy", () => {
      renderTable({ isSaving: true });

      expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "true");
    });

    it("is not busy when idle", () => {
      renderTable({ isSaving: false });

      expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "false");
    });

    it("tells assistive tech the handles are unavailable without removing focus from them", () => {
      renderTable({ isSaving: true });

      // aria-disabled rather than the DOM `disabled` attribute: the latter would drop focus
      // the instant a keyboard drop starts saving, stranding the user mid-list.
      const handle = screen.getByRole("button", { name: "Reorder Ada Lovelace" });

      expect(handle).toHaveAttribute("aria-disabled", "true");
      expect(handle).not.toBeDisabled();
    });
  });

  it("passes the chosen row's user to onEdit", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderTable({ onEdit });

    await user.click(screen.getByRole("button", { name: "Edit Alan Turing" }));

    expect(onEdit).toHaveBeenCalledExactlyOnceWith(USERS[2]);
  });
});
