import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  organizationName: z.string().min(2, "Organization name is required"),
});

export const checkInSchema = z.object({
  percent: z.number().min(0).max(100),
  accomplished: z.string().min(5, "Accomplished summary must be at least 5 characters"),
  nextSteps: z.string().min(5, "Next steps must be at least 5 characters"),
  projectedFinish: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Target date format must be YYYY-MM-DD"),
  blockers: z.array(z.string()).default([]),
  downwardRevisionReason: z.string().optional(),
  optionalEvidence: z.string().optional(),
});

export const projectCreateSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters"),
  key: z.string().min(2).max(10).regex(/^[A-Z0-9]+$/, "Key must be uppercase alphanumeric"),
  description: z.string().min(5, "Description is required"),
  mode: z.enum(["INDIVIDUAL", "STRUCTURED"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  cadence: z.enum(["DAILY", "WEEKLY", "FORTNIGHTLY"]),
  timezone: z.string().default("UTC"),
});

export const workItemSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  type: z.enum(["MILESTONE", "DELIVERABLE", "TASK", "SUBTASK"]),
  weight: z.number().min(1, "Weight must be greater than 0"),
  weightUnit: z.string().default("points"),
  criteria: z.string().min(5, "Acceptance criteria is required"),
  criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  dueDate: z.string().optional(),
  primaryAssigneeId: z.string().optional(),
});

