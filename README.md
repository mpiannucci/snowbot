# React + Vite + Hono + Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/vite-react-template)

This template provides a minimal setup for building a React application with TypeScript and Vite, designed to run on Cloudflare Workers. It features hot module replacement, ESLint integration, and the flexibility of Workers deployments.

![React + TypeScript + Vite + Cloudflare Workers](https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/fc7b4b62-442b-4769-641b-ad4422d74300/public)

<!-- dash-content-start -->

🚀 Supercharge your web development with this powerful stack:

- [**React**](https://react.dev/) - A modern UI library for building interactive interfaces
- [**Vite**](https://vite.dev/) - Lightning-fast build tooling and development server
- [**Hono**](https://hono.dev/) - Ultralight, modern backend framework
- [**Cloudflare Workers**](https://developers.cloudflare.com/workers/) - Edge computing platform for global deployment

### ✨ Key Features

- 🔥 Hot Module Replacement (HMR) for rapid development
- 📦 TypeScript support out of the box
- 🛠️ ESLint configuration included
- ⚡ Zero-config deployment to Cloudflare's global network
- 🎯 API routes with Hono's elegant routing
- 🔄 Full-stack development setup
- 🔎 Built-in Observability to monitor your Worker

Get started in minutes with local development or deploy directly via the Cloudflare dashboard. Perfect for building modern, performant web applications at the edge.

<!-- dash-content-end -->

## Getting Started

To start a new project with this template, run:

```bash
npm create cloudflare@latest -- --template=cloudflare/templates/vite-react-template
```

A live deployment of this template is available at:
[https://react-vite-template.templates.workers.dev](https://react-vite-template.templates.workers.dev)

## Development

Install dependencies:

```bash
npm install
```

Start the development server with:

```bash
npm run dev
```

Your application will be available at [http://localhost:5173](http://localhost:5173).

## Production

Build your project for production:

```bash
npm run build
```

Preview your build locally:

```bash
npm run preview
```

Deploy your project to Cloudflare Workers:

```bash
npm run build && npm run deploy
```

Monitor your workers:

```bash
npx wrangler tail
```

## Slack Bot Integration

This project includes basic Slack bot messaging capabilities using the `@slack/web-api` package.

### Setup

1. **Create a Slack App**: Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app.

2. **Configure Bot Permissions**: Under "OAuth & Permissions", add the following Bot Token Scopes:
   - `chat:write` - Send messages as the bot
   - `chat:write.public` - Send messages to channels the bot isn't a member of

3. **Install the App**: Install the app to your workspace and copy the Bot User OAuth Token (starts with `xoxb-`).

4. **Set the Secret**: Add your Slack bot token as a secret:
   ```bash
   wrangler secret put SLACK_BOT_TOKEN
   ```

5. **(Optional) Set Default Channel**: Add a default channel in `wrangler.json`:
   ```json
   "vars": {
     "SLACK_DEFAULT_CHANNEL": "C0ABGRRHW80"
   }
   ```

### API Endpoints

#### Send a Text Message
```bash
POST /api/slack/message
Content-Type: application/json

{
  "channel": "C0ABGRRHW80",
  "text": "Hello from Snowbot!"
}
```

#### Send a Block Kit Message
```bash
POST /api/slack/blocks
Content-Type: application/json

{
  "channel": "C0ABGRRHW80",
  "text": "Fallback text for notifications",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Hello!* This is a rich message."
      }
    }
  ]
}
```

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Vite Documentation](https://vitejs.dev/guide/)
- [React Documentation](https://reactjs.org/)
- [Hono Documentation](https://hono.dev/)
- [Slack API Documentation](https://api.slack.com/docs)
- [Slack Block Kit Builder](https://app.slack.com/block-kit-builder)
