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
		}): Promise<void> => {
			const response = await fetch("/api/locations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(location),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to add location");
			}
		},
		onSuccess: async () => {
			await new Promise((resolve) => setTimeout(resolve, 100));
			await queryClient.invalidateQueries({ queryKey: ["locations"] });
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
		onSuccess: async () => {
			await new Promise((resolve) => setTimeout(resolve, 100));
			await queryClient.invalidateQueries({ queryKey: ["locations"] });
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
