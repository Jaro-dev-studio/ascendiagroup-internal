import Image from "next/image";
import { FileX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function QuoteNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary-50 px-6">
      <Image
        src="/logos/trusted.png"
        alt="Jaro.dev"
        width={120}
        height={40}
        className="mb-8 h-8 w-auto"
      />
      <div className="text-center">
        <FileX className="mx-auto size-16 text-secondary-300" />
        <h1 className="mt-6 text-2xl font-bold text-secondary-900">
          Quote Not Found
        </h1>
        <p className="mt-2 max-w-md text-secondary-600">
          This quote may have expired or the link is invalid. Please contact us
          if you believe this is an error.
        </p>
        <Button asChild className="mt-8">
          <a href="mailto:hello@jaro.dev">Contact Us</a>
        </Button>
      </div>
    </div>
  );
}
