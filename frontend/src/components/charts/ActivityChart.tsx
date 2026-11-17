"use client";

import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface ActivityChartProps {
  data?: { day: string; commits: number; reviews: number }[];
  height?: number;
}

const DEFAULT_ACTIVITY = [
  { day: "Mon", commits: 12, reviews: 3 },
  { day: "Tue", commits: 19, reviews: 5 },
  { day: "Wed", commits: 15, reviews: 4 },
  { day: "Thu", commits: 22, reviews: 8 },
  { day: "Fri", commits: 18, reviews: 6 },
  { day: "Sat", commits: 5, reviews: 1 },
  { day: "Sun", commits: 2, reviews: 0 },
];

export function ActivityChart({ data = DEFAULT_ACTIVITY, height = 240 }: ActivityChartProps) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--color-text-primary)",
            }}
          />
          <Bar dataKey="commits" fill="#2563EB" radius={[4, 4, 0, 0]} name="Git Commits" />
          <Bar dataKey="reviews" fill="#10B981" radius={[4, 4, 0, 0]} name="QA Reviews" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

