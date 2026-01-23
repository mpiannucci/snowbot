# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

- `npm run dev` - Start development server with HMR (http://localhost:5173)
- `npm run build` - TypeScript check and Vite production build
- `npm run lint` - Run ESLint
- `npm run preview` - Build and preview production locally
- `npm run deploy` - Deploy to Cloudflare Workers (via Wrangler)
- `npm run check` - Full validation: TypeScript, build, and deploy dry-run
- `npm run cf-typegen` - Generate Cloudflare Worker types (updates `worker-configuration.d.ts`)

## Application Purpose

Snowbot is a snow forecast notification service:

1. **React Frontend** - Web app for users to manage locations (lat/lon pairs) stored in the `SNOW_LOCATIONS` KV store
2. **Worker Backend** - Receives webhooks when upstream HRRR forecast data updates, then:
   - Retrieves all locations from `SNOW_LOCATIONS` KV
   - Queries Earthmover EDR endpoint for each location
   - Sends a Slack message listing all locations with snow in the forecast window

## Architecture

### Source Structure

- `src/react-app/` - React frontend (Vite-bundled SPA)
  - Entry point: `main.tsx` → `App.tsx`
  - Configured via `tsconfig.app.json`

- `src/worker/index.ts` - Hono backend (Cloudflare Worker)
  - API routes defined here
  - Configured via `tsconfig.worker.json`
  - Has access to `Env` bindings (KV namespaces, etc.)

### Key Configuration Files

- `wrangler.json` - Cloudflare Worker configuration (bindings, assets, compatibility flags)
- `vite.config.ts` - Vite config with `@cloudflare/vite-plugin` for Worker integration
- Three TypeScript configs: `tsconfig.app.json` (React), `tsconfig.worker.json` (Worker), `tsconfig.node.json` (build tools)

### Cloudflare Bindings

The worker has access to a KV namespace `SNOW_LOCATIONS` for storing user-defined locations. Run `npm run cf-typegen` after modifying bindings to update types.

## UI/Styling Preferences

- Use **Mantine** for UI components (not Tailwind)
- Theme is defined in `src/react-app/theme.ts` with brand colors:
  - Primary color: purple (#A653FF at shade 5)
  - Other brand colors: lime, red, orange, green, blue, pink
- Use **white backgrounds** (not gray)
- Avoid borders on form containers (no `withBorder` on Paper components)
- Font family: Roboto
