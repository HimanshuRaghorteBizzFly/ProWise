"use client";

import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

interface WorkloadData {
  name: string;
  plannedHours: number;
  availableHours: number;
}

const DEFAULT_WORKLOAD: WorkloadData[] = [
  { name: "Alice (Lead)", plannedHours: 32, availableHours: 40 },
  { name: "Bob (Dev)", plannedHours: 44, availableHours: 40 }, // Overallocated
  { name: "Carol (Dev)", plannedHours: 36, availableHours: 40 },
  { name: "Dave (QA)", plannedHours: 28, availableHours: 40 },
];

export function WorkloadChart({ data = DEFAULT_WORKLOAD, height = 240 }: { data?: WorkloadData[]; height?: number }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}h`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--color-text-primary)",
            }}
            formatter={(value: any) => [`${value} hrs`, ""]}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-xs text-[var(--color-text-secondary)]">{value}</span>}
          />
          <Bar dataKey="plannedHours" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Planned Hours" />
          <Bar dataKey="availableHours" fill="#94A3B8" radius={[4, 4, 0, 0]} name="Capacity Hours" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

