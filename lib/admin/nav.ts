export interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
  group: "Overview" | "Manage" | "Growth" | "System";
}

export const adminNav: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "LayoutDashboard", group: "Overview" },
  { href: "/admin/analytics", label: "Analytics", icon: "BarChart3", group: "Overview" },
  { href: "/admin/reports", label: "Reports", icon: "FileSpreadsheet", group: "Overview" },

  { href: "/admin/users", label: "Users", icon: "Users", group: "Manage" },
  { href: "/admin/tools", label: "Tools", icon: "Wrench", group: "Manage" },
  { href: "/admin/categories", label: "Categories", icon: "FolderTree", group: "Manage" },
  { href: "/admin/files", label: "Files & Jobs", icon: "HardDrive", group: "Manage" },
  { href: "/admin/blog", label: "Blog", icon: "FileText", group: "Manage" },
  { href: "/admin/contacts", label: "Contact Messages", icon: "Mail", group: "Manage" },

  { href: "/admin/subscriptions", label: "Subscriptions", icon: "CreditCard", group: "Growth" },
  { href: "/admin/pricing", label: "Pricing", icon: "Tags", group: "Growth" },
  { href: "/admin/ads", label: "Ads", icon: "Megaphone", group: "Growth" },
  { href: "/admin/api-keys", label: "API Keys", icon: "KeyRound", group: "Growth" },

  { href: "/admin/features", label: "Feature Flags", icon: "ToggleRight", group: "System" },
  { href: "/admin/emails", label: "Email Templates", icon: "MailOpen", group: "System" },
  { href: "/admin/notifications", label: "Notifications", icon: "Bell", group: "System" },
  { href: "/admin/team", label: "Admin Team", icon: "UserCog", group: "System" },
  { href: "/admin/team/new", label: "Create Admin", icon: "UserPlus", group: "System" },
  { href: "/admin/audit-log", label: "Audit Log", icon: "ScrollText", group: "System" },
  { href: "/admin/profile", label: "My Profile", icon: "UserCircle", group: "System" },
  { href: "/admin/settings", label: "Settings", icon: "Settings", group: "System" },
  { href: "/admin/system", label: "System", icon: "Server", group: "System" },
];

export const adminNavGroups = ["Overview", "Manage", "Growth", "System"] as const;
