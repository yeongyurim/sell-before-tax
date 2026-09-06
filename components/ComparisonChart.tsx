"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatKRW } from "@/lib/format";
import type { SellPlan } from "@/lib/types";

interface ComparisonChartProps {
  baseline: SellPlan;
  plans: SellPlan[];
  selectedIndex: number;
}

const BASELINE_COLOR = "#cbd5e1";
const ACCENT = "#1f57e8";
const ACCENT_MUTED = "#bfd6fe";

/** 100만원 단위 축 라벨 */
function axisLabel(value: number): string {
  if (value === 0) return "0";
  return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만`;
}

export default function ComparisonChart({
  baseline,
  plans,
  selectedIndex,
}: ComparisonChartProps) {
  // ResponsiveContainer는 실제 DOM 크기를 재야 하므로 마운트 후에 그린다.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = [
    { name: "단순 매도", tax: baseline.tax, kind: "baseline" as const, index: -1 },
    ...plans.map((plan, index) => ({
      name: plan.label,
      tax: plan.tax,
      kind: "plan" as const,
      index,
    })),
  ];

  if (!mounted) return <div className="h-[260px]" aria-hidden="true" />;

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            tick={{ fill: "#6b7280", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickFormatter={axisLabel}
          />
          <Tooltip
            cursor={{ fill: "#f8fafc" }}
            formatter={(value) => [formatKRW(Number(value ?? 0)), "예상 세금"]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              fontSize: 12,
              boxShadow: "0 4px 12px rgb(15 23 42 / 0.08)",
            }}
          />
          <Bar dataKey="tax" radius={[4, 4, 0, 0]} maxBarSize={72} isAnimationActive={false}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={
                  entry.kind === "baseline"
                    ? BASELINE_COLOR
                    : entry.index === selectedIndex
                      ? ACCENT
                      : ACCENT_MUTED
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
