import { isJaroDevTeamEmail } from "@/lib/constants";

export interface TranscriptSegment {
  speech: string;
  start_time: number;
  end_time: number;
  speaker: { name: string };
}

export interface TranscriptClientUser {
  email: string;
  firstName: string | null;
  lastName: string | null;
  clientCompanyId: string;
  clientCompany: {
    id: string;
    name: string;
  };
}

export function getUserDisplayName(
  firstName: string | null,
  lastName: string | null,
  email: string
): string {
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  if (firstName) {
    return firstName;
  }
  const localPart = email.split("@")[0];
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

/**
 * Collapses consecutive segments from the same speaker into labelled blocks, and
 * annotates known client contacts and Jaro.dev team members so downstream AI
 * prompts can tell who said what.
 */
export function formatTranscriptBySpeaker(
  transcript: TranscriptSegment[],
  clientUsers: TranscriptClientUser[]
): string {
  if (!transcript || transcript.length === 0) {
    return "";
  }

  // Match transcript speaker labels against known client contacts by first name,
  // last name or full display name.
  const speakerToClientUser = new Map<string, TranscriptClientUser>();

  for (const clientUser of clientUsers) {
    const displayName = getUserDisplayName(
      clientUser.firstName,
      clientUser.lastName,
      clientUser.email
    );

    for (const segment of transcript) {
      const speakerName = segment.speaker?.name || "";
      const speakerNameLower = speakerName.toLowerCase();
      const firstNameLower = clientUser.firstName?.toLowerCase() || "";
      const lastNameLower = clientUser.lastName?.toLowerCase() || "";
      const displayNameLower = displayName.toLowerCase();

      if (
        (firstNameLower && speakerNameLower.includes(firstNameLower)) ||
        (lastNameLower && speakerNameLower.includes(lastNameLower)) ||
        speakerNameLower.includes(displayNameLower) ||
        displayNameLower.includes(speakerNameLower)
      ) {
        speakerToClientUser.set(speakerName, clientUser);
      }
    }
  }

  const lines: string[] = [];
  let currentSpeaker: string | null = null;
  let currentSpeakerLabel: string | null = null;
  let currentSpeech: string[] = [];

  for (const segment of transcript) {
    const speakerName = segment.speaker?.name || "Unknown";

    let speakerLabel: string;
    const clientUser = speakerToClientUser.get(speakerName);
    if (clientUser) {
      const displayName = getUserDisplayName(
        clientUser.firstName,
        clientUser.lastName,
        clientUser.email
      );
      speakerLabel = `${displayName} (Client)`;
    } else if (
      speakerName.toLowerCase().includes("jaro") ||
      isJaroDevTeamEmail(speakerName)
    ) {
      speakerLabel = `${speakerName} (Jaro.dev)`;
    } else {
      speakerLabel = speakerName;
    }

    if (speakerName !== currentSpeaker) {
      if (currentSpeaker !== null && currentSpeech.length > 0) {
        lines.push(`[${currentSpeakerLabel}]`);
        lines.push(currentSpeech.join(" "));
        lines.push("");
      }

      currentSpeaker = speakerName;
      currentSpeakerLabel = speakerLabel;
      currentSpeech = [segment.speech];
    } else {
      currentSpeech.push(segment.speech);
    }
  }

  if (currentSpeaker !== null && currentSpeech.length > 0) {
    lines.push(`[${currentSpeakerLabel}]`);
    lines.push(currentSpeech.join(" "));
  }

  return lines.join("\n");
}

export function extractCompanyNameFromEmail(email: string): string {
  const domain = email.split("@")[1];
  if (!domain) {
    return "Unknown";
  }
  const domainName = domain.split(".")[0];
  return domainName.charAt(0).toUpperCase() + domainName.slice(1);
}
