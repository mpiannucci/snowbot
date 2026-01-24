import { Hono } from "hono";
import {
	Location,
	SnowForecast,
	getLatestInitTime,
	buildMultipointWkt,
	queryEdrPosition,
	parseSnowForecasts,
} from "./edr";

// Helper function to fetch all locations from KV
async function getAllLocations(kv: KVNamespace): Promise<Location[]> {
	const list = await kv.list();
	const locations: Location[] = [];

	for (const key of list.keys) {
		const value = await kv.get(key.name);
		if (value) {
			locations.push(JSON.parse(value));
		}
	}

	return locations;
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

// Verify Slack request signature
async function verifySlackSignature(
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

// Parse Slack command text, handling quoted strings
function parseSlackCommand(text: string): string[] {
	const regex = /[^\s"]+|"([^"]*)"/gi;
	const args: string[] = [];
	let match;
	while ((match = regex.exec(text)) !== null) {
		args.push(match[1] !== undefined ? match[1] : match[0]);
	}
	return args;
}

// Send Slack message with forecast results
async function sendSlackMessage(
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

// Format and log snow forecast results
function logSnowForecasts(forecasts: SnowForecast[], initTime: string): void {
	console.log("\n=== Snow Forecast Check ===");
	console.log(`Init time: ${initTime}`);
	console.log(`Locations checked: ${forecasts.length}\n`);

	for (const forecast of forecasts) {
		const { location, snowTimestamps } = forecast;
		console.log(
			`Location "${location.name}" (${location.lat}, ${location.lon}):`
		);

		if (snowTimestamps.length > 0) {
			console.log(`  Snow forecast at: ${snowTimestamps.join(", ")}`);
		} else {
			console.log("  No snow in forecast");
		}
	}

	console.log("\n=== End Snow Forecast Check ===\n");
}

const app = new Hono<{ Bindings: Env }>();

// Health check endpoint
app.get("/api/status", (c) => {
	return c.json({ status: "ok" });
});

// Token validation endpoint
app.post("/api/auth/validate", async (c) => {
	const body = await c.req.json<{ token: string }>();
	const token = body.token;

	if (!token) {
		return c.json({ error: "Token required" }, 400);
	}

	try {
		const response = await fetch("https://api.earthmover.io/user", {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		if (!response.ok) {
			return c.json({ error: "Invalid token" }, 401);
		}

		const user = await response.json();
		return c.json({ user });
	} catch {
		return c.json({ error: "Failed to validate token" }, 500);
	}
});

// List all locations
app.get("/api/locations", async (c) => {
	const locations = await getAllLocations(c.env.SNOW_LOCATIONS);
	return c.json({ locations });
});

// Add a new location
app.post("/api/locations", async (c) => {
	const body = await c.req.json<{ name: string; lat: number; lon: number }>();
	const { name, lat, lon } = body;

	if (!name || lat === undefined || lon === undefined) {
		return c.json({ error: "Name, lat, and lon are required" }, 400);
	}

	const id = crypto.randomUUID();
	const location: Location = { id, name, lat, lon };

	await c.env.SNOW_LOCATIONS.put(id, JSON.stringify(location));

	return c.json({ location }, 201);
});

// Delete a location
app.delete("/api/locations/:id", async (c) => {
	const id = c.req.param("id");
	const existing = await c.env.SNOW_LOCATIONS.get(id);

	if (!existing) {
		return c.json({ error: "Location not found" }, 404);
	}

	await c.env.SNOW_LOCATIONS.delete(id);
	return c.json({ success: true });
});

// Webhook endpoint for forecast notifications
app.post("/api/on-forecast-update", async (c) => {
	const payload = await c.req.json();
	console.log(
		"Received forecast notification:",
		JSON.stringify(payload, null, 2)
	);

	try {
		// 1. Fetch all locations from KV
		const locations = await getAllLocations(c.env.SNOW_LOCATIONS);

		if (locations.length === 0) {
			console.log("No locations configured, skipping EDR query");
			return c.json({ success: true, message: "No locations to check" });
		}

		console.log(`Checking ${locations.length} locations for snow...`);

		const fluxToken = c.env.FLUX_TOKEN;
		if (!fluxToken) {
			throw new Error("FLUX_TOKEN secret is not configured");
		}

		// 2. Get latest init_time from EDR metadata
		const initTime = await getLatestInitTime(fluxToken);
		console.log(`Latest init_time: ${initTime}`);

		// 3. Build MULTIPOINT WKT string
		const coords = buildMultipointWkt(locations);
		console.log(`MULTIPOINT coords: ${coords}`);

		// 4. Query EDR position endpoint
		const covjson = await queryEdrPosition(coords, initTime, fluxToken);

		// 5. Parse results and identify snow forecasts
		const forecasts = parseSnowForecasts(covjson, locations);

		// 6. Log formatted output
		logSnowForecasts(forecasts, initTime);

		// 7. Send Slack notification only if there's snow somewhere
		const locationsWithSnow = forecasts.filter(
			(f) => f.snowTimestamps.length > 0
		);

		if (locationsWithSnow.length > 0) {
			if (c.env.SLACK_BOT_TOKEN && c.env.SLACK_DEFAULT_CHANNEL) {
				await sendSlackMessage(
					locationsWithSnow,
					c.env.SLACK_BOT_TOKEN,
					c.env.SLACK_DEFAULT_CHANNEL
				);
			} else {
				console.log("Slack not configured, skipping notification");
			}
		} else {
			console.log("No snow in forecast, skipping Slack notification");
		}
		return c.json({
			success: true,
			message: "Forecast check complete",
			initTime,
			locationsChecked: locations.length,
			locationsWithSnow: locationsWithSnow.length,
		});
	} catch (error) {
		console.error("Error checking snow forecast:", error);
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500
		);
	}
});

// Slack slash commands endpoint
app.post("/api/slack/commands", async (c) => {
	const body = await c.req.text();
	const signature = c.req.header("x-slack-signature");
	const timestamp = c.req.header("x-slack-request-timestamp");

	// Verify request signature
	const signingSecret = (c.env as Env & { SLACK_SIGNING_SECRET?: string })
		.SLACK_SIGNING_SECRET;
	if (
		!signingSecret ||
		!(await verifySlackSignature(
			signature ?? null,
			timestamp ?? null,
			body,
			signingSecret
		))
	) {
		return c.json({ error: "Invalid signature" }, 401);
	}

	const params = new URLSearchParams(body);
	const text = params.get("text") || "";
	const args = parseSlackCommand(text);
	const action = args[0]?.toLowerCase() || "help";

	// Handle 'add' command
	if (action === "add") {
		if (args.length < 4) {
			return c.json({
				response_type: "ephemeral",
				text: 'Usage: `/snowbot add "Location Name" latitude longitude`\nExample: `/snowbot add "Lake Tahoe" 39.0968 -120.0324`',
			});
		}
		const [, name, latStr, lonStr] = args;
		const lat = parseFloat(latStr);
		const lon = parseFloat(lonStr);
		if (
			isNaN(lat) ||
			isNaN(lon) ||
			lat < -90 ||
			lat > 90 ||
			lon < -180 ||
			lon > 180
		) {
			return c.json({
				response_type: "ephemeral",
				text: "Invalid coordinates. Latitude must be -90 to 90, longitude -180 to 180.",
			});
		}
		const id = crypto.randomUUID();
		await c.env.SNOW_LOCATIONS.put(id, JSON.stringify({ id, name, lat, lon }));
		return c.json({
			response_type: "in_channel",
			text: `Added location *${name}* (${lat}, ${lon})`,
		});
	}

	// Handle 'list' command
	if (action === "list") {
		const locations = await getAllLocations(c.env.SNOW_LOCATIONS);
		if (locations.length === 0) {
			return c.json({
				response_type: "ephemeral",
				text: "No locations configured. Use `/snowbot add` to add one.",
			});
		}
		const list = locations
			.map((loc) => `• *${loc.name}* — ${loc.lat}, ${loc.lon}`)
			.join("\n");
		return c.json({
			response_type: "ephemeral",
			text: `*Snow Alert Locations*\n\n${list}`,
		});
	}

	// Handle 'remove' command
	if (action === "remove") {
		if (args.length < 2) {
			return c.json({
				response_type: "ephemeral",
				text: 'Usage: `/snowbot remove "Location Name"` or `/snowbot remove <id>`',
			});
		}
		const identifier = args[1];
		const locations = await getAllLocations(c.env.SNOW_LOCATIONS);
		const location = locations.find(
			(loc) =>
				loc.id === identifier ||
				loc.name.toLowerCase() === identifier.toLowerCase()
		);
		if (!location) {
			return c.json({
				response_type: "ephemeral",
				text: `Location "${identifier}" not found.`,
			});
		}
		await c.env.SNOW_LOCATIONS.delete(location.id);
		return c.json({
			response_type: "in_channel",
			text: `Removed location *${location.name}*`,
		});
	}

	// Default: help
	return c.json({
		response_type: "ephemeral",
		text: `*Snowbot Commands*\n\n• \`/snowbot add "Name" lat lon\` — Add a location\n• \`/snowbot list\` — List all locations\n• \`/snowbot remove "Name"\` — Remove a location\n• \`/snowbot help\` — Show this help`,
	});
});

export default app;
