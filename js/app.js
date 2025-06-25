// ===================== Game State ===================== //
let isGameRunning = false;
const GAME_STATE_KEY = "volleyballGameRunning";

const savedState = localStorage.getItem(GAME_STATE_KEY);
if (savedState) isGameRunning = JSON.parse(savedState);

// ===================== Player Data ===================== //
const players = [
	{ name: "Allison", number: 1 },
	{ name: "Amylia", number: 2 },
	{ name: "Kaylee", number: 3 },
	{ name: "Mikayla", number: 4 },
	{ name: "Marin", number: 5 },
	{ name: "Avery", number: 6 },
	{ name: "Jissel", number: 7 },
	{ name: "Brielle", number: 8 },
	{ name: "Kaelie", number: 9 },
	{ name: "Natassja", number: 10 },
	{ name: "Sadarrah", number: 11 },
];

const PLAYTIME_KEY = "volleyballPlaytimes";
let courtPositions = Array(6).fill(null);
let selectedSpot = null;

let playerStats = players.reduce((acc, player, i) => {
	acc[i] = { totalSeconds: 0, isOnCourt: false, lastStartTime: null };
	return acc;
}, {});

const savedStats = localStorage.getItem(PLAYTIME_KEY);
if (savedStats) {
	playerStats = JSON.parse(savedStats);

	if (isGameRunning) {
		const now = Date.now();
		Object.values(playerStats).forEach((stat) => {
			if (stat.isOnCourt && stat.lastStartTime) {
				const elapsed = Math.floor((now - stat.lastStartTime) / 1000);
				stat.totalSeconds += elapsed;
				stat.lastStartTime = now; // resume running
			}
		});
		savePlaytimeToStorage(); // save updated values
	}
}

const COURT_POSITIONS_KEY = "volleyballCourtPositions";
const savedCourt = localStorage.getItem(COURT_POSITIONS_KEY);
if (savedCourt) {
	courtPositions = JSON.parse(savedCourt);
}

// ===================== Timer Utilities ===================== //
function startPlayerTimer(playerIndex) {
	if (!isGameRunning) return;
	if (playerStats[playerIndex].isOnCourt) return;
	playerStats[playerIndex].isOnCourt = true;
	playerStats[playerIndex].lastStartTime = Date.now();
}

function stopPlayerTimer(playerIndex) {
	const stat = playerStats[playerIndex];
	if (stat.lastStartTime) {
		const duration = Math.floor((Date.now() - stat.lastStartTime) / 1000);
		stat.totalSeconds += duration;
		stat.lastStartTime = null;
		stat.isOnCourt = false;
	}
}

function savePlaytimeToStorage() {
	localStorage.setItem(PLAYTIME_KEY, JSON.stringify(playerStats));
}

function updateCourtGrid() {
	const courtButtons = document.querySelectorAll(".court-spot");
	courtButtons.forEach((btn, idx) => {
		const playerIndex = courtPositions[idx];
		btn.textContent = playerIndex !== null ? `#${players[playerIndex].number} ${players[playerIndex].name}` : `Spot ${idx + 1}`;
	});
}

function updatePlaytimeList() {
	const list = document.getElementById("playtimeList");
	if (!list) return;
	list.innerHTML = "";

	players.forEach((player, i) => {
		let seconds = playerStats[i].totalSeconds;
		if (playerStats[i].isOnCourt && playerStats[i].lastStartTime) {
			seconds += Math.floor((Date.now() - playerStats[i].lastStartTime) / 1000);
		}
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;

		const item = document.createElement("li");
		item.className = "list-group-item d-flex justify-content-between";
		item.innerHTML = `<strong>#${player.number} ${player.name}</strong> <span>${mins}m ${secs}s</span>`;
		list.appendChild(item);
	});
}

// Updates bench list when subbing
function updateBenchList() {
	const benchList = document.getElementById("benchList");
	if (!benchList) return;

	benchList.innerHTML = "";

	players.forEach((player, i) => {
		if (!courtPositions.includes(i)) {
			let seconds = playerStats[i].totalSeconds;
			if (playerStats[i].isOnCourt && playerStats[i].lastStartTime) {
				seconds += Math.floor((Date.now() - playerStats[i].lastStartTime) / 1000);
			}
			const mins = Math.floor(seconds / 60);
			const secs = seconds % 60;

			const item = document.createElement("li");
			item.className = "list-group-item d-flex justify-content-between";
			item.innerHTML = `<strong>#${player.number} ${player.name}</strong> <span>${mins}m ${secs}s</span>`;
			benchList.appendChild(item);
		}
	});
}

