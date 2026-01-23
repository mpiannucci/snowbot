# Snowbot

Snow forecast notification service. Get Slack alerts when snow is in the forecast for your saved locations.

## How it works

1. Add locations (lat/lon) through the web UI
2. When upstream HRRR forecast data updates, the worker queries Earthmover EDR for each location
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
