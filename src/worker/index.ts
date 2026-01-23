import { Hono } from "hono";

interface Location {
	id: string;
	name: string;
	lat: number;
	lon: number;
}

interface EdrMetadata {
	extent: {
		init_time: {
			interval: [string, string];
		};
	};
}

interface CovJsonResponse {
	domain: {
		axes: {
			t: { values: string[] | string[][] };
			x: { values: number[] | number[][] };
			y: { values: number[] | number[][] };
		};
	};
	ranges: {
		categorical_snow_surface: {
			axisNames: string[];
			shape: number[];
			values: number[];
		};
	};
}

interface SnowForecast {
	location: Location;
	snowTimestamps: string[];
}

const EDR_BASE_URL =
	"https://compute.earthmover.io/v1/services/edr/earthmover/snowbot/main/edr";

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

// Fetch latest init_time from EDR metadata
async function getLatestInitTime(fluxToken: string): Promise<string> {
	const response = await fetch(`${EDR_BASE_URL}/`, {
		headers: {
			Authorization: `Bearer ${fluxToken}`,
		},
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch EDR metadata: ${response.status}`);
	}
	const metadata: EdrMetadata = await response.json();
	// interval[1] contains the latest init_time
	return metadata.extent.init_time.interval[1];
}

// Build MULTIPOINT WKT string from locations
// WKT uses (lon lat) order, not (lat lon)
function buildMultipointWkt(locations: Location[]): string {
	const points = locations.map((loc) => `${loc.lon} ${loc.lat}`).join(", ");
	return `MULTIPOINT(${points})`;
}

// Query EDR position endpoint with MULTIPOINT coordinates
async function queryEdrPosition(
	coords: string,
	initTime: string,
	fluxToken: string
): Promise<CovJsonResponse> {
	const params = new URLSearchParams({
		f: "cf_covjson",
		"parameter-name": "categorical_snow_surface",
		crs: "EPSG:4326",
		method: "nearest",
		init_time: initTime,
		coords: coords,
	});

	const url = `${EDR_BASE_URL}/position?${params.toString()}`;
	console.log("Querying EDR:", url);

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${fluxToken}`,
		},
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`EDR query failed: ${response.status} - ${text}`);
	}

	return response.json();
}

// Parse CovJSON response and identify snow forecasts for each location
function parseSnowForecasts(
	covjson: CovJsonResponse,
	locations: Location[]
): SnowForecast[] {
	const range = covjson.ranges.categorical_snow_surface;
	const values = range.values;

	// Get timestamps - handle nested array if present
	let timestamps: string[];
	const tValues = covjson.domain.axes.t.values;
	if (Array.isArray(tValues[0])) {
		timestamps = (tValues as string[][]).flat();
	} else {
		timestamps = tValues as string[];
	}

	const nTimesteps = timestamps.length;
	const nPoints = locations.length;

	const forecasts: SnowForecast[] = [];

	for (let p = 0; p < nPoints; p++) {
		const snowTimestamps: string[] = [];

		for (let t = 0; t < nTimesteps; t++) {
			// Row-major indexing: values[t * n_points + p]
			const idx = t * nPoints + p;
			if (values[idx] === 1) {
				snowTimestamps.push(timestamps[t]);
			}
		}

		forecasts.push({
			location: locations[p],
			snowTimestamps,
		});
	}

	return forecasts;
}

// Format hour for display (e.g., "14:00" -> "2pm")
function formatHour(isoTimestamp: string): string {
	const timePart = isoTimestamp.split("T")[1];
	if (!timePart) return isoTimestamp;
	const hour = parseInt(timePart.slice(0, 2), 10);
	if (hour === 0) return "12am";
	if (hour === 12) return "12pm";
	if (hour < 12) return `${hour}am`;
	return `${hour - 12}pm`;
}

// Group consecutive timestamps into windows
function getSnowWindows(timestamps: string[]): string[] {
	if (timestamps.length === 0) return [];

	const windows: string[] = [];
	let windowStart = timestamps[0];
	let windowEnd = timestamps[0];

	for (let i = 1; i < timestamps.length; i++) {
		const prevDate = new Date(windowEnd);
		const currDate = new Date(timestamps[i]);
		const hoursDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60);

		if (hoursDiff <= 1) {
			// Consecutive hour, extend window
			windowEnd = timestamps[i];
		} else {
			// Gap found, save current window and start new one
			if (windowStart === windowEnd) {
				windows.push(formatHour(windowStart));
			} else {
				windows.push(`${formatHour(windowStart)}-${formatHour(windowEnd)}`);
			}
			windowStart = timestamps[i];
			windowEnd = timestamps[i];
		}
	}

	// Save final window
	if (windowStart === windowEnd) {
		windows.push(formatHour(windowStart));
	} else {
		windows.push(`${formatHour(windowStart)}-${formatHour(windowEnd)}`);
	}

	return windows;
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

	const text = `:rotating_light: *Snow Alert!*\n\n${lines.join("\n\n")}`;

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

export default app;
