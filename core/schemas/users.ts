import { z } from "zod/v4";

import { Role } from "../constants/role";

export const userListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  role: z.enum(Role),
  image: z.string().nullable(),
  createdAt: z.iso.datetime(),
  sortOrder: z.number().int(),
});

export const reorderUsersSchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1)
    .max(1000)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "ids must not contain duplicates",
    }),
});

export type UserListItem = z.infer<typeof userListItemSchema>;
export type ReorderUsersInput = z.infer<typeof reorderUsersSchema>;
