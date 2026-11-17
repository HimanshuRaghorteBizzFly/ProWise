import { redirect } from "next/navigation";

export default function WorkspaceOrgRedirect() {
  redirect("/org/org-acme/viewer/dashboard");
}
