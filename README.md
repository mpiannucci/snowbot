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

## Configuration

Set these secrets via `wrangler secret put <SECRET_NAME>`:

- `SLACK_BOT_TOKEN` - Bot token for posting messages
- `SLACK_DEFAULT_CHANNEL` - Channel ID for snow alerts
- `SLACK_SIGNING_SECRET` - For verifying slash commands
- `FLUX_TOKEN` - Earthmover EDR API token
