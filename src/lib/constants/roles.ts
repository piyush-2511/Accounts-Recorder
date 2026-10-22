export const ROLES = ["admin", "recorder"] as const;
export type Role = (typeof ROLES)[number];

export const HOME_BY_ROLE: Record<Role, string> = { admin: "/admin", recorder: "/record" };
