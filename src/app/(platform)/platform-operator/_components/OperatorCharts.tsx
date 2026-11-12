"use client";

import React, { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

interface TooltipEntry {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}

function OpTooltip({
  active,
  payload,
  label,
  unit = "",
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  unit?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 py-2 text-xs shadow-xl text-[var(--color-text-primary)]">
      {label && (
        <div className="font-semibold mb-1 pb-1 border-b border-[var(--color-border)]">{label}</div>
      )}
      <div className="space-y-1">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.color || "#0D9488" }}
              />
              {entry.name || entry.dataKey}
            </span>
            <span className="font-semibold text-[var(--color-text-primary)]">
              {entry.value}
              {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TelemetryAreaChart({
  data,
  primaryKey,
  primaryLabel,
  secondaryKey,
  secondaryLabel,
  unit = "",
  height = 240,
}: {
  data: Record<string, string | number>[];
  primaryKey: string;
  primaryLabel: string;
  secondaryKey?: string;
  secondaryLabel?: string;
  unit?: string;
  height?: number;
}) {
  const mounted = useMounted();
  if (!mounted) {
    return <div className="w-full rounded-xl bg-[var(--color-elevated)] animate-pulse" style={{ height }} />;
  }

  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="opTealGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0D9488" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="opAmberGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip content={<OpTooltip unit={unit} />} />
          <Area
            type="monotone"
            dataKey={primaryKey}
            name={primaryLabel}
            stroke="#0D9488"
            strokeWidth={2}
            fill="url(#opTealGrad)"
          />
          {secondaryKey && secondaryLabel && (
            <Area
              type="monotone"
              dataKey={secondaryKey}
              name={secondaryLabel}
              stroke="#F59E0B"
              strokeWidth={2}
              fill="url(#opAmberGrad)"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function QueueBarChart({
  data,
  primaryKey,
  primaryLabel,
  secondaryKey,
  secondaryLabel,
  unit = "",
  height = 230,
}: {
  data: Record<string, string | number>[];
  primaryKey: string;
  primaryLabel: string;
  secondaryKey?: string;
  secondaryLabel?: string;
  unit?: string;
  height?: number;
}) {
  const mounted = useMounted();
  if (!mounted) {
    return <div className="w-full rounded-xl bg-[var(--color-elevated)] animate-pulse" style={{ height }} />;
  }

  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            tickLine={false}
            axisLine={false}
            width={38}
          />
          <Tooltip
            content={<OpTooltip unit={unit} />}
            cursor={{ fill: "rgba(20, 184, 166, 0.08)" }}
          />
          <Bar dataKey={primaryKey} name={primaryLabel} fill="#0D9488" radius={[5, 5, 0, 0]} maxBarSize={36} />
          {secondaryKey && secondaryLabel && (
            <Bar
              dataKey={secondaryKey}
              name={secondaryLabel}
              fill="#F59E0B"
              radius={[5, 5, 0, 0]}
              maxBarSize={36}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