// ===================== Rotation Logic ===================== //
function rotateCourtClockwise() {
	if (courtPositions.some((pos) => pos === null)) {
		showAlert("All 6 court spots must be filled before rotating.", "warning");
		return;
	}

	// Stop timers
	courtPositions.forEach((index) => stopPlayerTimer(index));

	// Clone positions
	const prev = [...courtPositions];

	// Apply clockwise rotation
	courtPositions[1] = prev[0]; // 0 → 1
	courtPositions[2] = prev[1]; // 1 → 2
	courtPositions[5] = prev[2]; // 2 → 5
	courtPositions[4] = prev[5]; // 5 → 4
	courtPositions[3] = prev[4]; // 4 → 3
	courtPositions[0] = prev[3]; // 3 → 0

	// Restart timers
	courtPositions.forEach((index) => startPlayerTimer(index));

	// Save and update UI
	localStorage.setItem(COURT_POSITIONS_KEY, JSON.stringify(courtPositions));
	updateCourtGrid();
	updateBenchList();
	updatePlaytimeList();
	savePlaytimeToStorage();
}

// ===================== Match Details ===================== //
(() => {
	const MATCH_DETAILS_KEY = "matchDetails";
	const initMatchDetails = () => {
		const inputs = document.querySelectorAll("#matchID, #matchDate, #matchHomeAway, #matchType, #matchLocation, #opposingTeam");

		const savedDetails = localStorage.getItem(MATCH_DETAILS_KEY);
		if (savedDetails) {
			const matchDetails = JSON.parse(savedDetails);
			inputs.forEach((input) => {
				if (matchDetails[input.id]) {
					input.value = matchDetails[input.id];
				}
			});
		}

		inputs.forEach((input) => {
			input.addEventListener("blur", () => saveMatchDetails());
		});
	};

	const saveMatchDetails = () => {
		const matchDetails = {
			matchID: document.getElementById("matchID").value,
			matchDate: document.getElementById("matchDate").value,
			matchHomeAway: document.getElementById("matchHomeAway").value,
			matchType: document.getElementById("matchType").value,
			matchLocation: document.getElementById("matchLocation").value,
			opposingTeam: document.getElementById("opposingTeam").value,
		};
		localStorage.setItem(MATCH_DETAILS_KEY, JSON.stringify(matchDetails));
	};

	document.addEventListener("DOMContentLoaded", initMatchDetails);
})();

// ===================== Score Keeping ===================== //
(() => {
	const STORAGE_KEY = "scoreTracking";
	const FINAL_SCORE_KEY = "finalScores";

	const initScoreKeeping = () => {
		let scores = { home: 0, away: 0 };
		const storedScores = localStorage.getItem(STORAGE_KEY);
		if (storedScores) scores = JSON.parse(storedScores);

		const upButtons = document.querySelectorAll(".score-arrow.up");
		const downButtons = document.querySelectorAll(".score-arrow.down");
		const finalScoreButton = document.getElementById("finalScore");
		const resetScoreButton = document.getElementById("resetScore");

		const updateScore = (team, change) => {
			scores[team] += change;
			localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
			document.getElementById(`score${team.charAt(0).toUpperCase() + team.slice(1)}Actual`).textContent = scores[team];

			const downArrow = document.querySelector(`.score-arrow.down[data-team="${team}"]`);
			if (downArrow) {
				if (scores[team] === 0) {
					downArrow.classList.add("disabled");
					downArrow.style.opacity = "0.5";
					downArrow.style.pointerEvents = "none";
				} else {
					downArrow.classList.remove("disabled");
					downArrow.style.opacity = "1";
					downArrow.style.pointerEvents = "auto";
				}
			}
		};

		upButtons.forEach((button) => button.addEventListener("click", (e) => updateScore(e.target.dataset.team, 1)));
		downButtons.forEach((button) =>
			button.addEventListener("click", (e) => {
				const team = e.target.dataset.team;
				if (scores[team] > 0) updateScore(team, -1);
			})
		);

		finalScoreButton.addEventListener("click", () => {
			document.getElementById("homeScore").value = scores.home;
			document.getElementById("awayScore").value = scores.away;
			localStorage.setItem(FINAL_SCORE_KEY, JSON.stringify(scores));

			courtPositions.forEach((playerIndex) => {
				if (playerIndex !== null && playerStats[playerIndex].isOnCourt) {
					stopPlayerTimer(playerIndex);
				}
			});
			isGameRunning = false;
			localStorage.setItem(GAME_STATE_KEY, JSON.stringify(false));

			const startGameBtn = document.getElementById("startGameBtn");
			if (startGameBtn) startGameBtn.disabled = true;

			updatePlaytimeList();
			savePlaytimeToStorage();
			updateBenchList();

			showAlert("Final Scores Saved!", "success");
		});

		resetScoreButton.addEventListener("click", () => {
			scores = { home: 0, away: 0 };
			document.getElementById("scoreHomeActual").textContent = "0";
			document.getElementById("scoreAwayActual").textContent = "0";
			document.getElementById("homeScore").value = "";
			document.getElementById("awayScore").value = "";
			localStorage.removeItem(STORAGE_KEY);
			localStorage.removeItem(FINAL_SCORE_KEY);
			localStorage.removeItem(GAME_STATE_KEY);
			localStorage.removeItem(COURT_POSITIONS_KEY);

			isGameRunning = false;
			const startGameBtn = document.getElementById("startGameBtn");
			if (startGameBtn) startGameBtn.disabled = false;

			downButtons.forEach((btn) => {
				btn.classList.add("disabled");
				btn.style.opacity = "0.5";
				btn.style.pointerEvents = "none";
			});

			players.forEach(
				(_, i) =>
					(playerStats[i] = {
						totalSeconds: 0,
						isOnCourt: false,
						lastStartTime: null,
					})
			);
			courtPositions = Array(6).fill(null);
			localStorage.removeItem(PLAYTIME_KEY);
			updateCourtGrid();
			updatePlaytimeList();
			showAlert("Scores have been reset!", "warning");
		});

		const savedFinalScores = localStorage.getItem(FINAL_SCORE_KEY);
		if (savedFinalScores) {
			const finalScores = JSON.parse(savedFinalScores);
			document.getElementById("homeScore").value = finalScores.home;
			document.getElementById("awayScore").value = finalScores.away;
		}

		Object.keys(scores).forEach((team) => updateScore(team, 0));
	};

	document.addEventListener("DOMContentLoaded", initScoreKeeping);
})();

