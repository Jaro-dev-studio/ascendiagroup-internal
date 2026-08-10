import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary-50 p-6">
      <div className="text-center">
        <FileQuestion className="mx-auto size-16 text-secondary-300" />
        <h1 className="mt-6 text-2xl font-bold text-secondary-900">
          Quote Not Found
        </h1>
        <p className="mt-2 text-secondary-600">
          This quote link may have expired or does not exist.
        </p>
        <Link href="/" className="mt-8 inline-block">
          <Button>Return Home</Button>
        </Link>
      </div>
    </div>
  );
}
