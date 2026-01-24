import { Hono } from "hono";
import {
	SnowForecast,
	getLatestInitTime,
	buildMultipointWkt,
	queryEdrPosition,
	parseSnowForecasts,
} from "./edr";
import { Location, getAllLocations } from "./locations";
import { verifySlackSignature, parseSlackCommand, postSlackMessage } from "./slack";

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

// Format snow alert message for Slack
function formatSnowAlertMessage(locationsWithSnow: SnowForecast[]): string {
	const lines = locationsWithSnow.map((f) => {
		const windows = getSnowWindows(f.snowTimestamps);
		return `:snowflake: *${f.location.name}*\n      :clock3: ${windows.join(", ")}`;
	});

	const delimiter = ":rotating_light::snowman::rotating_light::snowman::rotating_light::snowman::rotating_light::snowman::rotating_light:";
	return `${delimiter}\n\n:snow_cloud: *SNOW ALERT!* :snow_cloud:\n\n${lines.join("\n\n")}\n\n${delimiter}`;
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
				const message = formatSnowAlertMessage(locationsWithSnow);
				await postSlackMessage(
					message,
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

	// Handle 'map' command
	if (action === "map") {
		const locations = await getAllLocations(c.env.SNOW_LOCATIONS);
		if (locations.length === 0) {
			return c.json({
				response_type: "ephemeral",
				text: "No locations configured. Use `/snowbot add` to add one.",
			});
		}

		// Query EDR for snow forecasts
		const snowLocationIds: Set<string> = new Set();
		const fluxToken = c.env.FLUX_TOKEN;
		if (fluxToken) {
			try {
				const initTime = await getLatestInitTime(fluxToken);
				const coords = buildMultipointWkt(locations);
				const covjson = await queryEdrPosition(coords, initTime, fluxToken);
				const forecasts = parseSnowForecasts(covjson, locations);
				for (const f of forecasts) {
					if (f.snowTimestamps.length > 0) {
						snowLocationIds.add(f.location.id);
					}
				}
			} catch (error) {
				console.error("Error fetching snow forecasts for map:", error);
			}
		}

		// Calculate bounding box for the map
		const lats = locations.map((loc) => loc.lat);
		const lons = locations.map((loc) => loc.lon);
		const minLat = Math.min(...lats);
		const maxLat = Math.max(...lats);
		const minLon = Math.min(...lons);
		const maxLon = Math.max(...lons);

		// Add padding to bounds
		const latPadding = Math.max((maxLat - minLat) * 0.2, 0.5);
		const lonPadding = Math.max((maxLon - minLon) * 0.2, 0.5);

		// Calculate center
		const centerLat = (minLat + maxLat) / 2;
		const centerLon = (minLon + maxLon) / 2;

		// Calculate zoom level based on bounds
		const latDiff = maxLat - minLat + latPadding * 2;
		const lonDiff = maxLon - minLon + lonPadding * 2;
		const maxDiff = Math.max(latDiff, lonDiff);
		let zoom = 10;
		if (maxDiff > 20) zoom = 4;
		else if (maxDiff > 10) zoom = 5;
		else if (maxDiff > 5) zoom = 6;
		else if (maxDiff > 2) zoom = 7;
		else if (maxDiff > 1) zoom = 8;
		else if (maxDiff > 0.5) zoom = 9;

		// Check for Geoapify API key
		const geoapifyKey = (c.env as Env & { GEOAPIFY_API_KEY?: string }).GEOAPIFY_API_KEY;
		if (!geoapifyKey) {
			return c.json({
				response_type: "ephemeral",
				text: "Map feature requires GEOAPIFY_API_KEY secret. Get a free key at https://myprojects.geoapify.com/",
			});
		}

		// Build markers for Geoapify static map (free tier: 3000 req/day)
		// Format: lonlat:lon,lat;color:hex;size:size
		const markers = locations
			.map((loc) => {
				const hasSnow = snowLocationIds.has(loc.id);
				const color = hasSnow ? "%2300bfff" : "%23ff4444"; // cyan for snow, red for no snow
				return `lonlat:${loc.lon},${loc.lat};color:${color};size:large`;
			})
			.join("|");

		const mapUrl = `https://maps.geoapify.com/v1/staticmap?style=osm-bright&width=800&height=500&center=lonlat:${centerLon},${centerLat}&zoom=${zoom}&marker=${markers}&apiKey=${geoapifyKey}`;

		// Build location list with snowflake for locations with snow
		const locationList = locations
			.map((loc) => {
				const hasSnow = snowLocationIds.has(loc.id);
				const icon = hasSnow ? ":snowflake:" : ":round_pushpin:";
				return `${icon} *${loc.name}*`;
			})
			.join("\n");

		const snowCount = snowLocationIds.size;
		const headerText = snowCount > 0
			? `:world_map: *Snow Alert Locations*\n_${snowCount} location${snowCount === 1 ? "" : "s"} with snow in forecast_`
			: `:world_map: *Snow Alert Locations*\n_No snow in forecast_`;

		return c.json({
			response_type: "in_channel",
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: headerText,
					},
				},
				{
					type: "image",
					image_url: mapUrl,
					alt_text: "Map showing snow alert locations",
				},
				{
					type: "context",
					elements: [
						{
							type: "mrkdwn",
							text: locationList,
						},
					],
				},
			],
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
		text: `*Snowbot Commands*\n\n• \`/snowbot add "Name" lat lon\` — Add a location\n• \`/snowbot list\` — List all locations\n• \`/snowbot map\` — Show locations on a map with snow forecast\n• \`/snowbot remove "Name"\` — Remove a location\n• \`/snowbot help\` — Show this help`,
	});
});

export default app;
