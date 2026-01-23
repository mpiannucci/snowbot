// Custom environment variable declarations for secrets
// Secrets are added via: wrangler secret put FLUX_TOKEN
declare global {
	interface Env {
		FLUX_TOKEN: string;
	}
}

export {};
