import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import type { UserListItem } from "core/schemas/users";

import EditUserSheet from "@/components/users/EditUserSheet";
import { makeUser } from "@/test/fixtures";
import { renderWithQuery } from "@/test/render";

vi.mock("axios", () => {
  const instance = { get: vi.fn(), patch: vi.fn() };
  return { default: { create: vi.fn(() => instance) } };
});

const api = vi.mocked(axios, { deep: true }).create();

const ADA = makeUser({ id: "u1", name: "Ada Lovelace", email: "ada@example.com", role: "agent" });

function apiError(status: number, message: string) {
  return { isAxiosError: true, response: { status, data: { error: message } } };
}

function Harness({
  user = ADA,
  isSelf = false,
  onDelete = () => {},
}: {
  user?: UserListItem;
  isSelf?: boolean;
  onDelete?: (user: UserListItem) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen
      </button>
      <EditUserSheet
        user={user}
        open={open}
        isSelf={isSelf}
        onOpenChange={setOpen}
        onDelete={onDelete}
      />
    </>
  );
}

async function renderSheet(props: Parameters<typeof Harness>[0] = {}) {
  const user = userEvent.setup();
  renderWithQuery(<Harness {...props} />);
  await screen.findByRole("heading", { name: "Edit user" });
  return user;
}

const nameField = () => screen.getByLabelText(/^Name/);
const emailField = () => screen.getByLabelText(/^Email/);
const saveButton = () => screen.getByRole("button", { name: "Save changes" });

async function replace(
  user: ReturnType<typeof userEvent.setup>,
  field: HTMLElement,
  value: string,
) {
  await user.clear(field);
  if (value) await user.type(field, value);
}

beforeEach(() => {
  vi.mocked(api.patch).mockReset();
});

describe("EditUserSheet", () => {
  it("fills the form with the user's current details", async () => {
    await renderSheet();

    expect(nameField()).toHaveValue("Ada Lovelace");
    expect(emailField()).toHaveValue("ada@example.com");
    expect(screen.getByRole("radio", { name: "Agent" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Admin" })).not.toBeChecked();
  });

  it("keeps Save disabled until something has changed", async () => {
    const user = await renderSheet();

    expect(saveButton()).toBeDisabled();

    await user.type(nameField(), " King");

    expect(saveButton()).toBeEnabled();
  });

  it("reports an empty name and sends nothing", async () => {
    const user = await renderSheet();

    await replace(user, nameField(), "");
    await user.click(saveButton());

    expect(await screen.findByText("Enter a name")).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("rejects an address that is not one", async () => {
    const user = await renderSheet();

    await replace(user, emailField(), "ada@");
    await user.click(saveButton());

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("sends the trimmed, lowercased changes for that user and closes", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { ...ADA, name: "Ada King" } });

    const user = await renderSheet();

    await replace(user, nameField(), "  Ada King  ");
    await replace(user, emailField(), " Ada.King@Example.COM ");
    await user.click(screen.getByRole("radio", { name: "Admin" }));
    await user.click(saveButton());

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledExactlyOnceWith("/users/u1", {
        name: "Ada King",
        email: "ada.king@example.com",
        role: "admin",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps the panel open and shows what the server said when it refuses", async () => {
    vi.mocked(api.patch).mockRejectedValue(
      apiError(409, "grace@example.com already has an account."),
    );

    const user = await renderSheet();

    await replace(user, emailField(), "grace@example.com");
    await user.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "grace@example.com already has an account.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("locks every button and refuses to close while saving", async () => {
    vi.mocked(api.patch).mockReturnValue(new Promise(() => {}));

    const user = await renderSheet();

    await user.type(nameField(), " King");
    await user.click(saveButton());

    expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete user" })).toBeDisabled();

    await user.keyboard("{Escape}");

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("reopens with the user's details and without the last attempt's error", async () => {
    vi.mocked(api.patch).mockRejectedValue(apiError(500, "Internal server error"));

    const user = await renderSheet();

    await replace(user, nameField(), "Somebody Else");
    await user.click(saveButton());
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Reopen" }));

    await screen.findByRole("heading", { name: "Edit user" });
    expect(nameField()).toHaveValue("Ada Lovelace");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("hands the user over for deletion and gets out of the way", async () => {
    const onDelete = vi.fn();
    const user = await renderSheet({ onDelete });

    await user.click(screen.getByRole("button", { name: "Delete user" }));

    expect(onDelete).toHaveBeenCalledExactlyOnceWith(ADA);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  describe("on the signed-in admin's own account", () => {
    it("locks the role and says why", async () => {
      await renderSheet({ isSelf: true });

      expect(screen.getByText("You can’t change your own role.")).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Agent" })).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByRole("radio", { name: "Admin" })).toHaveAttribute("aria-disabled", "true");
    });

    it("offers no way to delete it", async () => {
      await renderSheet({ isSelf: true });

      expect(saveButton()).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Delete user" })).not.toBeInTheDocument();
    });

    it("still lets them change their name", async () => {
      const user = await renderSheet({ isSelf: true });

      await user.type(nameField(), " King");

      expect(saveButton()).toBeEnabled();
    });
  });
});
