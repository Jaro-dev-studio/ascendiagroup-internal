import "server-only";

import { getGoogleAccessToken } from "./google-auth";
import { getIntegrationCredentials } from "./store";

export async function createClientDriveFolder(
  clientName: string
): Promise<{ id: string; url: string }> {
  const credentials = await getIntegrationCredentials("GOOGLE_DRIVE");
  if (!credentials?.serviceAccountJson || !credentials?.parentFolderId) {
    throw new Error("Google Drive is not connected");
  }

  console.log(`[Drive] creating client folder for ${clientName}...`);

  const token = await getGoogleAccessToken(credentials.serviceAccountJson, [
    "https://www.googleapis.com/auth/drive",
  ]);

  const response = await fetch(
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: clientName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [credentials.parentFolderId],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Drive API error (${response.status}): ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    id: string;
    webViewLink?: string;
  };

  console.log(`[Drive] folder created: ${payload.id}`);

  return {
    id: payload.id,
    url: payload.webViewLink ?? `https://drive.google.com/drive/folders/${payload.id}`,
  };
}