// ===================== Alert Message ===================== //
function showAlert(message, type) {
	const alertContainer = document.getElementById("alertContainer");
	const alertDiv = document.createElement("div");
	alertDiv.className = `alert alert-${type} alert-dismissible fade show text-center`;
	alertDiv.setAttribute("role", "alert");
	alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
	alertContainer.appendChild(alertDiv);
	setTimeout(() => {
		alertDiv.classList.remove("show");
		alertDiv.classList.add("fade");
		setTimeout(() => alertDiv.remove(), 500);
	}, 3000);
}

// ===================== DOM Events ===================== //
document.addEventListener("DOMContentLoaded", () => {
	const courtButtons = document.querySelectorAll(".court-spot");
	const playerList = document.getElementById("playerList");
	const startGameBtn = document.getElementById("startGameBtn");
	const rotateBtn = document.getElementById("rotateBtn");
	if (rotateBtn) {
		rotateBtn.addEventListener("click", rotateCourtClockwise);
	}

	courtButtons.forEach((button) => {
		button.addEventListener("click", () => {
			selectedSpot = parseInt(button.dataset.spot);
			showPlayerPicker();
		});
	});

	function showPlayerPicker() {
		playerList.innerHTML = "";
		players.forEach((player, index) => {
			const alreadyOnCourt = courtPositions.includes(index);
			const currentOccupant = courtPositions[selectedSpot];

			const playerButton = document.createElement("button");
			playerButton.className = "btn btn-outline-primary w-100 my-1";
			playerButton.textContent = `#${player.number} ${player.name}` + (alreadyOnCourt ? " (SUB)" : "");
			playerButton.disabled = alreadyOnCourt && currentOccupant !== index;

			playerButton.addEventListener("click", () => {
				const prevPlayerIndex = courtPositions[selectedSpot];
				if (prevPlayerIndex !== null && playerStats[prevPlayerIndex].isOnCourt) {
					stopPlayerTimer(prevPlayerIndex);
				}
				courtPositions[selectedSpot] = index;
				localStorage.setItem(COURT_POSITIONS_KEY, JSON.stringify(courtPositions));
				startPlayerTimer(index);
				updateCourtGrid();
				updatePlaytimeList();
				savePlaytimeToStorage();
				updateBenchList();
				bootstrap.Modal.getInstance(document.getElementById("playerModal")).hide();
			});

			playerList.appendChild(playerButton);
		});
		const modal = new bootstrap.Modal(document.getElementById("playerModal"));
		modal.show();
	}

	if (startGameBtn) {
		startGameBtn.addEventListener("click", () => {
			if (isGameRunning) return;
			isGameRunning = true;
			localStorage.setItem(GAME_STATE_KEY, JSON.stringify(true));
			courtPositions.forEach((playerIndex) => {
				if (playerIndex !== null) {
					startPlayerTimer(playerIndex);
				}
			});
			showAlert("Game Started!", "success");
			startGameBtn.disabled = true;
		});
		if (isGameRunning) startGameBtn.disabled = true;
	}

	updateCourtGrid();
	updatePlaytimeList();
	updateBenchList();
	setInterval(() => {
		updatePlaytimeList();
		updateBenchList();
	}, 1000);
});

if ("serviceWorker" in navigator) {
	navigator.serviceWorker
		.register("/service-worker.js")
		.then(() => console.log("✅ Service Worker registered"))
		.catch((err) => console.error("❌ Service Worker error:", err));
}
