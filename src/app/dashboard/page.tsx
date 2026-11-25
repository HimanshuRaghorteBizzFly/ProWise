import { redirect } from "next/navigation";

export default function RootDashboardRedirect() {
  redirect("/select-workspace");
}
