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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "../_services/super-admin-service";

function useClientMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

interface TooltipPayloadEntry {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}

function DarkChartTooltip({
  active,
  payload,
  label,
  isCurrency = true,
  unit = "",
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  isCurrency?: boolean;
  unit?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 py-2 text-xs shadow-xl text-[var(--color-text-primary)]">
      {label && (
        <div className="font-semibold text-[var(--color-text-primary)] mb-1 pb-1 border-b border-[var(--color-border)]">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.color || "#3B82F6" }}
              />
              {entry.name || entry.dataKey}
            </span>
            <span className="font-semibold text-[var(--color-text-primary)]">
              {isCurrency
                ? formatCurrency(Number(entry.value || 0))
                : `${Number(entry.value || 0).toLocaleString()}${unit}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface RevenuePoint {
  period: string;
  mrr: number;
  collected: number;
  refunded: number;
}

export function RevenueOverviewChart({
  data,
  height = 260,
}: {
  data: RevenuePoint[];
  height?: number;
}) {
  const mounted = useClientMounted();

  if (!mounted) {
    return <div className="w-full rounded-xl bg-[var(--color-elevated)] animate-pulse" style={{ height }} />;
  }

  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="saMrrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="saCollGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
          />
          <Tooltip
            content={<DarkChartTooltip isCurrency />}
            cursor={{ stroke: "#3B82F6", strokeWidth: 1, strokeDasharray: "3 3" }}
          />
          <Area
            type="monotone"
            dataKey="collected"
            name="Collected"
            stroke="#10B981"
            strokeWidth={2}
            fill="url(#saCollGrad)"
            activeDot={{ r: 5, stroke: "#10B981", strokeWidth: 2, fill: "var(--color-surface)" }}
            animationDuration={650}
            animationEasing="ease-out"
          />
          <Area
            type="monotone"
            dataKey="mrr"
            name="MRR Run-Rate"
            stroke="#3B82F6"
            strokeWidth={2.4}
            fill="url(#saMrrGrad)"
            activeDot={{ r: 5, stroke: "#3B82F6", strokeWidth: 2, fill: "var(--color-surface)" }}
            animationDuration={650}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface LiveTelemetryPoint {
  time: string;
  requestsPerMin: number;
  activeSessions: number;
  latencyMs: number;
}

export function LiveTelemetryChart({
  data,
  height = 200,
}: {
  data: LiveTelemetryPoint[];
  height?: number;
}) {
  const mounted = useClientMounted();

  if (!mounted) {
    return <div className="w-full rounded-xl bg-[var(--color-elevated)] animate-pulse" style={{ height }} />;
  }

  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="saLiveReqGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="saLiveSessGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            content={<DarkChartTooltip isCurrency={false} />}
            cursor={{ stroke: "#8B5CF6", strokeWidth: 1, strokeDasharray: "3 3" }}
          />
          <Area
            type="monotone"
            dataKey="requestsPerMin"
            name="API Req / min"
            stroke="#8B5CF6"
            strokeWidth={2.2}
            fill="url(#saLiveReqGrad)"
            isAnimationActive
            animationDuration={450}
            activeDot={{ r: 5, stroke: "#8B5CF6", strokeWidth: 2, fill: "var(--color-surface)" }}
          />
          <Area
            type="monotone"
            dataKey="activeSessions"
            name="Live Sessions"
            stroke="#06B6D4"
            strokeWidth={2}
            fill="url(#saLiveSessGrad)"
            isAnimationActive
            animationDuration={450}
            activeDot={{ r: 5, stroke: "#06B6D4", strokeWidth: 2, fill: "var(--color-surface)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface PlanSlice {
  name: string;
  orgs: number;
  mrr: number;
  color: string;
}

export function PlanDistributionChart({
  data,
  height = 220,
}: {
  data: PlanSlice[];
  height?: number;
}) {
  const mounted = useClientMounted();
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  return (
    <div className="w-full min-w-0 flex flex-col sm:flex-row items-center gap-4">
      <div className="w-full sm:w-1/2 min-w-0" style={{ height }}>
        {!mounted ? (
          <div className="w-full h-full rounded-xl bg-[var(--color-elevated)] animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="orgs"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={3}
                stroke="var(--color-surface)"
                strokeWidth={2}
                animationDuration={550}
                onMouseEnter={(_, idx) => setHoveredName(data[idx]?.name || null)}
                onMouseLeave={() => setHoveredName(null)}
              >
                {data.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.color}
                    opacity={hoveredName && hoveredName !== entry.name ? 0.45 : 1}
                    style={{ transition: "opacity 200ms ease, transform 200ms ease" }}
                  />
                ))}
              </Pie>
              <Tooltip content={<DarkChartTooltip isCurrency={false} />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="w-full sm:w-1/2 space-y-2.5 min-w-0">
        {data.map((slice) => {
          const isHovered = hoveredName === slice.name;
          return (
            <div
              key={slice.name}
              onMouseEnter={() => setHoveredName(slice.name)}
              onMouseLeave={() => setHoveredName(null)}
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition-all duration-200 cursor-pointer ${
                isHovered
                  ? "border-blue-500/60 bg-[var(--color-hover)] -translate-y-0.5 shadow-sm"
                  : "border-[var(--color-border)] bg-[var(--color-app-bg)]"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0 transition-transform duration-200"
                  style={{
                    backgroundColor: slice.color,
                    transform: isHovered ? "scale(1.25)" : "scale(1)",
                  }}
                />
                <span className="font-medium text-[var(--color-text-primary)] truncate">
                  {slice.name}
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {slice.orgs} orgs
                </span>
                <span className="block text-[10px] text-[var(--color-text-muted)]">
                  {formatCurrency(slice.mrr)}/mo
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface MonthlyBarPoint {
  label: string;
  primary: number;
  secondary?: number;
}

export function ComparisonBarChart({
  data,
  primaryLabel,
  secondaryLabel,
  primaryColor = "#3B82F6",
  secondaryColor = "#F59E0B",
  isCurrency = false,
  height = 230,
}: {
  data: MonthlyBarPoint[];
  primaryLabel: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  isCurrency?: boolean;
  height?: number;
}) {
  const mounted = useClientMounted();

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
            width={42}
            tickFormatter={(v) =>
              isCurrency ? `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}` : `${v}`
            }
          />
          <Tooltip
            content={<DarkChartTooltip isCurrency={isCurrency} />}
            cursor={{ fill: "rgba(59, 130, 246, 0.1)" }}
          />
          <Bar
            dataKey="primary"
            name={primaryLabel}
            fill={primaryColor}
            radius={[5, 5, 0, 0]}
            maxBarSize={36}
            animationDuration={600}
          />
          {secondaryLabel && (
            <Bar
              dataKey="secondary"
              name={secondaryLabel}
              fill={secondaryColor}
              radius={[5, 5, 0, 0]}
              maxBarSize={36}
              animationDuration={600}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
