"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface ProgressPoint {
  date: string;
  percent: number;
}

interface ProgressChartProps {
  data?: ProgressPoint[];
  height?: number;
}

const DEFAULT_DATA: ProgressPoint[] = [
  { date: "Oct 1", percent: 10 },
  { date: "Oct 8", percent: 25 },
  { date: "Oct 15", percent: 35 },
  { date: "Oct 22", percent: 50 },
  { date: "Oct 29", percent: 40 },
  { date: "Nov 5", percent: 65 },
];

export function ProgressChart({ data = DEFAULT_DATA, height = 240 }: ProgressChartProps) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="progressGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--color-text-primary)",
            }}
            formatter={(value: any) => [`${value}%`, "Progress"]}
          />
          <Area
            type="monotone"
            dataKey="percent"
            stroke="#2563EB"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#progressGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

