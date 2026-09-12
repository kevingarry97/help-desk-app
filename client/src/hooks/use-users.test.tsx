import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import axios from "axios";
import type { UserListItem } from "core/schemas/users";

import { useDeleteUser, useReorderUsers, useUpdateUser, usersQueryKey } from "@/hooks/use-users";
import { makeUsers } from "@/test/fixtures";
import { createQueryWrapper } from "@/test/render";

vi.mock("axios", () => {
  const instance = { get: vi.fn(), patch: vi.fn(), delete: vi.fn() };
  return { default: { create: vi.fn(() => instance) } };
});

const api = vi.mocked(axios, { deep: true }).create();

const USERS = makeUsers({ id: "a" }, { id: "b" }, { id: "c" });

function setup() {
  const { queryClient, Wrapper } = createQueryWrapper();
  queryClient.setQueryData(usersQueryKey, USERS);

  const cachedIds = () =>
    queryClient.getQueryData<UserListItem[]>(usersQueryKey)?.map((u) => u.id);

  return { ...renderHook(() => useReorderUsers(), { wrapper: Wrapper }), cachedIds };
}

beforeEach(() => {
  vi.mocked(api.patch).mockReset();
  vi.mocked(api.delete).mockReset();
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
      data: makeUsers({ id: "c" }, { id: "a" }, { id: "b" }),
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

describe("useUpdateUser", () => {
  it("patches that user and swaps the saved row into the list where it already was", async () => {
    const saved = { ...USERS[1]!, name: "Grace Hopper" };
    vi.mocked(api.patch).mockResolvedValue({ data: saved });

    const { queryClient, Wrapper } = createQueryWrapper();
    queryClient.setQueryData(usersQueryKey, USERS);
    const { result } = renderHook(() => useUpdateUser(), { wrapper: Wrapper });

    act(() =>
      result.current.mutate({ id: "b", name: "Grace Hopper", email: saved.email, role: "agent" }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.patch).toHaveBeenCalledWith("/users/b", {
      name: "Grace Hopper",
      email: saved.email,
      role: "agent",
    });

    const cached = queryClient.getQueryData<UserListItem[]>(usersQueryKey);
    expect(cached?.map((u) => u.id)).toEqual(["a", "b", "c"]);
    expect(cached?.[1]?.name).toBe("Grace Hopper");
  });
});

describe("useDeleteUser", () => {
  it("deletes that user and drops the row from the list", async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: "" });

    const { queryClient, Wrapper } = createQueryWrapper();
    queryClient.setQueryData(usersQueryKey, USERS);
    const { result } = renderHook(() => useDeleteUser(), { wrapper: Wrapper });

    act(() => result.current.mutate("b"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.delete).toHaveBeenCalledWith("/users/b");
    expect(queryClient.getQueryData<UserListItem[]>(usersQueryKey)?.map((u) => u.id)).toEqual([
      "a",
      "c",
    ]);
  });

  it("leaves the list alone when the delete fails", async () => {
    vi.mocked(api.delete).mockRejectedValue({ response: { status: 409, data: {} } });

    const { queryClient, Wrapper } = createQueryWrapper();
    queryClient.setQueryData(usersQueryKey, USERS);
    const { result } = renderHook(() => useDeleteUser(), { wrapper: Wrapper });

    act(() => result.current.mutate("b"));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData<UserListItem[]>(usersQueryKey)).toHaveLength(3);
  });
});
