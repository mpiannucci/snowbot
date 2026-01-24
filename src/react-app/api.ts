import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface Location {
	id: string;
	name: string;
	lat: number;
	lon: number;
}

export interface User {
	email?: string;
	name?: string;
}

interface ValidateTokenResponse {
	user: User;
}

interface LocationsResponse {
	locations: Location[];
}

export function useValidateToken() {
	return useMutation({
		mutationFn: async (token: string): Promise<ValidateTokenResponse> => {
			const response = await fetch("/api/auth/validate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token }),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Invalid token");
			}

			return response.json();
		},
	});
}

export function useLocations(enabled: boolean) {
	return useQuery({
		queryKey: ["locations"],
		queryFn: async (): Promise<Location[]> => {
			const response = await fetch("/api/locations");
			const data: LocationsResponse = await response.json();
			return data.locations || [];
		},
		enabled,
	});
}

export function useAddLocation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (location: {
			name: string;
			lat: number;
			lon: number;
		}): Promise<Location> => {
			const response = await fetch("/api/locations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(location),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to add location");
			}

			const data: { location: Location } = await response.json();
			return data.location;
		},
		onMutate: async (newLocation) => {
			// Cancel any outgoing refetches so they don't overwrite our optimistic update
			await queryClient.cancelQueries({ queryKey: ["locations"] });

			// Snapshot the previous value
			const previousLocations = queryClient.getQueryData<Location[]>(["locations"]);

			// Create a temporary ID to identify this optimistic entry
			const tempId = `temp-${Date.now()}`;

			// Optimistically update the cache with a temporary ID
			queryClient.setQueryData<Location[]>(["locations"], (old) => [
				...(old || []),
				{
					id: tempId,
					name: newLocation.name,
					lat: newLocation.lat,
					lon: newLocation.lon,
				},
			]);

			// Return context with the previous value and temp ID for rollback/update
			return { previousLocations, tempId };
		},
		onSuccess: (createdLocation, _variables, context) => {
			// Replace the temp entry with the real location from the server
			if (context?.tempId) {
				queryClient.setQueryData<Location[]>(["locations"], (old) =>
					(old || []).map((loc) =>
						loc.id === context.tempId ? createdLocation : loc
					)
				);
			}
		},
		onError: (_err, _newLocation, context) => {
			// Rollback to the previous value on error
			if (context?.previousLocations) {
				queryClient.setQueryData(["locations"], context.previousLocations);
			}
		},
	});
}

export function useDeleteLocation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: string): Promise<void> => {
			const response = await fetch(`/api/locations/${id}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error("Failed to delete location");
			}
		},
		onMutate: async (deletedId) => {
			// Cancel any outgoing refetches so they don't overwrite our optimistic update
			await queryClient.cancelQueries({ queryKey: ["locations"] });

			// Snapshot the previous value
			const previousLocations = queryClient.getQueryData<Location[]>(["locations"]);

			// Optimistically remove the location from the cache
			queryClient.setQueryData<Location[]>(["locations"], (old) =>
				(old || []).filter((location) => location.id !== deletedId)
			);

			// Return context with the previous value for rollback
			return { previousLocations };
		},
		onError: (_err, _deletedId, context) => {
			// Rollback to the previous value on error
			if (context?.previousLocations) {
				queryClient.setQueryData(["locations"], context.previousLocations);
			}
		},
	});
}

export interface WebhookResponse {
	success: boolean;
	message?: string;
	error?: string;
	initTime?: string;
	locationsChecked?: number;
	locationsWithSnow?: number;
}

export function useTestWebhook() {
	return useMutation({
		mutationFn: async (): Promise<WebhookResponse> => {
			const response = await fetch("/api/on-forecast-update", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ test: true }),
			});

			return response.json();
		},
	});
}
