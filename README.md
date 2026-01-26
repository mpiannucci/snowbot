# Snowbot

Snow forecast notification service. Get Slack alerts when snow is in the forecast for your saved locations.

## How it works

```
                        ┌─────────────────┐
                        │  KV Store       │
                        │  (locations)    │
                        └────────┬────────┘
                                 │
                                 ▼
┌─────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ Arraylake   │─webhook─▶│     Worker      │─────────▶│  Earthmover     │
│ (HRRR data) │         │                 │◀─────────│  EDR API        │
└─────────────┘         └────────┬────────┘         └─────────────────┘
                                 │
      ┌──────────────────────────┤
      │                          │ snow forecasted?
      ▼                          ▼
┌─────────────────┐     ┌─────────────────┐
│  Slack commands │     │  Slack alerts   │
│  /snowbot add   │     │                 │
│  /snowbot list  │     │                 │
└─────────────────┘     └─────────────────┘
```

1. Add locations via Slack: `/snowbot add "Lake Tahoe" 39.0968 -120.0324`
2. When HRRR forecast data updates, Arraylake sends a webhook to the worker
3. Worker queries Earthmover EDR for snow forecast at each location
4. If snow is forecasted, a Slack notification is sent

### Slack commands

- `/snowbot add "Name" lat lon` - Add a location
- `/snowbot list` - List all locations
- `/snowbot remove "Name"` - Remove a location
- `/snowbot help` - Show help

### Example Slack notification

```
🚨☃️🚨☃️🚨☃️🚨☃️🚨

🌨️ *SNOW ALERT!* 🌨️

❄️ *Tahoe City*
      🕒 Sun 1/19 2pm-8pm, Mon 1/20 6am-12pm

❄️ *Mammoth Lakes*
      🕒 Sun 1/19 4pm-11pm

🚨☃️🚨☃️🚨☃️🚨☃️🚨
```

## Development

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run deploy
```

## Setup

### 1. Initialize KV Store

Create a KV namespace to store location data:

```bash
# Create the KV namespace
npx wrangler kv namespace create SNOW_LOCATIONS

# Note the ID from the output, then update wrangler.json:
# "kv_namespaces": [
#   { "binding": "SNOW_LOCATIONS", "id": "<your-namespace-id>" }
# ]
```

For local development, create a preview namespace:

```bash
npx wrangler kv namespace create SNOW_LOCATIONS --preview
```

### 2. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**
2. Choose **From scratch**, name it "Snowbot", and select your workspace

#### Configure Bot Token Scopes

1. Navigate to **OAuth & Permissions** in the sidebar
2. Under **Scopes > Bot Token Scopes**, add:
   - `chat:write` - Send messages
   - `commands` - Handle slash commands

#### Create Slash Command

1. Navigate to **Slash Commands** in the sidebar
2. Click **Create New Command**:
   - **Command**: `/snowbot`
   - **Request URL**: `https://your-worker.workers.dev/api/slack/commands`
   - **Short Description**: Manage snow alert locations
   - **Usage Hint**: `[add|list|remove|help]`

#### Install App to Workspace

1. Navigate to **Install App** in the sidebar
2. Click **Install to Workspace** and authorize
3. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

#### Get Signing Secret

1. Navigate to **Basic Information** in the sidebar
2. Under **App Credentials**, copy the **Signing Secret**

#### Get Channel ID

1. In Slack, right-click the channel for snow alerts
2. Click **View channel details**
3. Copy the **Channel ID** at the bottom of the modal

### 3. Configure Secrets

Set these secrets via `wrangler secret put <SECRET_NAME>`:

```bash
wrangler secret put SLACK_BOT_TOKEN      # Bot token (xoxb-...)
wrangler secret put SLACK_DEFAULT_CHANNEL # Channel ID for alerts
wrangler secret put SLACK_SIGNING_SECRET  # Signing secret from app credentials
wrangler secret put FLUX_TOKEN            # Earthmover EDR API token
wrangler secret put WEBHOOK_SECRET        # Secret for webhook verification
```

| Secret | Description |
|--------|-------------|
| `SLACK_BOT_TOKEN` | Bot token for posting messages |
| `SLACK_DEFAULT_CHANNEL` | Channel ID for snow alerts |
| `SLACK_SIGNING_SECRET` | For verifying slash commands |
| `FLUX_TOKEN` | Earthmover EDR API token |
| `WEBHOOK_SECRET` | Shared secret for verifying incoming webhooks |

### 4. Configure Webhook

When configuring the upstream webhook (e.g., Arraylake), include the `X-Secret-Token` header with the value of your `WEBHOOK_SECRET`:

```
POST /api/on-forecast-update
X-Secret-Token: <your-webhook-secret>
```
