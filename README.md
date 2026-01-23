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

## Development

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run deploy
```
