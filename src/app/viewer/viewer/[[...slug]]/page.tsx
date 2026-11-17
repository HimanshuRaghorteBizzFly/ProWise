import { redirect } from "next/navigation";

export default function ViewerCatchAllPage({
  params,
}: {
  params: { slug?: string[] };
}) {
  const subpath = params.slug && params.slug.length > 0 ? params.slug.join("/") : "dashboard";
  redirect(`/org/org-acme/viewer/${subpath}`);
}
