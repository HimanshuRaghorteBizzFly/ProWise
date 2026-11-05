"use client";

import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

interface TaskStatusChartProps {
  todo?: number;
  inProgress?: number;
  inReview?: number;
  done?: number;
  height?: number;
}

export function TaskStatusChart({
  todo = 4,
  inProgress = 6,
  inReview = 3,
  done = 12,
  height = 240,
}: TaskStatusChartProps) {
  const data = [
    { name: "To Do", value: todo, color: "#94A3B8" },
    { name: "In Progress", value: inProgress, color: "#3B82F6" },
    { name: "In Review", value: inReview, color: "#F59E0B" },
    { name: "Done", value: done, color: "#10B981" },
  ];

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            innerRadius={60}
            outerRadius={80}
            paddingAngle={4}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--color-text-primary)",
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-xs text-[var(--color-text-secondary)]">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

