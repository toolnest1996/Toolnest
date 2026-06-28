export const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MODERATOR"] as const;
export const ASSIGNABLE_ROLES = ["ADMIN", "MODERATOR"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export interface Permission {
  id: string;
  label: string;
  superAdmin: boolean;
  admin: boolean;
  moderator: boolean;
}

export const ADMIN_PERMISSIONS: Permission[] = [
  { id: "dashboard", label: "Dashboard & analytics", superAdmin: true, admin: true, moderator: true },
  { id: "users", label: "Manage users (ban, plan, roles)", superAdmin: true, admin: true, moderator: true },
  { id: "tools", label: "Tools & categories", superAdmin: true, admin: true, moderator: true },
  { id: "blog", label: "Blog CMS", superAdmin: true, admin: true, moderator: true },
  { id: "contacts", label: "Contact messages", superAdmin: true, admin: true, moderator: true },
  { id: "files", label: "Files & jobs", superAdmin: true, admin: true, moderator: false },
  { id: "subscriptions", label: "Subscriptions & pricing", superAdmin: true, admin: true, moderator: false },
  { id: "api_keys", label: "API keys (global view)", superAdmin: true, admin: true, moderator: false },
  { id: "features", label: "Feature flags", superAdmin: true, admin: true, moderator: false },
  { id: "emails", label: "Email templates", superAdmin: true, admin: true, moderator: false },
  { id: "settings", label: "Site settings & banners", superAdmin: true, admin: true, moderator: false },
  { id: "team", label: "Add / manage admin team", superAdmin: true, admin: false, moderator: false },
  { id: "system", label: "System health", superAdmin: true, admin: false, moderator: false },
  { id: "audit", label: "Full audit log", superAdmin: true, admin: true, moderator: false },
];

export function roleLabel(role: string) {
  return role.replace(/_/g, " ");
}

export function canAssignRole(actorRole: string, targetRole: string) {
  if (actorRole !== "SUPER_ADMIN") return false;
  if (targetRole === "SUPER_ADMIN") return false;
  return ASSIGNABLE_ROLES.includes(targetRole as AssignableRole);
}
