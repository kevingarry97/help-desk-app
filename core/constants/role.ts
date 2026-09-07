export const Role = {
  Admin: "admin",
  Agent: "agent",
} as const;

export type UserRole = (typeof Role)[keyof typeof Role];
