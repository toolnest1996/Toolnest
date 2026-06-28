import type { Metadata } from "next";
import "./admin-theme.css";

export const metadata: Metadata = {
  title: "Admin Panel",
  description: "ToolNest admin control center.",
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="admin-panel">{children}</div>;
}
