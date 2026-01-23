import { Hono } from "hono";
import { KnownBlock } from "@slack/web-api";
import { createSlackClient, sendMessage, sendBlockMessage } from "./slack";

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

/**
 * Send a simple text message to a Slack channel
 * POST /api/slack/message
 * Body: { "channel": "C0ABGRRHW80", "text": "Hello, world!" }
 */
app.post("/api/slack/message", async (c) => {
  const token = c.env.SLACK_BOT_TOKEN;
  if (!token) {
    return c.json({ error: "SLACK_BOT_TOKEN not configured" }, 500);
  }

  const body = await c.req.json<{ channel?: string; text?: string }>();
  const channel = body.channel || c.env.SLACK_DEFAULT_CHANNEL;

  if (!channel) {
    return c.json({ error: "Channel is required" }, 400);
  }

  if (!body.text) {
    return c.json({ error: "Text is required" }, 400);
  }

  try {
    const client = createSlackClient(token);
    const result = await sendMessage(client, channel, body.text);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

/**
 * Send a message with Block Kit blocks to a Slack channel
 * POST /api/slack/blocks
 * Body: { "channel": "C0ABGRRHW80", "text": "Fallback text", "blocks": [...] }
 */
app.post("/api/slack/blocks", async (c) => {
  const token = c.env.SLACK_BOT_TOKEN;
  if (!token) {
    return c.json({ error: "SLACK_BOT_TOKEN not configured" }, 500);
  }

  const body = await c.req.json<{
    channel?: string;
    text?: string;
    blocks?: KnownBlock[];
  }>();
  const channel = body.channel || c.env.SLACK_DEFAULT_CHANNEL;

  if (!channel) {
    return c.json({ error: "Channel is required" }, 400);
  }

  if (!body.text) {
    return c.json({ error: "Text is required" }, 400);
  }

  if (!body.blocks || !Array.isArray(body.blocks)) {
    return c.json({ error: "Blocks array is required" }, 400);
  }

  try {
    const client = createSlackClient(token);
    const result = await sendBlockMessage(
      client,
      channel,
      body.text,
      body.blocks
    );
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

export default app;
