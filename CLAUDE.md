# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

- `npm run dev` - Start local development server (via Wrangler)
- `npm run build` - TypeScript check
- `npm run lint` - Run ESLint
- `npm run deploy` - Deploy to Cloudflare Workers (via Wrangler)
- `npm run check` - Full validation: TypeScript and deploy dry-run
- `npm run cf-typegen` - Generate Cloudflare Worker types (updates `worker-configuration.d.ts`)

## Application Purpose

Snowbot is a snow forecast notification service powered by a Cloudflare Worker and Slack integration:

- Receives webhooks when upstream HRRR forecast data updates
- Retrieves all locations from `SNOW_LOCATIONS` KV
- Queries Earthmover EDR endpoint for each location
- Sends a Slack message listing all locations with snow in the forecast window
- Provides Slack slash commands for managing locations

## Architecture

### Source Structure

- `src/index.ts` - Hono backend (Cloudflare Worker)
  - API routes defined here
  - Has access to `Env` bindings (KV namespaces, etc.)

### Key Configuration Files

- `wrangler.json` - Cloudflare Worker configuration (bindings, compatibility flags)
- `tsconfig.json` - TypeScript configuration

### Cloudflare Bindings

The worker has access to a KV namespace `SNOW_LOCATIONS` for storing user-defined locations. Run `npm run cf-typegen` after modifying bindings to update types.

## Slack Integration

### Slack App Setup

The Snowbot Slack app enables two features:
1. **Snow alerts** - Automatic notifications when snow is in the forecast
2. **Slash commands** - Manage locations directly from Slack

### Required Secrets

Configure these secrets using `wrangler secret put <SECRET_NAME>`:

| Secret | Description |
|--------|-------------|
| `SLACK_BOT_TOKEN` | Bot token (xoxb-...) for posting messages |
| `SLACK_DEFAULT_CHANNEL` | Channel ID for snow alerts |
| `SLACK_SIGNING_SECRET` | Signing secret for verifying slash command requests |
| `FLUX_TOKEN` | Token for Earthmover EDR API |

### Slash Commands

Configure the `/snowbot` slash command in your Slack app settings:
- **Request URL**: `https://your-worker.workers.dev/api/slack/commands`

Available commands:
- `/snowbot add "Location Name" latitude longitude` - Add a location
- `/snowbot list` - List all tracked locations
- `/snowbot remove "Location Name"` - Remove a location
- `/snowbot help` - Show available commands

**Example:**
```
/snowbot add "Lake Tahoe" 39.0968 -120.0324
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Health check |
| `/api/slack/commands` | POST | Handles slash commands from Slack |
| `/api/on-forecast-update` | POST | Webhook for forecast updates (sends snow alerts) |
| `/api/locations` | GET | List all locations |
| `/api/locations` | POST | Add a location |
| `/api/locations/:id` | DELETE | Delete a location |
