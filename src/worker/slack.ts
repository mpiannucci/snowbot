import { WebClient, KnownBlock } from "@slack/web-api";

/**
 * Creates a Slack WebClient instance with the provided token.
 * The token should be a Bot User OAuth Token (starts with xoxb-).
 */
export function createSlackClient(token: string): WebClient {
  return new WebClient(token);
}

/**
 * Sends a message to a Slack channel.
 *
 * @param client - The Slack WebClient instance
 * @param channel - The channel ID or name (e.g., "#general" or "C1234567890")
 * @param text - The message text to send
 * @returns The response from the Slack API
 */
export async function sendMessage(
  client: WebClient,
  channel: string,
  text: string
) {
  const result = await client.chat.postMessage({
    channel,
    text,
  });

  return {
    ok: result.ok,
    channel: result.channel,
    ts: result.ts,
    message: result.message,
  };
}

/**
 * Sends a message with Block Kit blocks for rich formatting.
 *
 * @param client - The Slack WebClient instance
 * @param channel - The channel ID or name
 * @param text - Fallback text for notifications
 * @param blocks - Block Kit blocks array
 * @returns The response from the Slack API
 */
export async function sendBlockMessage(
  client: WebClient,
  channel: string,
  text: string,
  blocks: KnownBlock[]
) {
  const result = await client.chat.postMessage({
    channel,
    text,
    blocks,
  });

  return {
    ok: result.ok,
    channel: result.channel,
    ts: result.ts,
    message: result.message,
  };
}
