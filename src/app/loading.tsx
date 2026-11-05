export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
        <p className="text-sm text-[var(--color-text-secondary)] font-medium">Loading ProWise...</p>
      </div>
    </div>
  );
}

