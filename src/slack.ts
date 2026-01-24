/**
 * Slack integration module for snow forecast notifications
 */

import type { SnowForecast } from "./edr";

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

// Format hour for display (e.g., "14:00" -> "2pm")
function formatHour(hour: number): string {
	if (hour === 0) return "12am";
	if (hour === 12) return "12pm";
	if (hour < 12) return `${hour}am`;
	return `${hour - 12}pm`;
}

// Format date for display (e.g., "Sunday 1/23")
function formatDate(date: Date): string {
	const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	const dayName = days[date.getUTCDay()];
	const month = date.getUTCMonth() + 1;
	const day = date.getUTCDate();
	return `${dayName} ${month}/${day}`;
}

// Format a time window for display
function formatWindow(start: Date, end: Date): string {
	const startDate = formatDate(start);
	const endDate = formatDate(end);
	const startHour = formatHour(start.getUTCHours());
	const endHour = formatHour(end.getUTCHours());

	if (startDate === endDate) {
		// Same day
		if (start.getTime() === end.getTime()) {
			return `${startDate} ${startHour}`;
		}
		return `${startDate} ${startHour}-${endHour}`;
	} else {
		// Spans multiple days
		return `${startDate} ${startHour} - ${endDate} ${endHour}`;
	}
}

// Group consecutive timestamps into windows with dates
function getSnowWindows(timestamps: string[]): string[] {
	if (timestamps.length === 0) return [];

	const windows: string[] = [];
	let windowStart = new Date(timestamps[0]);
	let windowEnd = new Date(timestamps[0]);

	for (let i = 1; i < timestamps.length; i++) {
		const currDate = new Date(timestamps[i]);
		const hoursDiff = (currDate.getTime() - windowEnd.getTime()) / (1000 * 60 * 60);

		if (hoursDiff <= 1) {
			// Consecutive hour, extend window
			windowEnd = currDate;
		} else {
			// Gap found, save current window and start new one
			windows.push(formatWindow(windowStart, windowEnd));
			windowStart = currDate;
			windowEnd = currDate;
		}
	}

	// Save final window
	windows.push(formatWindow(windowStart, windowEnd));

	return windows;
}

/**
 * Send Slack message with forecast results
 */
export async function sendSlackMessage(
	locationsWithSnow: SnowForecast[],
	slackToken: string,
	channel: string
): Promise<void> {
	const lines = locationsWithSnow.map((f) => {
		const windows = getSnowWindows(f.snowTimestamps);
		return `:snowflake: *${f.location.name}*\n      :clock3: ${windows.join(", ")}`;
	});

	const delimiter = ":rotating_light::snowman::rotating_light::snowman::rotating_light::snowman::rotating_light::snowman::rotating_light:";
	const text = `${delimiter}\n\n:snow_cloud: *SNOW ALERT!* :snow_cloud:\n\n${lines.join("\n\n")}\n\n${delimiter}`;

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
