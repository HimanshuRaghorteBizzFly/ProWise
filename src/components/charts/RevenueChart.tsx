"use client";

import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface RevenueData {
  month: string;
  mrr: number;
}

const DEFAULT_REVENUE: RevenueData[] = [
  { month: "Jun", mrr: 18000 },
  { month: "Jul", mrr: 24000 },
  { month: "Aug", mrr: 31000 },
  { month: "Sep", mrr: 42000 },
  { month: "Oct", mrr: 58000 },
  { month: "Nov", mrr: 74000 },
];

export function RevenueChart({ data = DEFAULT_REVENUE, height = 240 }: { data?: RevenueData[]; height?: number }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v / 1000}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--color-text-primary)",
            }}
            formatter={(value: any) => [`$${Number(value).toLocaleString()}`, "MRR"]}
          />
          <Line
            type="monotone"
            dataKey="mrr"
            stroke="#10B981"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#10B981" }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

