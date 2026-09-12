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

export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a name")
    .max(80, "Name must be 80 characters or fewer"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Email must be 254 characters or fewer")
    .pipe(z.email("Enter a valid email address")),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(128, "Password must be 128 characters or fewer"),
  role: z.enum(Role, { error: "Choose a role" }),
});

export const updateUserSchema = createUserSchema.omit({ password: true });

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
export type CreateUserInput = z.output<typeof createUserSchema>;
export type CreateUserValues = z.input<typeof createUserSchema>;
export type UpdateUserInput = z.output<typeof updateUserSchema>;
export type UpdateUserValues = z.input<typeof updateUserSchema>;
export type ReorderUsersInput = z.infer<typeof reorderUsersSchema>;
