import { useState, useEffect } from "react";
import {
	Box,
	Button,
	Container,
	Divider,
	Group,
	Paper,
	PasswordInput,
	Stack,
	Table,
	Text,
	TextInput,
	Title,
} from "@mantine/core";

interface Location {
	id: string;
	name: string;
	lat: number;
	lon: number;
}

interface User {
	email?: string;
	name?: string;
}

function App() {
	const [token, setToken] = useState<string>(() => {
		return localStorage.getItem("arraylake_token") || "";
	});
	const [user, setUser] = useState<User | null>(null);
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [authError, setAuthError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const [locations, setLocations] = useState<Location[]>([]);
	const [newName, setNewName] = useState("");
	const [newLat, setNewLat] = useState("");
	const [newLon, setNewLon] = useState("");
	const [locationError, setLocationError] = useState("");

	useEffect(() => {
		const savedToken = localStorage.getItem("arraylake_token");
		if (savedToken) {
			validateToken(savedToken);
		}
	}, []);

	const validateToken = async (tokenToValidate: string) => {
		setIsLoading(true);
		setAuthError("");

		try {
			const response = await fetch("/api/auth/validate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token: tokenToValidate }),
			});

			const data = await response.json();

			if (!response.ok) {
				setAuthError(data.error || "Invalid token");
				setIsAuthenticated(false);
				localStorage.removeItem("arraylake_token");
			} else {
				setUser(data.user);
				setIsAuthenticated(true);
				localStorage.setItem("arraylake_token", tokenToValidate);
				fetchLocations();
			}
		} catch {
			setAuthError("Failed to validate token");
			setIsAuthenticated(false);
		} finally {
			setIsLoading(false);
		}
	};

	const handleLogin = (e: React.FormEvent) => {
		e.preventDefault();
		if (token.trim()) {
			validateToken(token.trim());
		}
	};

	const handleLogout = () => {
		localStorage.removeItem("arraylake_token");
		setToken("");
		setUser(null);
		setIsAuthenticated(false);
		setLocations([]);
	};

	const fetchLocations = async () => {
		try {
			const response = await fetch("/api/locations");
			const data = await response.json();
			setLocations(data.locations || []);
		} catch {
			console.error("Failed to fetch locations");
		}
	};

	const handleAddLocation = async (e: React.FormEvent) => {
		e.preventDefault();
		setLocationError("");

		const lat = parseFloat(newLat);
		const lon = parseFloat(newLon);

		if (!newName.trim()) {
			setLocationError("Name is required");
			return;
		}
		if (isNaN(lat) || lat < -90 || lat > 90) {
			setLocationError("Latitude must be between -90 and 90");
			return;
		}
		if (isNaN(lon) || lon < -180 || lon > 180) {
			setLocationError("Longitude must be between -180 and 180");
			return;
		}

		try {
			const response = await fetch("/api/locations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: newName.trim(), lat, lon }),
			});

			if (response.ok) {
				setNewName("");
				setNewLat("");
				setNewLon("");
				fetchLocations();
			} else {
				const data = await response.json();
				setLocationError(data.error || "Failed to add location");
			}
		} catch {
			setLocationError("Failed to add location");
		}
	};

	const handleDeleteLocation = async (id: string) => {
		try {
			const response = await fetch(`/api/locations/${id}`, {
				method: "DELETE",
			});

			if (response.ok) {
				fetchLocations();
			}
		} catch {
			console.error("Failed to delete location");
		}
	};

	if (!isAuthenticated) {
		return (
			<Box
				style={{
					minHeight: "100vh",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "white",
				}}
			>
				<Container size="xs">
					<Title order={1} mb="xs">
						Snowbot
					</Title>
					<Text c="dimmed" mb="xl">
						Snow forecast notification service
					</Text>

					<form onSubmit={handleLogin}>
						<Stack>
							<PasswordInput
								label="Arraylake API Token"
								placeholder="Enter your token"
								value={token}
								onChange={(e) => setToken(e.currentTarget.value)}
								disabled={isLoading}
							/>
							<Button
								type="submit"
								fullWidth
								loading={isLoading}
								disabled={!token.trim()}
							>
								Login
							</Button>
							{authError && (
								<Text c="red" size="sm">
									{authError}
								</Text>
							)}
						</Stack>
					</form>
				</Container>
			</Box>
		);
	}

	return (
		<Box
			style={{
				minHeight: "100vh",
				backgroundColor: "white",
			}}
		>
			<Container size="md" py="xl">
				<Group justify="space-between" mb="md">
					<Title order={1}>Snowbot</Title>
					<Group>
						<Text c="dimmed">{user?.email || user?.name || "User"}</Text>
						<Button variant="default" size="sm" onClick={handleLogout}>
							Logout
						</Button>
					</Group>
				</Group>

				<Divider mb="xl" />

				<Title order={2} mb="md">
					Locations
				</Title>

				<Paper p="md" mb="lg">
					<form onSubmit={handleAddLocation}>
						<Group align="flex-end">
							<TextInput
								label="Name"
								placeholder="Location name"
								value={newName}
								onChange={(e) => setNewName(e.currentTarget.value)}
								style={{ flex: 2 }}
							/>
							<TextInput
								label="Latitude"
								placeholder="e.g. 39.0968"
								value={newLat}
								onChange={(e) => setNewLat(e.currentTarget.value)}
								style={{ flex: 1 }}
							/>
							<TextInput
								label="Longitude"
								placeholder="e.g. -120.0324"
								value={newLon}
								onChange={(e) => setNewLon(e.currentTarget.value)}
								style={{ flex: 1 }}
							/>
							<Button type="submit">Add Location</Button>
						</Group>
						{locationError && (
							<Text c="red" size="sm" mt="sm">
								{locationError}
							</Text>
						)}
					</form>
				</Paper>

				{locations.length === 0 ? (
					<Text c="dimmed" fs="italic">
						No locations added yet.
					</Text>
				) : (
					<Table>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>Name</Table.Th>
								<Table.Th>Latitude</Table.Th>
								<Table.Th>Longitude</Table.Th>
								<Table.Th></Table.Th>
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{locations.map((loc) => (
								<Table.Tr key={loc.id}>
									<Table.Td>{loc.name}</Table.Td>
									<Table.Td>{loc.lat}</Table.Td>
									<Table.Td>{loc.lon}</Table.Td>
									<Table.Td>
										<Button
											variant="outline"
											color="red"
											size="xs"
											onClick={() => handleDeleteLocation(loc.id)}
										>
											Delete
										</Button>
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				)}
			</Container>
		</Box>
	);
}

export default App;
