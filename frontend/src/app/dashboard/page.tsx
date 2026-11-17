import { redirect } from "next/navigation";

export default function RootDashboardRedirect() {
  redirect("/org/org-acme/viewer/dashboard");
}
