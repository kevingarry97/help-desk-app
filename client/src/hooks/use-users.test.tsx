import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import axios from "axios";
import type { UserListItem } from "core/schemas/users";

import { useReorderUsers, usersQueryKey } from "@/hooks/use-users";
import { createQueryWrapper } from "@/test/render";

vi.mock("axios", () => {
  const instance = { get: vi.fn(), patch: vi.fn() };
  return { default: { create: vi.fn(() => instance) } };
});

const api = vi.mocked(axios, { deep: true }).create();

function user(id: string, sortOrder: number): UserListItem {
  return {
    id,
    name: `User ${id}`,
    email: `${id}@example.com`,
    role: "agent",
    image: null,
    createdAt: "2026-03-04T10:00:00.000Z",
    sortOrder,
  };
}

const USERS = [user("a", 1), user("b", 2), user("c", 3)];

function setup() {
  const { queryClient, Wrapper } = createQueryWrapper();
  queryClient.setQueryData(usersQueryKey, USERS);

  const cachedIds = () =>
    queryClient.getQueryData<UserListItem[]>(usersQueryKey)?.map((u) => u.id);

  return { ...renderHook(() => useReorderUsers(), { wrapper: Wrapper }), cachedIds };
}

beforeEach(() => {
  vi.mocked(api.patch).mockReset();
});

describe("useReorderUsers", () => {
  it("sends the whole list of ids in the new order", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: [] });

    const { result } = setup();
    act(() => result.current.mutate(["c", "a", "b"]));

    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    expect(api.patch).toHaveBeenCalledWith("/users/order", { ids: ["c", "a", "b"] });
  });

  it("reorders the cache before the request resolves, so the row stays where it was dropped", async () => {
    // Never resolves: the assertion is about what the cache holds mid-flight.
    vi.mocked(api.patch).mockReturnValue(new Promise(() => {}));

    const { result, cachedIds } = setup();
    act(() => result.current.mutate(["c", "a", "b"]));

    await waitFor(() => expect(cachedIds()).toEqual(["c", "a", "b"]));
  });

  it("adopts the order the server confirms", async () => {
    vi.mocked(api.patch).mockResolvedValue({
      data: [user("c", 1), user("a", 2), user("b", 3)],
    });

    const { result, cachedIds } = setup();
    act(() => result.current.mutate(["c", "a", "b"]));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cachedIds()).toEqual(["c", "a", "b"]);
  });

  it("puts the old order back when the save fails", async () => {
    vi.mocked(api.patch).mockRejectedValue({
      response: { status: 409, data: { error: "The user list changed" } },
    });

    const { result, cachedIds } = setup();
    act(() => result.current.mutate(["c", "a", "b"]));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cachedIds()).toEqual(["a", "b", "c"]);
  });
});
