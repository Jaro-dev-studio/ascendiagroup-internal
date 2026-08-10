import "server-only";

export interface ClientConfig {
  name: string;
  uniqueClientId: string;
  linearViewId: string; // Can be a Linear team ID, project ID, or leave empty to fetch all org issues
}

export const clientConfigs: ClientConfig[] = [
  {
    name: "FitnessGM",
    uniqueClientId: "fitnessgm429342834012",
    linearViewId: "143575e4-4af6-461c-aaf7-417067a430c4" // Linear team ID or view ID
  }
];

export function getClientConfig(clientId: string): ClientConfig | null {
  return clientConfigs.find(client => client.uniqueClientId === clientId) || null;
}
