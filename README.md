# Snowbot

Snow forecast notification service. Get Slack alerts when snow is in the forecast for your saved locations.

## How it works

```
┌─────────────┐         ┌─────────────────┐
│   Web UI    │────────▶│  KV Store       │
│  (React)    │         │  (locations)    │
└─────────────┘         └────────┬────────┘
                                 │
                                 ▼
┌─────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ Arraylake   │─webhook─▶│     Worker      │─────────▶│  Earthmover     │
│ (HRRR data) │         │                 │◀─────────│  EDR API        │
└─────────────┘         └────────┬────────┘         └─────────────────┘
                                 │
                                 │ snow forecasted?
                                 ▼
                        ┌─────────────────┐
                        │     Slack       │
                        └─────────────────┘
```

1. Add locations (lat/lon) through the web UI
2. When HRRR forecast data updates, Arraylake sends a webhook to the worker, which queries Earthmover EDR for each location
3. If snow is forecasted, a Slack notification is sent

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
