"use client";

import React, { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function useClientMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function ChartSkeleton({ height }: { height: number }) {
  return <div className="w-full rounded-xl bg-[var(--color-elevated)] animate-pulse" style={{ height }} />;
}

interface TooltipEntry {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
  payload?: { color?: string; fill?: string };
}

function ChartTooltip({
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
                style={{ backgroundColor: entry.payload?.color || entry.color || entry.payload?.fill || "#3B82F6" }}
              />
              {entry.name || entry.dataKey}
            </span>
            <span className="font-semibold">
              {Number(entry.value || 0).toLocaleString()}
              {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const AXIS_TICK = { fontSize: 11, fill: "var(--color-text-secondary)" };

/* ----------------------------------------------------------------------------
 * Donut with interactive legend
 * ------------------------------------------------------------------------- */

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

export function DonutChart({
  data,
  centerLabel,
  centerValue,
  height = 200,
  unit = "",
}: {
  data: DonutSlice[];
  centerLabel?: string;
  centerValue?: React.ReactNode;
  height?: number;
  unit?: string;
}) {
  const mounted = useClientMounted();
  const [hovered, setHovered] = useState<string | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="w-full min-w-0 flex flex-col sm:flex-row items-center gap-4">
      <div className="relative w-full sm:w-1/2 min-w-0" style={{ height }}>
        {!mounted ? (
          <ChartSkeleton height={height} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="62%"
                outerRadius="88%"
                paddingAngle={3}
                stroke="var(--color-surface)"
                strokeWidth={2}
                animationDuration={650}
                onMouseEnter={(_, idx) => setHovered(data[idx]?.name || null)}
                onMouseLeave={() => setHovered(null)}
              >
                {data.map((d) => (
                  <Cell
                    key={d.name}
                    fill={d.color}
                    opacity={hovered && hovered !== d.name ? 0.4 : 1}
                    style={{ transition: "opacity 200ms ease" }}
                  />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip unit={unit} />} />
            </PieChart>
          </ResponsiveContainer>
        )}
        {mounted && (centerValue !== undefined || centerLabel) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold tabular-nums text-[var(--color-text-primary)]">{centerValue ?? total}</span>
            {centerLabel && <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{centerLabel}</span>}
          </div>
        )}
      </div>
      <div className="w-full sm:w-1/2 space-y-1.5 min-w-0">
        {data.map((d) => {
          const isHovered = hovered === d.name;
          const pct = total ? Math.round((d.value / total) * 100) : 0;
          return (
            <div
              key={d.name}
              onMouseEnter={() => setHovered(d.name)}
              onMouseLeave={() => setHovered(null)}
              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-all duration-200 ${
                isHovered
                  ? "border-blue-500/60 bg-[var(--color-hover)] -translate-y-0.5 shadow-sm"
                  : "border-[var(--color-border)] bg-[var(--color-app-bg)]"
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0 transition-transform duration-200"
                  style={{ backgroundColor: d.color, transform: isHovered ? "scale(1.25)" : "scale(1)" }}
                />
                <span className="font-medium text-[var(--color-text-primary)] truncate">{d.name}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-[var(--color-text-primary)]">
                {d.value}
                <span className="ml-1 text-[10px] font-normal text-[var(--color-text-muted)]">{pct}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Grouped vertical bar chart
 * ------------------------------------------------------------------------- */

export interface BarPoint {
  label: string;
  primary: number;
  secondary?: number;
}

export function GroupedBarChart({
  data,
  primaryLabel,
  secondaryLabel,
  primaryColor = "#3B82F6",
  secondaryColor = "#F59E0B",
  height = 230,
  unit = "",
}: {
  data: BarPoint[];
  primaryLabel: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  height?: number;
  unit?: string;
}) {
  const mounted = useClientMounted();
  if (!mounted) return <ChartSkeleton height={height} />;
  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: "rgba(59, 130, 246, 0.1)" }} />
          <Bar dataKey="primary" name={primaryLabel} fill={primaryColor} radius={[5, 5, 0, 0]} maxBarSize={32} animationDuration={600} />
          {secondaryLabel && (
            <Bar dataKey="secondary" name={secondaryLabel} fill={secondaryColor} radius={[5, 5, 0, 0]} maxBarSize={32} animationDuration={600} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Horizontal bars (one colour per row) — progress per project, workload, waiting
 * ------------------------------------------------------------------------- */

export interface HBarPoint {
  name: string;
  value: number;
  color: string;
}

export function HorizontalBarChart({
  data,
  unit = "%",
  max,
  height,
  valueLabel = "Value",
}: {
  data: HBarPoint[];
  unit?: string;
  max?: number;
  height?: number;
  valueLabel?: string;
}) {
  const mounted = useClientMounted();
  const h = height ?? Math.max(160, data.length * 38 + 20);
  if (!mounted) return <ChartSkeleton height={h} />;
  return (
    <div className="w-full min-w-0" style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
          <XAxis type="number" domain={[0, max ?? "auto"]} tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}${unit}`} />
          <YAxis type="category" dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={false} width={92} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: "rgba(59, 130, 246, 0.08)" }} />
          <Bar dataKey="value" name={valueLabel} radius={[0, 6, 6, 0]} maxBarSize={18} animationDuration={650}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Actual vs planned area trend
 * ------------------------------------------------------------------------- */

export function TrendAreaChart({
  data,
  xKey,
  series,
  height = 220,
  unit = "",
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: { key: string; label: string; color: string; dashed?: boolean }[];
  height?: number;
  unit?: string;
}) {
  const mounted = useClientMounted();
  const id = React.useId().replace(/:/g, "");
  if (!mounted) return <ChartSkeleton height={height} />;
  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.color} stopOpacity={s.dashed ? 0.05 : 0.32} />
                <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey={xKey} tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} tickFormatter={(v) => `${v}${unit}`} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: "#3B82F6", strokeWidth: 1, strokeDasharray: "3 3" }} />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={s.dashed ? 1.6 : 2.4}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              fill={`url(#${id}-${s.key})`}
              activeDot={{ r: 5, stroke: s.color, strokeWidth: 2, fill: "var(--color-surface)" }}
              animationDuration={650}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Radial gauge
 * ------------------------------------------------------------------------- */

export function GaugeRing({
  value,
  color = "#3B82F6",
  label,
  size = 132,
}: {
  value: number;
  color?: string;
  label?: string;
  size?: number;
}) {
  const mounted = useClientMounted();
  if (!mounted) return <div className="rounded-full bg-[var(--color-elevated)] animate-pulse mx-auto" style={{ height: size, width: size }} />;
  return (
    <div className="relative mx-auto" style={{ height: size, width: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="76%" outerRadius="100%" data={[{ value, fill: color }]} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: "var(--color-elevated)" }} dataKey="value" cornerRadius={10} animationDuration={800} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-[var(--color-text-primary)]">{value}%</span>
        {label && <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>}
      </div>
    </div>
  );
}
