/** Display types shared by the delivery workspace UI kit (src/components/delivery/DeliveryUI.tsx). */

export type Health = "ON_TRACK" | "AT_RISK" | "OFF_TRACK";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "BLOCKED" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ReviewStatus = "PENDING" | "APPROVED" | "CHANGES_REQUESTED";

/** The fields an avatar needs to render a person. */
export interface AvatarPerson {
  id: string;
  name: string;
  initials: string;
  color: string;
}
