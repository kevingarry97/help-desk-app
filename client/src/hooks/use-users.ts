import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateUserInput, UpdateUserInput, UserListItem } from "core/schemas/users";

import { api } from "@/lib/api";
import { applyOrder } from "@/lib/reorder";

export const usersQueryKey = ["users"] as const;

export function useUsers() {
  return useQuery({
    queryKey: usersQueryKey,
    queryFn: async ({ signal }) => {
      const { data } = await api.get<UserListItem[]>("/users", { signal });
      return data;
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const { data } = await api.post<UserListItem>("/users", input);
      return data;
    },

    onSuccess: (user) => {
      // Appended rather than refetched-and-replaced, so the row is on screen the instant
      // the sheet closes. A new account carries the highest sortOrder, so the end of the
      // list is exactly where the server will put it too.
      queryClient.setQueryData<UserListItem[]>(usersQueryKey, (previous) =>
        previous ? [...previous, user] : undefined,
      );

      // Still refetched: the append is a guess about one row, and anything else that
      // changed since the list was fetched should come back with it.
      void queryClient.invalidateQueries({ queryKey: usersQueryKey });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateUserInput & { id: string }) => {
      const { data } = await api.patch<UserListItem>(`/users/${id}`, input);
      return data;
    },

    onSuccess: (user) => {
      queryClient.setQueryData<UserListItem[]>(usersQueryKey, (previous) =>
        previous?.map((existing) => (existing.id === user.id ? user : existing)),
      );

      void queryClient.invalidateQueries({ queryKey: usersQueryKey });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },

    onSuccess: (_data, id) => {
      queryClient.setQueryData<UserListItem[]>(usersQueryKey, (previous) =>
        previous?.filter((user) => user.id !== id),
      );

      void queryClient.invalidateQueries({ queryKey: usersQueryKey });
    },
  });
}

export function useReorderUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data } = await api.patch<UserListItem[]>("/users/order", { ids });
      return data;
    },

    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: usersQueryKey });

      const previous = queryClient.getQueryData<UserListItem[]>(usersQueryKey);

      if (previous) {
        queryClient.setQueryData(usersQueryKey, applyOrder(previous, ids));
      }

      return { previous };
    },

    onSuccess: (users) => {
      queryClient.setQueryData(usersQueryKey, users);
    },

    onError: (_error, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(usersQueryKey, context.previous);
      }

      void queryClient.invalidateQueries({ queryKey: usersQueryKey });
    },
  });
}
