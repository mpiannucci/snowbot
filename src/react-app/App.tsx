import { useState, useEffect } from "react";

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
			<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
				<div className="w-full max-w-md">
					<h1 className="text-3xl font-bold text-slate-900 mb-2">Snowbot</h1>
					<p className="text-gray-600 mb-8">Snow forecast notification service</p>

					<form onSubmit={handleLogin} className="space-y-4">
						<div>
							<label htmlFor="token" className="block text-sm font-medium text-gray-600 mb-1">
								Arraylake API Token
							</label>
							<input
								id="token"
								type="password"
								value={token}
								onChange={(e) => setToken(e.target.value)}
								placeholder="Enter your token"
								disabled={isLoading}
								className="w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
							/>
						</div>
						<button
							type="submit"
							disabled={isLoading || !token.trim()}
							className="w-full px-4 py-2 bg-purple-500 text-white font-medium rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isLoading ? "Validating..." : "Login"}
						</button>
						{authError && <p className="text-red-400 text-sm">{authError}</p>}
					</form>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<div className="max-w-4xl mx-auto p-6">
				<header className="flex justify-between items-center mb-8 pb-4 border-b border-gray-200">
					<h1 className="text-2xl font-bold text-slate-900">Snowbot</h1>
					<div className="flex items-center gap-4">
						<span className="text-gray-600">{user?.email || user?.name || "User"}</span>
						<button
							onClick={handleLogout}
							className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-100"
						>
							Logout
						</button>
					</div>
				</header>

				<section>
					<h2 className="text-xl font-semibold text-slate-900 mb-4">Locations</h2>

					<form onSubmit={handleAddLocation} className="flex gap-2 mb-6 flex-wrap">
						<input
							type="text"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							placeholder="Location name"
							className="flex-2 min-w-[150px] px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
						/>
						<input
							type="text"
							value={newLat}
							onChange={(e) => setNewLat(e.target.value)}
							placeholder="Latitude"
							className="flex-1 min-w-[100px] px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
						/>
						<input
							type="text"
							value={newLon}
							onChange={(e) => setNewLon(e.target.value)}
							placeholder="Longitude"
							className="flex-1 min-w-[100px] px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
						/>
						<button
							type="submit"
							className="px-4 py-2 bg-purple-500 text-white font-medium rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
						>
							Add Location
						</button>
					</form>
					{locationError && <p className="text-red-400 text-sm mb-4">{locationError}</p>}

					{locations.length === 0 ? (
						<p className="text-gray-500 italic">No locations added yet.</p>
					) : (
						<table className="w-full">
							<thead>
								<tr className="border-b border-gray-200">
									<th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Name</th>
									<th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Latitude</th>
									<th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Longitude</th>
									<th className="text-right py-3 px-2 w-20"></th>
								</tr>
							</thead>
							<tbody>
								{locations.map((loc) => (
									<tr key={loc.id} className="border-b border-gray-100">
										<td className="py-3 px-2 text-slate-900">{loc.name}</td>
										<td className="py-3 px-2 text-slate-900">{loc.lat}</td>
										<td className="py-3 px-2 text-slate-900">{loc.lon}</td>
										<td className="py-3 px-2 text-right">
											<button
												onClick={() => handleDeleteLocation(loc.id)}
												className="px-2 py-1 text-xs text-red-400 border border-red-400 rounded hover:bg-red-400 hover:text-white"
											>
												Delete
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</section>
			</div>
		</div>
	);
}

export default App;
