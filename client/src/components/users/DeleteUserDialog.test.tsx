import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";

import DeleteUserDialog from "@/components/users/DeleteUserDialog";
import { makeUser } from "@/test/fixtures";
import { renderWithQuery } from "@/test/render";

vi.mock("axios", () => {
  const instance = { get: vi.fn(), delete: vi.fn() };
  return { default: { create: vi.fn(() => instance) } };
});

const api = vi.mocked(axios, { deep: true }).create();

const GRACE = makeUser({ id: "u2", name: "Grace Hopper", email: "grace@example.com" });

function Harness() {
  const [open, setOpen] = useState(true);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen
      </button>
      <DeleteUserDialog user={GRACE} open={open} onOpenChange={setOpen} />
    </>
  );
}

async function renderDialog() {
  const user = userEvent.setup();
  renderWithQuery(<Harness />);
  await screen.findByRole("heading", { name: "Delete Grace Hopper?" });
  return user;
}

const confirmButton = () => screen.getByRole("button", { name: "Delete user" });

beforeEach(() => {
  vi.mocked(api.delete).mockReset();
});

describe("DeleteUserDialog", () => {
  it("names who is being deleted and warns that it is permanent", async () => {
    await renderDialog();

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "grace@example.com will be signed out and lose access to the helpdesk.",
    );
    expect(screen.getByText(/can’t be undone/)).toBeInTheDocument();
  });

  it("deletes that user and closes", async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: "" });

    const user = await renderDialog();
    await user.click(confirmButton());

    await waitFor(() => expect(api.delete).toHaveBeenCalledExactlyOnceWith("/users/u2"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("closes without deleting anything on Cancel", async () => {
    const user = await renderDialog();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("stays open and shows why when the server refuses", async () => {
    vi.mocked(api.delete).mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { error: "The helpdesk needs at least one admin." } },
    });

    const user = await renderDialog();
    await user.click(confirmButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The helpdesk needs at least one admin.",
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("locks both buttons and refuses to close while the delete is in flight", async () => {
    vi.mocked(api.delete).mockReturnValue(new Promise(() => {}));

    const user = await renderDialog();
    await user.click(confirmButton());

    expect(await screen.findByRole("button", { name: "Deleting…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await user.keyboard("{Escape}");

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("reopens without the last attempt's error", async () => {
    vi.mocked(api.delete).mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { error: "Internal server error" } },
    });

    const user = await renderDialog();
    await user.click(confirmButton());
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Reopen" }));

    await screen.findByRole("heading", { name: "Delete Grace Hopper?" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
