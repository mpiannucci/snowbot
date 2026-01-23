/**
 * Extended environment bindings for the worker.
 * These are in addition to the auto-generated bindings in worker-configuration.d.ts
 */
declare global {
  interface Env {
    /**
     * Slack Bot User OAuth Token (starts with xoxb-)
     * Set this secret using: wrangler secret put SLACK_BOT_TOKEN
     */
    SLACK_BOT_TOKEN: string;

    /**
     * Default Slack channel ID for sending messages
     * Can be set as a variable in wrangler.json or as a secret
     */
    SLACK_DEFAULT_CHANNEL?: string;
  }
}

export {};
