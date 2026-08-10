const LOG = "[Slack]";

export interface SlackMessage {
  channel: string;
  text: string;
  blocks?: unknown[];
}

/**
 * Posts a message with the workspace bot token.
 *
 * Never throws: notifications are a side effect of the work that triggered
 * them, so a Slack outage must not fail the caller's operation.
 */
export async function sendSlackMessage(message: SlackMessage): Promise<boolean> {
  try {
    const slackToken = process.env.SLACK_BOT_TOKEN;
    if (!slackToken) {
      console.error(`${LOG} Bot token not configured`);
      return false;
    }

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${slackToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (!result.ok) {
      console.error(`${LOG} Failed to send message:`, result.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`${LOG} Error sending message:`, error);
    return false;
  }
}
