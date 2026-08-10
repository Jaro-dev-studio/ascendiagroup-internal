import { fetchAdGeneratorData } from "@/lib/fetchers/ad-generator";
import { AdGeneratorClient } from "./client";

export default async function AdGeneratorPage() {
  const { data, error } = await fetchAdGeneratorData();

  return (
    <AdGeneratorClient
      initialTargets={data?.targets || []}
      initialSolutions={data?.solutions || []}
      initialRiskReversals={data?.riskReversals || []}
      initialDestinations={data?.destinations || []}
      initialPermutations={data?.permutations || []}
      error={error}
    />
  );
}
