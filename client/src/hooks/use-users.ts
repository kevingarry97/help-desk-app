import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserListItem } from "core/schemas/users";

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
