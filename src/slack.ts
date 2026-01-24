/**
 * Slack API integration module
 */

/**
 * Verify Slack request signature
 */
export async function verifySlackSignature(
	signature: string | null,
	timestamp: string | null,
	body: string,
	signingSecret: string
): Promise<boolean> {
	if (!signature || !timestamp || !signingSecret) return false;

	// Prevent replay attacks (request > 5 minutes old)
	const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
	if (parseInt(timestamp) < fiveMinutesAgo) return false;

	const sigBasestring = `v0:${timestamp}:${body}`;
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(signingSecret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	);
	const sig = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(sigBasestring)
	);
	const expectedSig =
		"v0=" +
		Array.from(new Uint8Array(sig))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

	return signature === expectedSig;
}

/**
 * Parse Slack command text, handling quoted strings
 */
export function parseSlackCommand(text: string): string[] {
	const regex = /[^\s"]+|"([^"]*)"/gi;
	const args: string[] = [];
	let match;
	while ((match = regex.exec(text)) !== null) {
		args.push(match[1] !== undefined ? match[1] : match[0]);
	}
	return args;
}

/**
 * Post a message to a Slack channel
 */
export async function postSlackMessage(
	text: string,
	slackToken: string,
	channel: string
): Promise<void> {
	const response = await fetch("https://slack.com/api/chat.postMessage", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${slackToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			channel,
			text,
			mrkdwn: true,
		}),
	});

	if (!response.ok) {
		throw new Error(`Slack API error: ${response.status}`);
	}

	const data = (await response.json()) as { ok: boolean; error?: string };
	if (!data.ok) {
		throw new Error(`Slack API error: ${data.error}`);
	}

	console.log("Slack message sent successfully");
}
