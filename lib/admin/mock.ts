export interface Kpi {
  label: string;
  value: string;
  delta: number;
  icon: string;
  spark: number[];
}

export const kpis: Kpi[] = [
  {
    label: "Total Users",
    value: "48,920",
    delta: 12.4,
    icon: "Users",
    spark: [20, 24, 22, 30, 28, 36, 40, 44, 49],
  },
  {
    label: "Jobs Today",
    value: "12,304",
    delta: 8.1,
    icon: "Activity",
    spark: [60, 55, 70, 65, 80, 78, 90, 88, 95],
  },
  {
    label: "MRR",
    value: "$28,410",
    delta: 5.6,
    icon: "DollarSign",
    spark: [10, 12, 13, 15, 16, 18, 22, 25, 28],
  },
  {
    label: "Storage Used",
    value: "412 GB",
    delta: -2.3,
    icon: "HardDrive",
    spark: [40, 42, 45, 44, 46, 43, 42, 41, 41],
  },
];

export const usageSeries = [
  { label: "Mon", value: 8200 },
  { label: "Tue", value: 9400 },
  { label: "Wed", value: 11200 },
  { label: "Thu", value: 10300 },
  { label: "Fri", value: 13800 },
  { label: "Sat", value: 9100 },
  { label: "Sun", value: 7600 },
];

export const topTools = [
  { name: "Compress Image", count: 18230, color: "#FF6B35" },
  { name: "Merge PDF", count: 15110, color: "#E8231A" },
  { name: "YouTube Downloader", count: 12880, color: "#FF0000" },
  { name: "QR Generator", count: 9740, color: "#7B2FF7" },
  { name: "Background Remover", count: 8120, color: "#06D6A0" },
  { name: "PDF to Word", count: 6450, color: "#4CC9F0" },
];

export interface Activity {
  who: string;
  action: string;
  target: string;
  time: string;
  type: "user" | "tool" | "billing" | "system";
}

export const activity: Activity[] = [
  { who: "admin@toolnest.io", action: "banned user", target: "spam_bot_42", time: "2m ago", type: "user" },
  { who: "moderator.jane", action: "disabled tool", target: "vimeo-download", time: "18m ago", type: "tool" },
  { who: "system", action: "ran cleanup", target: "freed 8.2 GB", time: "1h ago", type: "system" },
  { who: "admin@toolnest.io", action: "refunded", target: "INV-20451 ($29.99)", time: "2h ago", type: "billing" },
  { who: "moderator.alex", action: "published post", target: "Top 10 PDF tips", time: "3h ago", type: "tool" },
  { who: "system", action: "auto-deleted", target: "1,204 expired files", time: "5h ago", type: "system" },
  { who: "admin@toolnest.io", action: "changed plan", target: "user #8821 → Pro", time: "6h ago", type: "billing" },
];

export interface JobRow {
  id: string;
  tool: string;
  user: string;
  status: "pending" | "running" | "done" | "failed";
  size: string;
}

export const recentJobs: JobRow[] = [
  { id: "JOB-9F2A", tool: "Merge PDF", user: "kira@mail.com", status: "done", size: "4.2 MB" },
  { id: "JOB-7C18", tool: "YouTube Downloader", user: "leo99", status: "running", size: "82 MB" },
  { id: "JOB-3B0D", tool: "Compress Image", user: "anon", status: "done", size: "1.1 MB" },
  { id: "JOB-2A77", tool: "PDF to Word", user: "maria.k", status: "pending", size: "—" },
  { id: "JOB-55E1", tool: "Background Remover", user: "devon", status: "failed", size: "3.4 MB" },
];
