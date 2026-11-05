import React from "react";
import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Avatar({ name, className, size = "md" }: AvatarProps) {
  const getInitials = (n: string) => {
    const parts = n.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  const sizes = {
    sm: "h-7 w-7 text-xs",
    md: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm font-semibold",
  };

  // Deterministic subtle pastel colors based on character code
  const colors = [
    "bg-blue-600 text-white",
    "bg-indigo-600 text-white",
    "bg-emerald-600 text-white",
    "bg-violet-600 text-white",
    "bg-amber-600 text-white",
    "bg-rose-600 text-white",
  ];
  const charCode = name.charCodeAt(0) || 0;
  const colorClass = colors[charCode % colors.length];

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-medium shadow-sm select-none",
        sizes[size],
        colorClass,
        className
      )}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}

