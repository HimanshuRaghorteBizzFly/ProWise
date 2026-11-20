"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Customized, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Health, OrgProject } from "@/mocks/org-console";
import { PROJECT_PROGRESS_NOTES } from "@/mocks/org-console";

/* ----------------------------------------------------------------------------
 * Palette: one flat colour family per health state (front / top / side faces)
 * ------------------------------------------------------------------------- */

const HEALTH_FACES: Record<Health, { front: string; top: string; side: string; label: string }> = {
  ON_TRACK: { front: "#10B981", top: "#6EE7B7", side: "#047857", label: "On track" },
  AT_RISK: { front: "#F59E0B", top: "#FCD34D", side: "#B45309", label: "At risk" },
  OFF_TRACK: { front: "#EF4444", top: "#FCA5A5", side: "#B91C1C", label: "Delayed" },
};

const HEALTH_ORDER: Health[] = ["ON_TRACK", "AT_RISK", "OFF_TRACK"];

interface Datum {
  code: string;
  name: string;
  progress: number;
  planned: number;
  health: Health;
  method: string;
  reason: string;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/* ----------------------------------------------------------------------------
 * Custom bar shape: front face + lighter top face + darker side face
 * ------------------------------------------------------------------------- */

interface ShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: Datum;
}

function make3DBar(activeIndex: number | null, reduced: boolean) {
  function Bar3D(props: unknown) {
    const { x = 0, y = 0, width = 0, height = 0, index = -1, payload } = props as ShapeProps;
    if (!payload || width <= 0) return <g />;
    const faces = HEALTH_FACES[payload.health];
    const d = Math.max(3, Math.min(9, width * 0.28)); // depth offset
    const h = Math.max(0, height);
    const active = index === activeIndex;
    const lift = active && !reduced ? -5 : 0;
    const top = `${x},${y} ${x + d},${y - d} ${x + width + d},${y - d} ${x + width},${y}`;
    const side = `${x + width},${y} ${x + width + d},${y - d} ${x + width + d},${y + h - d} ${x + width},${y + h}`;
    return (
      <g>
        {/* contact shadow on the floor, grows when the bar lifts */}
        <ellipse
          cx={x + width / 2 + d / 2}
          cy={y + h + 2}
          rx={width / 2 + d / 2}
          ry={3}
          fill="#0F172A"
          opacity={active ? 0.22 : 0.1}
          style={{ transition: reduced ? "none" : "opacity 180ms ease" }}
        />
        <g style={{ transform: `translateY(${lift}px)`, transition: reduced ? "none" : "transform 180ms ease-out" }}>
          {h > 0 && <rect x={x} y={y} width={width} height={h} fill={faces.front} />}
          {h > 0 && <polygon points={side} fill={faces.side} />}
          <polygon points={top} fill={faces.top} />
          {active && <rect x={x} y={y} width={width} height={h} fill="#FFFFFF" opacity={0.12} />}
          <text
            x={x + width / 2 + d / 2}
            y={y - d - 6}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="var(--color-text-primary)"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {payload.progress}%
          </text>
        </g>
      </g>
    );
  }
  return Bar3D;
}

/* ----------------------------------------------------------------------------
 * Floor strip under the plot area
 * ------------------------------------------------------------------------- */

interface CustomizedProps {
  offset?: { left: number; top: number; width: number; height: number };
}

function FloorStrip({ offset }: CustomizedProps) {
  if (!offset) return null;
  const { left, top, width, height } = offset;
  const y = top + height;
  return (
    <g aria-hidden>
      <polygon points={`${left},${y} ${left + width},${y} ${left + width + 8},${y - 6} ${left + 8},${y - 6}`} fill="var(--color-elevated)" opacity={0.9} />
      <rect x={left} y={y} width={width} height={7} rx={2} fill="var(--color-elevated)" stroke="var(--color-border)" />
    </g>
  );
}

/* ----------------------------------------------------------------------------
 * Tooltip
 * ------------------------------------------------------------------------- */

