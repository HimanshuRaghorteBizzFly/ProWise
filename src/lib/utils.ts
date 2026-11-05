import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined || val < 0) return "Not Reported";
  return `${Math.round(val)}%`;
}

