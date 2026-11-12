"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { cn } from "@/lib/utils";
import styles from "@/styles/landing.module.css";

/** Detects desktop fine pointer vs touch devices and reduced motion preference. */
export function usePointerCapabilities() {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [hasFinePointer, setHasFinePointer] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setHasFinePointer(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return {
    interactiveMouse: hasFinePointer && !prefersReducedMotion,
    prefersReducedMotion,
  };
}

const PARTICLES = [
  { left: "10%", top: "16%", size: 6, color: "bg-blue-500/45", duration: "11s", tx: "16px", ty: "-28px" },
  { left: "24%", top: "38%", size: 5, color: "bg-indigo-500/40", duration: "14s", tx: "-18px", ty: "-22px" },
  { left: "78%", top: "14%", size: 7, color: "bg-teal-500/40", duration: "12s", tx: "-22px", ty: "24px" },
  { left: "86%", top: "48%", size: 5, color: "bg-blue-400/40", duration: "15s", tx: "14px", ty: "-26px" },
  { left: "16%", top: "74%", size: 6, color: "bg-violet-500/40", duration: "13s", tx: "20px", ty: "-18px" },
  { left: "66%", top: "78%", size: 5, color: "bg-sky-500/40", duration: "16s", tx: "-15px", ty: "-25px" },
  { left: "48%", top: "10%", size: 4, color: "bg-indigo-400/45", duration: "10s", tx: "12px", ty: "18px" },
];

/** Renders animated GPU gradient backdrop, subtle floating particles, and desktop cursor spotlight. */
export function InteractiveBackdrop() {
  const { interactiveMouse } = usePointerCapabilities();
  const mouseX = useMotionValue(-999);
  const mouseY = useMotionValue(-999);
  const smoothX = useSpring(mouseX, { stiffness: 180, damping: 28 });
  const smoothY = useSpring(mouseY, { stiffness: 180, damping: 28 });

  useEffect(() => {
    if (!interactiveMouse) return;
    const handleMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMove);
  }, [interactiveMouse, mouseX, mouseY]);

  const spotlightBg = useMotionTemplate`radial-gradient(520px circle at ${smoothX}px ${smoothY}px, rgba(59, 130, 246, 0.11), transparent 65%)`;

  return (
    <div className={styles.auroraBackdrop} aria-hidden="true">
      <div className={cn("absolute inset-0", styles.gridPattern)} />
      <div className={styles.auroraOrbOne} />
      <div className={styles.auroraOrbTwo} />
      <div className={styles.auroraOrbThree} />

      {PARTICLES.map((p, idx) => (
        <span
          key={idx}
          className={cn(styles.floatingParticle, p.color)}
          style={
            {
              left: p.left,
              top: p.top,
              width: `${p.size}px`,
              height: `${p.size}px`,
              "--duration": p.duration,
              "--tx": p.tx,
              "--ty": p.ty,
            } as React.CSSProperties
          }
        />
      ))}

      {interactiveMouse && (
        <motion.div className="fixed inset-0 pointer-events-none" style={{ background: spotlightBg }} />
      )}
    </div>
  );
}

/** Magnetic button wrapper with smooth spring pull on fine-pointer desktop screens. */
export function MagneticWrapper({
  children,
  className,
  strength = 0.22,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { interactiveMouse } = usePointerCapabilities();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 260, damping: 18, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 260, damping: 18, mass: 0.4 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactiveMouse || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const offsetX = e.clientX - (rect.left + rect.width / 2);
    const offsetY = e.clientY - (rect.top + rect.height / 2);
    x.set(offsetX * strength);
    y.set(offsetY * strength);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={interactiveMouse ? { x: springX, y: springY } : undefined}
      className={cn("inline-block", className)}
    >
      {children}
    </motion.div>
  );
}

/** Interactive 3D tilt card with mouse-tracked sheen and subtle elevation on hover. */
export function Tilt3DCard({
  children,
  className,
  onClick,
  maxTilt = 7,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  maxTilt?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { interactiveMouse, prefersReducedMotion } = usePointerCapabilities();
  const rotX = useMotionValue(0);
  const rotY = useMotionValue(0);
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);
  const [hovered, setHovered] = useState(false);

  const springRotX = useSpring(rotX, { stiffness: 220, damping: 22 });
  const springRotY = useSpring(rotY, { stiffness: 220, damping: 22 });
  const radialGlow = useMotionTemplate`radial-gradient(280px circle at ${glowX}% ${glowY}%, rgba(59, 130, 246, 0.14), transparent 72%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactiveMouse || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rotX.set((0.5 - py) * 2 * maxTilt);
    rotY.set((px - 0.5) * 2 * maxTilt);
    glowX.set(px * 100);
    glowY.set(py * 100);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    rotX.set(0);
    rotY.set(0);
  };

  return (
    <div className={styles.scene3d}>
      <motion.div
        ref={ref}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        whileHover={prefersReducedMotion ? undefined : { y: -4 }}
        transition={{ duration: 0.2 }}
        style={
          interactiveMouse
            ? {
                rotateX: springRotX,
                rotateY: springRotY,
                transformStyle: "preserve-3d",
              }
            : undefined
        }
        className={cn(
          "relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-sm transition-shadow duration-300",
          hovered ? "shadow-xl" : "shadow-subtle",
          styles.animatedBorderCard,
          onClick && "cursor-pointer",
          className
        )}
      >
        {interactiveMouse && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-200"
            style={{
              background: radialGlow,
              opacity: hovered ? 1 : 0,
            }}
          />
        )}
        <div className="relative z-10 h-full">{children}</div>
      </motion.div>
    </div>
  );
}

/** Scroll reveal section wrapper respecting reduced motion preferences. */
export function RevealBlock({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const prefersReducedMotion = Boolean(useReducedMotion());

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Animates numeric KPI values smoothly once scrolled into view. */
export function AnimatedCounter({
  value,
  suffix = "",
  prefix = "",
}: {
  value: number;
  suffix?: string;
  prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!inView || prefersReducedMotion) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const durationMs = 950;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, prefersReducedMotion]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

