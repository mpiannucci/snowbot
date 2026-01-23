import { Hono } from "hono";

interface Location {
	id: string;
	name: string;
	lat: number;
	lon: number;
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
	const kv = c.env.SNOW_LOCATIONS;
	const list = await kv.list();
	const locations: Location[] = [];

	for (const key of list.keys) {
		const value = await kv.get(key.name);
		if (value) {
			locations.push(JSON.parse(value));
		}
	}

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

	console.log("Received forecast notification:", JSON.stringify(payload, null, 2));

	return c.json({ success: true, message: "Webhook received" });
});

export default app;
