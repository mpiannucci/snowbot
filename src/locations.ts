/**
 * Location management module for snow forecast tracking
 */

export interface Location {
	id: string;
	name: string;
	lat: number;
	lon: number;
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