function ProgressTooltip({ active, payload }: { active?: boolean; payload?: { payload: Datum }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const faces = HEALTH_FACES[p.health];
  return (
    <div className="max-w-[260px] rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 py-2.5 text-xs shadow-xl text-[var(--color-text-primary)]">
      <div className="flex items-start justify-between gap-3 pb-1.5 mb-1.5 border-b border-[var(--color-border)]">
        <span className="font-semibold leading-snug">{p.name}</span>
        <span className="text-sm font-bold tabular-nums">{p.progress}%</span>
      </div>
      <p className="flex items-center gap-1.5 font-medium" style={{ color: faces.side }}>
        <span className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: faces.front }} />
        {faces.label} · plan {p.planned}%
      </p>
      <p className="mt-1 text-[var(--color-text-secondary)]">{p.reason}</p>
      <p className="mt-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Method: {p.method}</p>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Chart
 * ------------------------------------------------------------------------- */

export function Progress3DChart({ projects, height = 280 }: { projects: OrgProject[]; height?: number }) {
  const reduced = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  useEffect(() => setMounted(true), []);

  const data: Datum[] = useMemo(
    () =>
      projects.map((p) => ({
        code: p.code,
        name: p.name,
        progress: p.progress,
        planned: p.plannedProgress,
        health: p.health,
        method: PROJECT_PROGRESS_NOTES[p.id]?.method ?? (p.mode === "INDIVIDUAL" ? "Self-reported check-ins" : "Weighted tasks"),
        reason: PROJECT_PROGRESS_NOTES[p.id]?.healthReason ?? "No health notes recorded.",
      })),
    [projects]
  );
  const shape = useMemo(() => make3DBar(activeIndex, reduced), [activeIndex, reduced]);

  const summary = data.map((d) => `${d.name} ${d.progress}% (${HEALTH_FACES[d.health].label})`).join(", ");

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5" aria-label="Legend">
        {HEALTH_ORDER.map((h) => (
          <span key={h} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
            <span className="relative inline-block h-3 w-3" aria-hidden>
              <span className="absolute inset-0 rounded-[2px]" style={{ backgroundColor: HEALTH_FACES[h].front }} />
              <span className="absolute -right-[3px] top-[2px] h-[10px] w-[3px] rounded-r-[1px]" style={{ backgroundColor: HEALTH_FACES[h].side }} />
            </span>
            {HEALTH_FACES[h].label}
            <b className="tabular-nums text-[var(--color-text-primary)]">{data.filter((d) => d.health === h).length}</b>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] sm:ml-auto">
          <span className="inline-block w-4 border-t border-dashed border-[var(--color-text-muted)]" aria-hidden />
          50% / 100% marks
        </span>
      </div>

      <div className="w-full min-w-0" style={{ height }} role="img" aria-label={`Progress per project: ${summary}`}>
        {!mounted ? (
          <div className="h-full w-full rounded-xl bg-[var(--color-elevated)] animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 28, right: 14, left: -6, bottom: 4 }} barCategoryGap="22%" onMouseLeave={() => setActiveIndex(null)}>
              <XAxis dataKey="code" tick={{ fontSize: 11, fill: "var(--color-text-secondary)", fontWeight: 600 }} tickLine={false} axisLine={false} interval={0} dy={8} />
              <YAxis domain={[0, 112]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} width={40} />
              <Customized component={FloorStrip} />
              <ReferenceLine y={50} stroke="var(--color-text-muted)" strokeOpacity={0.55} strokeDasharray="4 4" ifOverflow="extendDomain" />
              <ReferenceLine y={100} stroke="var(--color-text-muted)" strokeOpacity={0.55} strokeDasharray="4 4" ifOverflow="extendDomain" />
              <Tooltip content={<ProgressTooltip />} cursor={false} isAnimationActive={!reduced} wrapperStyle={{ outline: "none" }} />
              <Bar
                dataKey="progress"
                name="Progress"
                maxBarSize={46}
                shape={shape}
                isAnimationActive={!reduced}
                animationDuration={700}
                animationEasing="ease-out"
                onMouseEnter={(_: unknown, index: number) => setActiveIndex(index)}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <table className="sr-only">
        <caption>Progress per project</caption>
        <thead><tr><th>Project</th><th>Progress</th><th>Health</th><th>Method</th></tr></thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.code}><td>{d.name}</td><td>{d.progress}%</td><td>{HEALTH_FACES[d.health].label}: {d.reason}</td><td>{d.method}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
