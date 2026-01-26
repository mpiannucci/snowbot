/**
 * Location management module for snow forecast tracking
 */

export interface Location {
	id: string;
	name: string;
	lat: number;
	lon: number;
	timezone?: string; // IANA timezone identifier (e.g., "America/Los_Angeles")
}

/**
 * Look up timezone from coordinates using timeapi.io
 * Returns IANA timezone identifier or undefined if lookup fails
 */
export async function lookupTimezone(
	lat: number,
	lon: number
): Promise<string | undefined> {
	try {
		const response = await fetch(
			`https://timeapi.io/api/TimeZone/coordinate?latitude=${lat}&longitude=${lon}`
		);
		if (!response.ok) {
			console.error(`Timezone lookup failed: ${response.status}`);
			return undefined;
		}
		const data: { timeZone?: string } = await response.json();
		return data.timeZone;
	} catch (error) {
		console.error("Timezone lookup error:", error);
		return undefined;
	}
}

/**
 * Fetch all locations from KV storage
 */
export async function getAllLocations(kv: KVNamespace): Promise<Location[]> {
	const list = await kv.list();
	const locations: Location[] = [];

	for (const key of list.keys) {
		const value = await kv.get(key.name);
		if (value) {
			locations.push(JSON.parse(value));
		}
	}

	return locations;
}
