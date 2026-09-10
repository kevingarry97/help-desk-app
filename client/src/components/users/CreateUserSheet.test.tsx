import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";

import CreateUserSheet from "@/components/users/CreateUserSheet";
import { renderWithQuery } from "@/test/render";
import { makeUser } from "@/test/fixtures";

// api.ts calls axios.create() at import time, so the instance has to exist before the
// module graph evaluates — a factory, not automocking.
vi.mock("axios", () => {
  const instance = { get: vi.fn(), post: vi.fn(), patch: vi.fn() };
  return { default: { create: vi.fn(() => instance) } };
});

const api = vi.mocked(axios, { deep: true }).create();

/** A rejection shaped the way an Axios error from this API is. */
function apiError(status: number, message: string) {
  return { isAxiosError: true, response: { status, data: { error: message } } };
}

async function openSheet() {
  const user = userEvent.setup();
  renderWithQuery(<CreateUserSheet />);

  await user.click(screen.getByRole("button", { name: "New user" }));
  await screen.findByRole("heading", { name: "New user" });

  return user;
}

/** Fills every field with something valid. Overrides replace one value at a time. */
async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<{ name: string; email: string; password: string }> = {},
) {
  const values = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "hunter2000",
    ...overrides,
  };

  await user.type(screen.getByLabelText(/^Name/), values.name);
  await user.type(screen.getByLabelText(/^Email/), values.email);
  await user.type(screen.getByLabelText(/^Temporary password/), values.password);
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Create user" }));

beforeEach(() => {
  vi.mocked(api.post).mockReset();
});

describe("CreateUserSheet", () => {
  it("keeps the panel closed until the button is clicked", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CreateUserSheet />);

    // Positive assertion first: a queryBy…not.toBeInTheDocument() on its own is satisfied
    // by a component that has not rendered yet.
    expect(screen.getByRole("button", { name: "New user" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New user" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("shows a field for each thing the account needs", async () => {
    await openSheet();

    expect(screen.getByLabelText(/^Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Temporary password/)).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Role" })).toBeInTheDocument();
  });

  it("defaults the role to agent", async () => {
    await openSheet();

    expect(screen.getByRole("radio", { name: "Agent" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Admin" })).not.toBeChecked();
  });

  it("reports every empty field and sends nothing", async () => {
    const user = await openSheet();

    await submit(user);

    expect(await screen.findByText("Enter a name")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Use at least 8 characters")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("rejects an address that is not one", async () => {
    const user = await openSheet();

    await fillForm(user, { email: "ada@" });
    await submit(user);

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("rejects a password under eight characters", async () => {
    const user = await openSheet();

    await fillForm(user, { password: "hunter2" });
    await submit(user);

    expect(await screen.findByText("Use at least 8 characters")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("posts the trimmed, lowercased values and closes", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: makeUser() });

    const user = await openSheet();

    await fillForm(user, { name: "  Ada Lovelace  ", email: "  Ada@Example.COM " });
    await submit(user);

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/users", {
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "hunter2000",
        role: "agent",
      }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("sends the role the admin picked", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: makeUser({ role: "admin" }) });

    const user = await openSheet();

    await fillForm(user);
    await user.click(screen.getByRole("radio", { name: "Admin" }));
    await submit(user);

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/users",
        expect.objectContaining({ role: "admin" }),
      ),
    );
  });

  it("keeps the panel open and shows what the server said when it refuses", async () => {
    vi.mocked(api.post).mockRejectedValue(
      apiError(409, "ada@example.com already has an account."),
    );

    const user = await openSheet();

    await fillForm(user);
    await submit(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("ada@example.com already has an account.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("disables both buttons while the request is in flight", async () => {
    let release: (value: unknown) => void = () => {};
    vi.mocked(api.post).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const user = await openSheet();

    await fillForm(user);
    await submit(user);

    const creating = await screen.findByRole("button", { name: "Creating…" });
    expect(creating).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    release({ data: makeUser() });
  });

  it("reopens clean after a failed attempt", async () => {
    vi.mocked(api.post).mockRejectedValue(apiError(409, "Already taken."));

    const user = await openSheet();

    await fillForm(user);
    await submit(user);
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "New user" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/^Name/)).toHaveValue("");
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reveals and re-hides the password", async () => {
    const user = await openSheet();

    const password = screen.getByLabelText(/^Temporary password/);
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });
});
