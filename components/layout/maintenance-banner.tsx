export function MaintenanceBanner({ message }: { message?: string }) {
  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm font-medium text-amber-300">
      ⚠️ Maintenance Mode — {message || "Some features may be temporarily unavailable."}
    </div>
  );
}
