import { redirect } from "next/navigation";

/** Legacy confirmation links now use the account setup flow, which lets the user choose a password. */
export default function VerifyEmailPage({ searchParams }: { searchParams: { token?: string } }) {
  if (!searchParams.token) redirect("/signup");
  redirect(`/reset-password?token=${encodeURIComponent(searchParams.token)}&setup=1`);
}
