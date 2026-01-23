import { useState, useEffect } from "react";
import {
	Box,
	Button,
	Code,
	Container,
	Divider,
	Group,
	Modal,
	Paper,
	PasswordInput,
	Stack,
	Table,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
	useValidateToken,
	useLocations,
	useAddLocation,
	useDeleteLocation,
	useTestWebhook,
	type User,
	type WebhookResponse,
} from "./api";

function App() {
	const [token, setToken] = useState<string>(() => {
		return localStorage.getItem("arraylake_token") || "";
	});
	const [user, setUser] = useState<User | null>(null);
	const [isAuthenticated, setIsAuthenticated] = useState(false);

	const [newName, setNewName] = useState("");
	const [newLat, setNewLat] = useState("");
	const [newLon, setNewLon] = useState("");
	const [locationError, setLocationError] = useState("");

	const [modalOpened, { open: openModal, close: closeModal }] =
		useDisclosure(false);
	const [webhookResult, setWebhookResult] = useState<WebhookResponse | null>(
		null
	);

	const validateTokenMutation = useValidateToken();
	const locationsQuery = useLocations(isAuthenticated);
	const addLocationMutation = useAddLocation();
	const deleteLocationMutation = useDeleteLocation();
	const testWebhookMutation = useTestWebhook();

	useEffect(() => {
		const savedToken = localStorage.getItem("arraylake_token");
		if (savedToken) {
			validateTokenMutation.mutate(savedToken, {
				onSuccess: (data) => {
					setUser(data.user);
					setIsAuthenticated(true);
				},
				onError: () => {
					localStorage.removeItem("arraylake_token");
				},
			});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleLogin = (e: React.FormEvent) => {
		e.preventDefault();
		if (token.trim()) {
			validateTokenMutation.mutate(token.trim(), {
				onSuccess: (data) => {
					setUser(data.user);
					setIsAuthenticated(true);
					localStorage.setItem("arraylake_token", token.trim());
				},
				onError: () => {
					localStorage.removeItem("arraylake_token");
				},
			});
		}
	};

	const handleLogout = () => {
		localStorage.removeItem("arraylake_token");
		setToken("");
		setUser(null);
		setIsAuthenticated(false);
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

		addLocationMutation.mutate(
			{ name: newName.trim(), lat, lon },
			{
				onSuccess: () => {
					setNewName("");
					setNewLat("");
					setNewLon("");
				},
				onError: (error) => {
					setLocationError(error.message);
				},
			},
		);
	};

	const handleDeleteLocation = (id: string) => {
		deleteLocationMutation.mutate(id);
	};

	const handleTestWebhook = () => {
		testWebhookMutation.mutate(undefined, {
			onSuccess: (data) => {
				setWebhookResult(data);
				openModal();
			},
			onError: (error) => {
				setWebhookResult({
					success: false,
					error: error.message,
				});
				openModal();
			},
		});
	};

	const locations = locationsQuery.data ?? [];

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
								disabled={validateTokenMutation.isPending}
							/>
							<Button
								type="submit"
								fullWidth
								loading={validateTokenMutation.isPending}
								disabled={!token.trim()}
							>
								Login
							</Button>
							{validateTokenMutation.error && (
								<Text c="red" size="sm">
									{validateTokenMutation.error.message}
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

				<Group justify="space-between" mb="md">
					<Title order={2}>Locations</Title>
					<Button
						variant="light"
						size="sm"
						onClick={handleTestWebhook}
						loading={testWebhookMutation.isPending}
					>
						Test Forecast
					</Button>
				</Group>

				<Paper py="md" mb="lg">
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
							<Button type="submit" loading={addLocationMutation.isPending}>
								Add Location
							</Button>
						</Group>
						{locationError && (
							<Text c="red" size="sm" mt="sm">
								{locationError}
							</Text>
						)}
					</form>
				</Paper>

				{locationsQuery.isLoading ? (
					<Text c="dimmed" fs="italic">
						Loading locations...
					</Text>
				) : locations.length === 0 ? (
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
											loading={
												deleteLocationMutation.isPending &&
												deleteLocationMutation.variables === loc.id
											}
										>
											Delete
										</Button>
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				)}

				<Modal
					opened={modalOpened}
					onClose={closeModal}
					title="Forecast Test Result"
					size="md"
				>
					{webhookResult && (
						<Stack>
							<Group>
								<Text fw={500}>Status:</Text>
								<Text c={webhookResult.success ? "green" : "red"}>
									{webhookResult.success ? "Success" : "Failed"}
								</Text>
							</Group>
							{webhookResult.message && (
								<Group>
									<Text fw={500}>Message:</Text>
									<Text>{webhookResult.message}</Text>
								</Group>
							)}
							{webhookResult.error && (
								<Group>
									<Text fw={500}>Error:</Text>
									<Text c="red">{webhookResult.error}</Text>
								</Group>
							)}
							{webhookResult.initTime && (
								<Group>
									<Text fw={500}>Init Time:</Text>
									<Code>{webhookResult.initTime}</Code>
								</Group>
							)}
							{webhookResult.locationsChecked !== undefined && (
								<Group>
									<Text fw={500}>Locations Checked:</Text>
									<Text>{webhookResult.locationsChecked}</Text>
								</Group>
							)}
							{webhookResult.locationsWithSnow !== undefined && (
								<Group>
									<Text fw={500}>Locations with Snow:</Text>
									<Text>{webhookResult.locationsWithSnow}</Text>
								</Group>
							)}
						</Stack>
					)}
				</Modal>
			</Container>
		</Box>
	);
}

export default App;
