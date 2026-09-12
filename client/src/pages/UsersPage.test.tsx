import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import UsersPage from "@/pages/UsersPage";
import { makeUsers } from "@/test/fixtures";
import { renderWithQuery } from "@/test/render";

vi.mock("axios", () => {
  const instance = { get: vi.fn(), patch: vi.fn(), delete: vi.fn() };
  return { default: { create: vi.fn(() => instance) } };
});

vi.mock("@/lib/auth-client", () => ({ useSession: vi.fn() }));

const { useSession } = await import("@/lib/auth-client");
const mockSession = vi.mocked(useSession);

const api = vi.mocked(axios, { deep: true }).create();

const USERS = makeUsers(
  { name: "Ada Lovelace", email: "ada@example.com", role: "admin" },
  { name: "Grace Hopper", email: "grace@example.com" },
  { name: "Alan Turing", email: "alan@example.com" },
);

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.patch).mockReset();
  vi.mocked(api.delete).mockReset();
  mockSession.mockReturnValue({
    data: { user: { id: "1", name: "Ada Lovelace", role: "admin" } },
    isPending: false,
  } as never);
});

const rowIds = () => screen.getAllByTestId("user-row").map((row) => row.dataset.userId);

describe("UsersPage", () => {
  it("lists users in the order the API returned them", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: USERS });

    renderWithQuery(<UsersPage />);

    await waitFor(() => expect(screen.getAllByTestId("user-row")).toHaveLength(3));

    expect(screen.getAllByTestId("user-row").map((row) => row.dataset.userId)).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("grace@example.com")).toBeInTheDocument();
  });

  it("numbers the rows from 1 so the position matches what an admin sees", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: USERS });

    renderWithQuery(<UsersPage />);

    await waitFor(() => expect(screen.getAllByTestId("user-row")).toHaveLength(3));

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("gives every row a named drag handle", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: USERS });

    renderWithQuery(<UsersPage />);

    expect(await screen.findByRole("button", { name: "Reorder Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reorder Alan Turing" })).toBeInTheDocument();
  });

  it("shows the role each user holds", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: USERS });

    renderWithQuery(<UsersPage />);

    await waitFor(() => expect(screen.getAllByTestId("user-row")).toHaveLength(3));

    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getAllByText("agent")).toHaveLength(2);
  });

  // The skeleton has no text or role of its own, so it is counted through shadcn's
  // data-slot contract rather than its Tailwind classes, which change with any restyle.
  const skeletons = (container: HTMLElement) =>
    container.querySelectorAll('[data-slot="skeleton"]');

  it("shows a skeleton, not an empty table, while the list is still loading", async () => {
    // A promise that never settles holds the page in its pending branch. The bug this
    // guards is the page flashing "No users yet" before the first response arrives, which
    // reads as an empty directory rather than a slow one.
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));

    const { container } = renderWithQuery(<UsersPage />);

    expect(skeletons(container).length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId("user-row")).toHaveLength(0);
    expect(screen.queryByText("No users yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("replaces the skeleton with the rows once they arrive", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: USERS });

    const { container } = renderWithQuery(<UsersPage />);

    await waitFor(() => expect(screen.getAllByTestId("user-row")).toHaveLength(3));

    expect(skeletons(container)).toHaveLength(0);
    expect(screen.queryByText("No users yet")).not.toBeInTheDocument();
  });

  it("shows no skeleton once a load has failed", async () => {
    vi.mocked(api.get).mockRejectedValue({
      response: { status: 403, data: { error: "Forbidden" } },
    });

    const { container } = renderWithQuery(<UsersPage />);

    await screen.findByRole("alert");

    // Otherwise the page reports the failure and goes on pretending to load.
    expect(skeletons(container)).toHaveLength(0);
  });

  it("keeps the heading and its explanation visible in every state", async () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));

    renderWithQuery(<UsersPage />);

    // The page chrome is outside the loading branch, so an admin is never left looking at a
    // blank panel with no indication of what is loading.
    expect(screen.getByRole("heading", { level: 1, name: "Users" })).toBeInTheDocument();
    expect(screen.getByText(/Drag a row by its handle/)).toBeInTheDocument();
  });

  it("reports a failed load instead of rendering an empty table", async () => {
    vi.mocked(api.get).mockRejectedValue({
      response: { status: 403, data: { error: "Forbidden" } },
    });

    renderWithQuery(<UsersPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden");
    expect(screen.queryAllByTestId("user-row")).toHaveLength(0);
  });

  it("shows an empty state rather than a bare table when there are no users", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });

    renderWithQuery(<UsersPage />);

    expect(await screen.findByText("No users yet")).toBeInTheDocument();
    expect(screen.queryAllByTestId("user-row")).toHaveLength(0);
  });

  describe("editing and deleting", () => {
    it("opens the edit sheet filled in for the row that was chosen", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: USERS });
      const user = userEvent.setup();

      renderWithQuery(<UsersPage />);

      await user.click(await screen.findByRole("button", { name: "Edit Grace Hopper" }));

      const sheet = await screen.findByRole("dialog");
      expect(within(sheet).getByRole("heading", { name: "Edit user" })).toBeInTheDocument();
      expect(within(sheet).getByLabelText(/^Name/)).toHaveValue("Grace Hopper");
      expect(within(sheet).getByLabelText(/^Email/)).toHaveValue("grace@example.com");
    });

    it("shows a saved edit in the list", async () => {
      const renamed = USERS.map((u) => (u.id === "2" ? { ...u, name: "Grace B. Hopper" } : u));
      vi.mocked(api.get)
        .mockResolvedValueOnce({ data: USERS })
        .mockResolvedValue({ data: renamed });
      vi.mocked(api.patch).mockResolvedValue({ data: renamed[1] });
      const user = userEvent.setup();

      renderWithQuery(<UsersPage />);

      await user.click(await screen.findByRole("button", { name: "Edit Grace Hopper" }));
      const name = await screen.findByLabelText(/^Name/);
      await user.clear(name);
      await user.type(name, "Grace B. Hopper");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText("Grace B. Hopper")).toBeInTheDocument();
      expect(api.patch).toHaveBeenCalledWith(
        "/users/2",
        expect.objectContaining({ name: "Grace B. Hopper" }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("deletes a user from the edit sheet once the admin confirms", async () => {
      const remaining = USERS.filter((u) => u.id !== "3");
      vi.mocked(api.get)
        .mockResolvedValueOnce({ data: USERS })
        .mockResolvedValue({ data: remaining });
      vi.mocked(api.delete).mockResolvedValue({ data: "" });
      const user = userEvent.setup();

      renderWithQuery(<UsersPage />);

      await user.click(await screen.findByRole("button", { name: "Edit Alan Turing" }));
      await user.click(await screen.findByRole("button", { name: "Delete user" }));

      const confirm = await screen.findByRole("alertdialog");
      expect(
        within(confirm).getByRole("heading", { name: "Delete Alan Turing?" }),
      ).toBeInTheDocument();
      expect(api.delete).not.toHaveBeenCalled();

      await user.click(within(confirm).getByRole("button", { name: "Delete user" }));

      await waitFor(() => expect(rowIds()).toEqual(["1", "2"]));
      expect(api.delete).toHaveBeenCalledExactlyOnceWith("/users/3");
      expect(screen.queryByText("Alan Turing")).not.toBeInTheDocument();
    });

    it("keeps the row when the admin backs out of the confirmation", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: USERS });
      const user = userEvent.setup();

      renderWithQuery(<UsersPage />);

      await user.click(await screen.findByRole("button", { name: "Edit Alan Turing" }));
      await user.click(await screen.findByRole("button", { name: "Delete user" }));
      const confirm = await screen.findByRole("alertdialog");
      await user.click(within(confirm).getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(rowIds()).toEqual(["1", "2", "3"]);
      expect(api.delete).not.toHaveBeenCalled();
    });

    it("won't offer the signed-in admin a way to delete or demote themselves", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: USERS });
      const user = userEvent.setup();

      renderWithQuery(<UsersPage />);

      await user.click(await screen.findByRole("button", { name: "Edit Ada Lovelace" }));

      const sheet = await screen.findByRole("dialog");
      expect(within(sheet).getByRole("button", { name: "Save changes" })).toBeInTheDocument();
      expect(within(sheet).queryByRole("button", { name: "Delete user" })).not.toBeInTheDocument();
      expect(within(sheet).getByRole("radio", { name: "Admin" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });
  });
});
