import { redirect } from "next/navigation";

/** Legacy Viewer URLs without an organization: the person picks one of their real organizations first. */
export default function ViewerCatchAllPage() {
  redirect("/select-workspace");
}
