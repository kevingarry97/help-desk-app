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

/**
 * A new account, as an admin fills it in. Sign-up is disabled, so every account is created
 * for someone else: the password here is one the admin types and hands over, not one its
 * owner chose.
 *
 * Shared by the form and the route, so the message a field shows before the request is the
 * same rule the server enforces after it.
 */
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
    // Normalised before the format check rather than after it: a pasted " Ada@Example.com "
    // is a valid address wearing whitespace, not an invalid one. The lowercasing is not
    // cosmetic either — the unique index on email is case-sensitive, so without it
    // Ada@x.com and ada@x.com are two accounts for one person.
    .max(254, "Email must be 254 characters or fewer")
    .pipe(z.email("Enter a valid email address")),
  // Better Auth's own bounds. Lower and it would reject the account after the user row was
  // already written; higher and bcrypt would silently ignore the tail of the password.
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(128, "Password must be 128 characters or fewer"),
  role: z.enum(Role, { error: "Choose a role" }),
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
/** What the route receives and the mutation sends — trimmed, lowercased. */
export type CreateUserInput = z.output<typeof createUserSchema>;
/** What the form holds while it is being typed, before those transforms run. */
export type CreateUserValues = z.input<typeof createUserSchema>;
export type ReorderUsersInput = z.infer<typeof reorderUsersSchema>;
