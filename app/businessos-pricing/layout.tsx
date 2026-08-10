import { Metadata } from "next";

const title = "BusinessOS© Pricing";
const description =
  "What BusinessOS costs, why it is priced this way, and exactly what you pay us versus what you pay your own infrastructure vendors.";

// Publicly reachable but deliberately kept out of search results: this page is
// shared with prospects on calls, not indexed. app/robots.ts blocks it too.
export const metadata: Metadata = {
  title,
  description,
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  openGraph: {
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function BusinessOSPricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
