import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import axios from "axios";
import type { UserListItem } from "core/schemas/users";

import UsersPage from "@/pages/UsersPage";
import { renderWithQuery } from "@/test/render";

// api.ts calls axios.create() at import time, so the instance has to exist before the
// module graph is evaluated — hence a factory rather than vi.mock("axios") automocking.
vi.mock("axios", () => {
  const instance = { get: vi.fn(), patch: vi.fn() };
  return { default: { create: vi.fn(() => instance) } };
});

const api = vi.mocked(axios, { deep: true }).create();

function user(overrides: Partial<UserListItem> & { id: string }): UserListItem {
  return {
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "agent",
    image: null,
    createdAt: "2026-03-04T10:00:00.000Z",
    sortOrder: 1,
    ...overrides,
  };
}

const USERS = [
  user({ id: "1", name: "Ada Lovelace", email: "ada@example.com", role: "admin" }),
  user({ id: "2", name: "Grace Hopper", email: "grace@example.com", sortOrder: 2 }),
  user({ id: "3", name: "Alan Turing", email: "alan@example.com", sortOrder: 3 }),
];

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.patch).mockReset();
});

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
});
