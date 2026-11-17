"use client";

import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { ViewerProject, ViewerTask, ViewerMilestone } from "../_types";

export function PortfolioHealthDonut({ projects }: { projects: ViewerProject[] }) {
  const onTrack = projects.filter((p) => p.health === "ON_TRACK" && p.lifecycle !== "DELIVERED").length;
  const atRisk = projects.filter((p) => p.health === "AT_RISK").length;
  const delayed = projects.filter((p) => p.health === "DELAYED").length;
  const delivered = projects.filter((p) => p.lifecycle === "DELIVERED").length;

  const data = [
    { name: "On Track", value: onTrack, color: "#16A34A" },
    { name: "Delivered", value: delivered, color: "#2563EB" },
    { name: "At Risk", value: atRisk, color: "#D97706" },
    { name: "Delayed", value: delayed, color: "#DC2626" },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-xs text-app-text-muted">
        No active project data available
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
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
              borderRadius: "0.5rem",
              fontSize: "12px",
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-xs text-app-text-secondary">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MilestoneProgressBarChart({ milestones }: { milestones: ViewerMilestone[] }) {
  const data = milestones.map((m) => ({
    name: m.key,
    completed: m.completedPoints,
    remaining: Math.max(0, m.totalPoints - m.completedPoints),
    title: m.title,
  }));

  if (data.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-xs text-app-text-muted">
        No milestone point metrics available
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
              borderRadius: "0.5rem",
              fontSize: "12px",
            }}
          />
          <Legend
            verticalAlign="top"
            height={32}
            formatter={(value) => (
              <span className="text-xs text-app-text-secondary capitalize">{value} Points</span>
            )}
          />
          <Bar dataKey="completed" stackId="a" fill="#2563EB" name="Completed" radius={[0, 0, 0, 0]} />
          <Bar dataKey="remaining" stackId="a" fill="#93C5FD" name="Remaining" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TaskStateBreakdownChart({ tasks }: { tasks: ViewerTask[] }) {
  const states = [
    { name: "Done", count: tasks.filter((t) => t.state === "DONE").length, color: "#16A34A" },
    { name: "In Review", count: tasks.filter((t) => t.state === "IN_REVIEW").length, color: "#8B5CF6" },
    { name: "In Progress", count: tasks.filter((t) => t.state === "IN_PROGRESS").length, color: "#3B82F6" },
    { name: "Blocked", count: tasks.filter((t) => t.state === "BLOCKED").length, color: "#EF4444" },
    { name: "Open", count: tasks.filter((t) => t.state === "OPEN").length, color: "#94A3B8" },
  ].filter((s) => s.count > 0);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={states} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
          <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
              borderRadius: "0.5rem",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="count" name="Tasks" radius={[0, 4, 4, 0]}>
            {states.map((entry, index) => (
              <Cell key={`bar-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProgressTrajectoryChart() {
  const data = [
    { week: "W40", individual: 10, structured: 0 },
    { week: "W41", individual: 20, structured: 20 },
    { week: "W42", individual: 30, structured: 20 },
    { week: "W43", individual: 30, structured: 50 },
    { week: "W44", individual: 45, structured: 50 },
    { week: "W45 (Current)", individual: 45, structured: 50 },
  ];

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorStructured" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="colorIndividual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} unit="%" />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
              borderRadius: "0.5rem",
              fontSize: "12px",
            }}
          />
          <Legend
            verticalAlign="top"
            height={32}
            formatter={(value) => <span className="text-xs text-app-text-secondary">{value}</span>}
          />
          <Area
            type="monotone"
            dataKey="structured"
            stroke="#2563EB"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorStructured)"
            name="Structured (CRM-100 Baseline %)"
          />
          <Area
            type="monotone"
            dataKey="individual"
            stroke="#10B981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorIndividual)"
            name="Individual (SOLO-10 Developer %)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
