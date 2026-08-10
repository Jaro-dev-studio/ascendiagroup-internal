export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="size-12 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        <p className="text-secondary-600">Loading Sales View...</p>
      </div>
    </div>
  );
}
