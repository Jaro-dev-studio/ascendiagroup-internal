import BusinessOSClient from "./client";

interface PageProps {
  searchParams: Promise<{
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
  }>;
}

export default async function BusinessOSPage({ searchParams }: PageProps) {
  const params = await searchParams;
  
  return (
    <BusinessOSClient
      utmSource={params.utm_source}
      utmMedium={params.utm_medium}
      utmCampaign={params.utm_campaign}
      utmTerm={params.utm_term}
      utmContent={params.utm_content}
    />
  );
}
