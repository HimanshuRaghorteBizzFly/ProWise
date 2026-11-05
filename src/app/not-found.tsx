import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function RootNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] p-6">
      <div className="max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 flex items-center justify-center mx-auto mb-4">
          <FileQuestion className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Page Not Found</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          The page or workspace resource you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Return to ProWise
        </Link>
      </div>
    </div>
  );
}

