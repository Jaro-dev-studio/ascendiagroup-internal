import { Loader2 } from "lucide-react";

export default function QuoteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary-50">
      <div className="text-center">
        <Loader2 className="mx-auto size-8 animate-spin text-primary-600" />
        <p className="mt-4 text-secondary-600">Loading your quote...</p>
      </div>
    </div>
  );
}
