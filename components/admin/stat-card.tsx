"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import type { Kpi } from "@/lib/admin/mock";
import { Icon } from "@/components/icon";
import { Sparkline } from "./charts";

export function StatCard({ kpi }: { kpi: Kpi }) {
  const up = kpi.delta >= 0;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{kpi.label}</p>
          <p className="mt-1 font-display text-2xl font-bold text-white">
            {kpi.value}
          </p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-[#FF6B35]">
          <Icon name={kpi.icon} className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span
          className={`flex items-center gap-1 text-xs font-medium ${
            up ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {up ? "+" : ""}
          {kpi.delta}%
        </span>
        <Sparkline data={kpi.spark} color={up ? "#22C55E" : "#F43F5E"} />
      </div>
    </div>
  );
}
