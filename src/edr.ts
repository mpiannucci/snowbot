/**
 * EDR (Environmental Data Retrieval) module for querying Earthmover snow forecasts
 */

export interface Location {
	id: string;
	name: string;
	lat: number;
	lon: number;
}

interface EdrMetadata {
	extent: {
		init_time: {
			interval: [string, string];
		};
	};
}

interface CovJsonResponse {
	domain: {
		axes: {
			t: { values: string[] | string[][] };
			x: { values: number[] | number[][] };
			y: { values: number[] | number[][] };
		};
	};
	ranges: {
		categorical_snow_surface: {
			axisNames: string[];
			shape: number[];
			values: number[];
		};
	};
}

export interface SnowForecast {
	location: Location;
	snowTimestamps: string[];
}

const EDR_BASE_URL =
	"https://compute.earthmover.io/v1/services/edr/earthmover/snowbot/main/edr";

/**
 * Fetch latest init_time from EDR metadata
 */
export async function getLatestInitTime(fluxToken: string): Promise<string> {
	const response = await fetch(`${EDR_BASE_URL}/`, {
		headers: {
			Authorization: `Bearer ${fluxToken}`,
		},
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch EDR metadata: ${response.status}`);
	}
	const metadata: EdrMetadata = await response.json();
	// interval[1] contains the latest init_time
	return metadata.extent.init_time.interval[1];
}

/**
 * Build MULTIPOINT WKT string from locations
 * WKT uses (lon lat) order, not (lat lon)
 */
export function buildMultipointWkt(locations: Location[]): string {
	const points = locations.map((loc) => `${loc.lon} ${loc.lat}`).join(", ");
	return `MULTIPOINT(${points})`;
}

/**
 * Query EDR position endpoint with MULTIPOINT coordinates
 */
export async function queryEdrPosition(
	coords: string,
	initTime: string,
	fluxToken: string
): Promise<CovJsonResponse> {
	const params = new URLSearchParams({
		f: "cf_covjson",
		"parameter-name": "categorical_snow_surface",
		crs: "EPSG:4326",
		method: "nearest",
		init_time: initTime,
		coords: coords,
	});

	const url = `${EDR_BASE_URL}/position?${params.toString()}`;
	console.log("Querying EDR:", url);

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${fluxToken}`,
		},
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`EDR query failed: ${response.status} - ${text}`);
	}

	return response.json();
}

/**
 * Parse CovJSON response and identify snow forecasts for each location
 */
export function parseSnowForecasts(
	covjson: CovJsonResponse,
	locations: Location[]
): SnowForecast[] {
	const range = covjson.ranges.categorical_snow_surface;
	const values = range.values;

	// Get timestamps - handle nested array if present
	let timestamps: string[];
	const tValues = covjson.domain.axes.t.values;
	if (Array.isArray(tValues[0])) {
		timestamps = (tValues as string[][]).flat();
	} else {
		timestamps = tValues as string[];
	}

	const nTimesteps = timestamps.length;
	const nPoints = locations.length;

	const forecasts: SnowForecast[] = [];

	for (let p = 0; p < nPoints; p++) {
		const snowTimestamps: string[] = [];

		for (let t = 0; t < nTimesteps; t++) {
			// Row-major indexing: values[t * n_points + p]
			const idx = t * nPoints + p;
			if (values[idx] === 1) {
				snowTimestamps.push(timestamps[t]);
			}
		}

		forecasts.push({
			location: locations[p],
			snowTimestamps,
		});
	}

	return forecasts;
}
