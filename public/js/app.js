(() => {
	"use strict";

// ===================== Game State ===================== //
let isGameRunning = false;
const GAME_STATE_KEY = "volleyballGameRunning";
const SCORE_STORAGE_KEY = "scoreTracking";
const GAME_TIMER_KEY = "volleyballGameTimer";

let savedState = null;
try {
	savedState = localStorage.getItem(GAME_STATE_KEY);
	if (savedState) {
		isGameRunning = JSON.parse(savedState);
	}
} catch (error) {
	console.error("Failed to restore game state from storage.", error);
}

let gameTimerState = { startTime: null, elapsedMs: 0 };
try {
	const storedTimer = JSON.parse(localStorage.getItem(GAME_TIMER_KEY));
	if (storedTimer && typeof storedTimer === "object") {
		gameTimerState = {
			startTime: typeof storedTimer.startTime === "number" ? storedTimer.startTime : null,
			elapsedMs: typeof storedTimer.elapsedMs === "number" ? storedTimer.elapsedMs : 0,
		};
	}
} catch (error) {
	console.error("Failed to restore game timer state from storage.", error);
	gameTimerState = { startTime: null, elapsedMs: 0 };
}
if (isGameRunning && !gameTimerState.startTime) {
	gameTimerState.startTime = Date.now();
}

// ===================== Player Data ===================== //
const PLAYERS_LIST_KEY = "volleyballPlayersList";
const GAME_ROSTER_KEY = "volleyballGameRoster"; // stores array of player ids checked for this game

const defaultPlayers = [
	{ id: "p1", name: "Allison", number: 1 },
	{ id: "p2", name: "Amylia", number: 2 },
	{ id: "p3", name: "Mikayla", number: 3 },
	{ id: "p4", name: "Marin", number: 4 },
	{ id: "p5", name: "Jissel", number: 5 },
	{ id: "p6", name: "Lea", number: 6 },
	{ id: "p7", name: "Cecily", number: 7 },
	{ id: "p8", name: "Harper", number: 8 },
	{ id: "p9", name: "Natassja", number: 9 },
];

function loadPlayers() {
	try {
		const stored = JSON.parse(localStorage.getItem(PLAYERS_LIST_KEY));
		if (Array.isArray(stored) && stored.length) {
			return stored.map((p, i) => ({ id: p.id || `pid_${i}_${p.name}`, name: p.name, number: Number(p.number) || i + 1 }));
		}
	} catch (error) {
		console.error("Failed to load players list.", error);
	}
	return [...defaultPlayers];
}
function savePlayers(list) {
	try {
		localStorage.setItem(PLAYERS_LIST_KEY, JSON.stringify(list));
	} catch (error) {
		console.error("Failed to persist players list.", error);
	}
}
function loadRosterSet() {
	try {
		const arr = JSON.parse(localStorage.getItem(GAME_ROSTER_KEY));
		if (Array.isArray(arr)) return new Set(arr);
	} catch (error) {
		console.error("Failed to load roster selection.", error);
	}
	return new Set();
}
function saveRosterSet(set) {
	try {
		localStorage.setItem(GAME_ROSTER_KEY, JSON.stringify(Array.from(set)));
	} catch (error) {
		console.error("Failed to persist roster selection.", error);
	}
}

let players = loadPlayers();

const PLAYTIME_KEY = "volleyballPlaytimes";
const MAX_FOULS = 5;
let courtPositions = Array(6).fill(null);
let selectedSpot = null;

let playerStats = players.reduce((acc, player, i) => {
	acc[i] = { totalSeconds: 0, isOnCourt: false, lastStartTime: null, fouls: 0, points: 0 };
	return acc;
}, {});

let savedStatsRaw = null;
let parsedStats = null;
try {
	savedStatsRaw = localStorage.getItem(PLAYTIME_KEY);
	if (savedStatsRaw) {
		parsedStats = JSON.parse(savedStatsRaw);
	}
} catch (error) {
	console.error("Failed to restore playtime data from storage.", error);
}
if (parsedStats) {
	players.forEach((player, i) => {
		playerStats[i] = {
			...{ totalSeconds: 0, isOnCourt: false, lastStartTime: null, fouls: 0, points: 0 },
			...(parsedStats[i] || {}),
		};
	});

	if (isGameRunning) {
		const now = Date.now();
		Object.values(playerStats).forEach((stat) => {
			if (stat.isOnCourt && stat.lastStartTime) {
				const elapsed = Math.floor((now - stat.lastStartTime) / 1000);
				stat.totalSeconds += elapsed;
				stat.lastStartTime = now;
			}
		});
		savePlaytimeToStorage();
	}
}

const COURT_POSITIONS_KEY = "volleyballCourtPositions";
let savedCourt = null;
try {
	savedCourt = localStorage.getItem(COURT_POSITIONS_KEY);
	if (savedCourt) {
		courtPositions = JSON.parse(savedCourt);
	}
} catch (error) {
	console.error("Failed to restore court positions from storage.", error);
}

// ===================== Core Game Logic Functions ===================== //
function startPlayerTimer(playerIndex) {
	if (!isGameRunning || playerIndex === null) return;
	playerStats[playerIndex].isOnCourt = true;
	playerStats[playerIndex].lastStartTime = Date.now();
}

function stopPlayerTimer(playerIndex) {
	if (playerIndex === null) return;
	const stat = playerStats[playerIndex];
	if (stat.lastStartTime) {
		const duration = Math.floor((Date.now() - stat.lastStartTime) / 1000);
		stat.totalSeconds += duration;
		stat.lastStartTime = null;
	}
	stat.isOnCourt = false;
}

function savePlaytimeToStorage() {
	try {
		localStorage.setItem(PLAYTIME_KEY, JSON.stringify(playerStats));
	} catch (error) {
		console.error("Failed to persist playtime data.", error);
	}
}

function saveGameTimerState() {
	try {
		localStorage.setItem(GAME_TIMER_KEY, JSON.stringify(gameTimerState));
	} catch (error) {
		console.error("Failed to persist game timer state.", error);
	}
}

function resetGameTimerState() {
	gameTimerState = { startTime: null, elapsedMs: 0 };
	saveGameTimerState();
	updateGameTimerDisplay();
}

function startGameTimer(resetElapsed = false) {
	if (resetElapsed) {
		gameTimerState.elapsedMs = 0;
	}
	gameTimerState.startTime = Date.now();
	saveGameTimerState();
	updateGameTimerDisplay();
}

function stopGameTimer(referenceTime = Date.now()) {
	if (gameTimerState.startTime) {
		const elapsed = Math.max(0, referenceTime - gameTimerState.startTime);
		gameTimerState.elapsedMs += elapsed;
		gameTimerState.startTime = null;
		saveGameTimerState();
		updateGameTimerDisplay();
	} else {
		updateGameTimerDisplay();
	}
}

function getCurrentGameElapsedMs() {
	let total = gameTimerState.elapsedMs;
	if (isGameRunning && gameTimerState.startTime) {
		total += Date.now() - gameTimerState.startTime;
	}
	return Math.max(0, total);
}

function updateGameTimerDisplay() {
	const display = document.getElementById("gameTimerValue");
	if (!display) return;
	const totalSeconds = Math.floor(getCurrentGameElapsedMs() / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	display.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getPlayerElapsedSeconds(playerIndex, referenceTime = Date.now()) {
	const stats = playerStats[playerIndex];
	if (!stats) return 0;
	let seconds = stats.totalSeconds || 0;
	if (stats.isOnCourt && stats.lastStartTime) {
		seconds += Math.floor((referenceTime - stats.lastStartTime) / 1000);
	}
	return seconds;
}

function snapshotAllPlayerStats(referenceTime = Date.now()) {
	return players.map((_, index) => ({
		seconds: getPlayerElapsedSeconds(index, referenceTime),
		points: playerStats[index]?.points ?? 0,
		fouls: playerStats[index]?.fouls ?? 0,
	}));
}

function applySnapshotToPlayerStats(snapshot) {
	snapshot.forEach(({ seconds }, index) => {
		const stats = playerStats[index];
		if (!stats) return;
		stats.totalSeconds = seconds;
		stats.lastStartTime = null;
		stats.isOnCourt = false;
	});
	savePlaytimeToStorage();
}

function addFoul(playerIndex) {
	if (!isGameRunning) {
		showAlert("You can only add fouls after the game has started.", "warning");
		return;
	}
	playerStats[playerIndex].fouls++;
	savePlaytimeToStorage();
	updateAllUI();

	const currentFouls = playerStats[playerIndex].fouls;
	const playerName = players[playerIndex].name;

	if (currentFouls >= MAX_FOULS) {
		showAlert(`${playerName} has reached the maximum of ${MAX_FOULS} fouls and must be substituted!`, "danger");
	} else if (currentFouls === 3) {
		showAlert(`${playerName} has 3 fouls. Consider a substitution.`, "warning");
	} else {
		showAlert(`Foul added to ${playerName}. Total: ${currentFouls}`, "info");
	}
}

function addPoint(playerIndex) {
	if (!isGameRunning) {
		showAlert("You can only add points after the game has started.", "warning");
		return;
	}
	playerStats[playerIndex].points++;

	// Determine which team to credit and use centralized Score manager
	const homeAway = document.getElementById("matchHomeAway").value;
	const teamToScore = homeAway === "Home" || homeAway === "Away" ? homeAway.toLowerCase() : "home";
	if (typeof Score !== "undefined") {
		Score.increment(teamToScore);
	}

	savePlaytimeToStorage();
	updateAllUI();
	showAlert(`Point for ${players[playerIndex].name}!`, "success");
}

function removePoint(playerIndex) {
	if (!isGameRunning) {
		showAlert("You can only remove points after the game has started.", "warning");
		return;
	}
	const currentPoints = playerStats[playerIndex].points;
	if (currentPoints <= 0) {
		showAlert(`${players[playerIndex].name} has no points to remove.`, "info");
		return;
	}
	playerStats[playerIndex].points = Math.max(0, currentPoints - 1);

	const homeAway = document.getElementById("matchHomeAway").value;
	const teamToScore = homeAway === "Home" || homeAway === "Away" ? homeAway.toLowerCase() : "home";
	if (typeof Score !== "undefined") {
		Score.decrement(teamToScore);
	}

	savePlaytimeToStorage();
	updateAllUI();
	showAlert(`Point removed from ${players[playerIndex].name}.`, "warning");
}

// ===================== UI Update Functions ===================== //

function updateAllUI() {
	updateGameTimerDisplay();
	updateCourtGrid();
	updatePlaytimeList();
	updateBenchList();
	updateOutTodayList();
}

// MODIFIED: updateCourtGrid now calculates and displays playtime.
function updateCourtGrid() {
	const courtGrid = document.getElementById("courtGrid");
	if (!courtGrid) return;
	courtGrid.innerHTML = "";

	for (let i = 0; i < 6; i++) {
		const playerIndex = courtPositions[i];
		const spotContainer = document.createElement("div");
		spotContainer.dataset.spot = i;
		spotContainer.classList.add("court-spot");

		if (playerIndex !== null) {
			const player = players[playerIndex];
			const stats = playerStats[playerIndex];
			spotContainer.classList.add("has-player");

			let seconds = stats.totalSeconds;
			if (stats.isOnCourt && stats.lastStartTime) {
				seconds += Math.floor((Date.now() - stats.lastStartTime) / 1000);
			}
			const mins = Math.floor(seconds / 60);
			const secs = seconds % 60;

			const infoButton = document.createElement("button");
			infoButton.type = "button";
			infoButton.dataset.spot = i;
			const infoButtonClasses = ["court-spot-main", "btn", "w-100"];
			if (stats.fouls >= MAX_FOULS) {
				spotContainer.classList.add("fouls-danger");
				infoButtonClasses.push("btn-danger", "text-white");
			} else if (stats.fouls >= 3) {
				spotContainer.classList.add("fouls-warning");
				infoButtonClasses.push("btn-warning");
			} else {
				infoButtonClasses.push("btn-light");
			}
			infoButton.className = infoButtonClasses.join(" ");
			infoButton.innerHTML = `
				<span class="player-label">#${player.number} ${player.name}</span>
				<div class="player-stats-container">
					<span class="point-count">Pts: ${stats.points}</span>
					<span class="foul-count">Fouls: ${stats.fouls}</span>
				</div>
				<span class="timer-count">${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}</span>
			`;
			spotContainer.appendChild(infoButton);

			const actionsRow = document.createElement("div");
			actionsRow.className = "court-actions";

			const actionConfigs = [
				{ label: "+ Pt", classes: "btn-success", action: "add-point" },
				{ label: "- Pt", classes: "btn-outline-danger", action: "remove-point" },
				{ label: "+ Foul", classes: "btn-warning", action: "add-foul" },
				{ label: '<i class="fa-solid fa-right-left"></i> Sub', classes: "btn-primary", action: "sub-player" },
			];

			actionConfigs.forEach(({ label, classes, action }) => {
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = `btn btn-sm ${classes} court-action-btn`;
				btn.dataset.action = action;
				btn.dataset.spot = i;
				btn.innerHTML = label;
				actionsRow.appendChild(btn);
			});

			spotContainer.appendChild(actionsRow);
		} else {
			const emptyButton = document.createElement("button");
			emptyButton.type = "button";
			emptyButton.dataset.spot = i;
			emptyButton.className = "court-spot-main btn btn-outline-light w-100";
			emptyButton.innerHTML = `
				<span>Spot ${i + 1}</span>
				<small class="text-uppercase text-muted">Assign Player</small>
			`;
			spotContainer.appendChild(emptyButton);
		}
		courtGrid.appendChild(spotContainer);
	}
}

function updatePlaytimeList() {
	const list = document.getElementById("playtimeList");
	if (!list) return;
	list.innerHTML = "";

	courtPositions.forEach((i) => {
		if (i === null) return;

		let seconds = playerStats[i].totalSeconds;
		if (playerStats[i].isOnCourt && playerStats[i].lastStartTime) {
			seconds += Math.floor((Date.now() - playerStats[i].lastStartTime) / 1000);
		}
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		const stats = playerStats[i];

		const item = document.createElement("li");
		item.className = "list-group-item d-flex justify-content-between align-items-center";
		if (stats.fouls >= MAX_FOULS) {
			item.classList.add("list-group-item-danger");
		} else if (stats.fouls >= 3) {
			item.classList.add("list-group-item-warning");
		}
		item.innerHTML = `
			<div class="player-info">
				<strong>#${players[i].number} ${players[i].name}</strong>
				<small class="d-block">Time: ${mins}m ${secs}s | Pts: ${stats.points} | Fouls: ${stats.fouls}</small>
			</div>
		`;
		list.appendChild(item);
	});
}

function updateBenchList() {
	const benchList = document.getElementById("benchList");
	if (!benchList) return;
	benchList.innerHTML = "";
	const roster = loadRosterSet();

	players.forEach((player, i) => {
		if (!courtPositions.includes(i) && (roster.size === 0 || roster.has(player.id))) {
			let seconds = playerStats[i].totalSeconds;
			const mins = Math.floor(seconds / 60);
			const secs = seconds % 60;
			const stats = playerStats[i];

			const item = document.createElement("li");
			item.className = "list-group-item d-flex justify-content-between align-items-center";
			item.innerHTML = `
				<div class="player-info">
					<strong>#${player.number} ${player.name}</strong>
                    <small class="d-block">Time: ${mins}m ${secs}s | Pts: ${stats.points} | Fouls: ${stats.fouls}</small>
				</div>
			`;
			benchList.appendChild(item);
		}
	});
}

function updateOutTodayList() {
	const outList = document.getElementById("outTodayList");
	if (!outList) return;
	outList.innerHTML = "";
	const roster = loadRosterSet();
	// Show players not checked in roster
	players.forEach((player) => {
		if (roster.size > 0 && !roster.has(player.id)) {
			const item = document.createElement("li");
			item.className = "list-group-item d-flex justify-content-between align-items-center";
			item.innerHTML = `
				<div class="player-info">
					<strong>#${player.number} ${player.name}</strong>
				</div>
			`;
			outList.appendChild(item);
		}
	});
}

// ===================== Rotation and Game Control ===================== //
function rotateCourtClockwise() {
	if (courtPositions.some((pos) => pos === null)) {
		showAlert("All 6 court spots must be filled before rotating.", "warning");
		return;
	}

	courtPositions.forEach((index) => stopPlayerTimer(index));
	const prev = [...courtPositions];
	courtPositions[1] = prev[0];
	courtPositions[2] = prev[1];
	courtPositions[5] = prev[2];
	courtPositions[4] = prev[5];
	courtPositions[3] = prev[4];
	courtPositions[0] = prev[3];
	courtPositions.forEach((index) => startPlayerTimer(index));

	try {
		localStorage.setItem(COURT_POSITIONS_KEY, JSON.stringify(courtPositions));
	} catch (error) {
		console.error("Failed to persist rotated court positions.", error);
	}
	updateAllUI();
	savePlaytimeToStorage();
	showAlert("Players Rotated!", "info");
}

// Internal utility to fully reset game state; when suppressAlert is true, no alert is shown
function performFullReset(suppressAlert = false) {
	try {
		courtPositions.forEach((playerIndex) => stopPlayerTimer(playerIndex));

		// Reset scores via centralized manager to clear in-memory and storage state
		if (typeof Score !== "undefined") {
			Score.reset();
		} else {
			localStorage.removeItem(SCORE_STORAGE_KEY);
			const h = document.getElementById("scoreHomeActual");
			const a = document.getElementById("scoreAwayActual");
			const hi = document.getElementById("homeScore");
			const ai = document.getElementById("awayScore");
			if (h) h.textContent = "0";
			if (a) a.textContent = "0";
			if (hi) hi.value = "";
			if (ai) ai.value = "";
		}

		isGameRunning = false;
		localStorage.removeItem(GAME_STATE_KEY);
		resetGameTimerState();
		const startBtn = document.getElementById("startGameBtn");
		if (startBtn) startBtn.disabled = false;

		courtPositions = Array(6).fill(null);
		localStorage.removeItem(COURT_POSITIONS_KEY);
		players.forEach((_, i) => (playerStats[i] = { totalSeconds: 0, isOnCourt: false, lastStartTime: null, fouls: 0, points: 0 }));
		localStorage.removeItem(PLAYTIME_KEY);

		// Clear roster selections (uncheck everyone)
		try {
			localStorage.removeItem(GAME_ROSTER_KEY);
			if (window.__renderRoster && typeof window.__renderRoster === "function") {
				window.__renderRoster();
			}
		} catch (error) {
			console.error("Failed to clear roster selection from storage.", error);
		}

		// Clear match details (inputs and storage)
		try {
			const ids = ["matchDate", "matchHomeAway", "matchType", "matchLocation", "opposingTeam"];
			ids.forEach((id) => {
				const el = document.getElementById(id);
				if (!el) return;
				if (el.tagName === "SELECT") {
					// Try to set the disabled placeholder option if present
					let set = false;
					for (let i = 0; i < el.options.length; i++) {
						if (el.options[i].disabled) {
							el.selectedIndex = i;
							set = true;
							break;
						}
					}
					if (!set) {
						el.selectedIndex = 0;
					}
				} else {
					el.value = "";
				}
				// remove filled class for floating labels
				el.classList && el.classList.remove("is-filled");
			});
			localStorage.removeItem("matchDetails");
			if (window.__syncFloatingLabels && typeof window.__syncFloatingLabels === "function") window.__syncFloatingLabels();
		} catch (error) {
			console.error("Failed to clear match details from storage.", error);
		}

		updateAllUI();
		if (!suppressAlert) showAlert("Game has been reset!", "warning");
	} catch (e) {
		// Fallback safety to avoid leaving the app in a broken state
		console.error("Failed to fully reset game:", e);
		if (!suppressAlert) showAlert("Failed to reset game.", "danger");
	}
}

function resetGame() {
	showConfirmModal("Are you sure you want to reset everything? This will clear all scores, play times, and fouls.", () => {
		performFullReset(false);
	});
}

// ===================== Score Manager ===================== //
// Centralized controller to keep UI, memory, and storage in sync
const Score = (() => {
	let scores = { home: 0, away: 0 };

	const load = () => {
		try {
			const fromStorage = JSON.parse(localStorage.getItem(SCORE_STORAGE_KEY));
			if (fromStorage && typeof fromStorage.home !== "undefined" && typeof fromStorage.away !== "undefined") {
				// Ensure numbers
				scores = { home: Number(fromStorage.home) || 0, away: Number(fromStorage.away) || 0 };
			}
		} catch (error) {
			console.error("Failed to load score data from storage.", error);
			scores = { home: 0, away: 0 };
		}
	};

	const save = () => {
		try {
			localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(scores));
		} catch (error) {
			console.error("Failed to persist score data.", error);
		}
	};
	const updateUI = () => {
		// Update classic single-scoreboard IDs if present
		const idHome = document.getElementById("scoreHomeActual");
		const idAway = document.getElementById("scoreAwayActual");
		if (idHome) idHome.textContent = String(scores.home);
		if (idAway) idAway.textContent = String(scores.away);

		// Update any replicated score displays on the page (Court tab, etc.)
		document.querySelectorAll('.score-actual[data-team="home"]').forEach((el) => {
			el.textContent = String(scores.home);
		});
		document.querySelectorAll('.score-actual[data-team="away"]').forEach((el) => {
			el.textContent = String(scores.away);
		});
	};

	const increment = (team) => {
		if (!(team === "home" || team === "away")) return;
		scores[team] += 1;
		save();
		updateUI();
	};
	const decrement = (team) => {
		if (!(team === "home" || team === "away")) return;
		scores[team] = Math.max(0, scores[team] - 1);
		save();
		updateUI();
	};
	const reset = () => {
		scores = { home: 0, away: 0 };
		save();
		updateUI();
		// Clear final score inputs
		const homeInput = document.getElementById("homeScore");
		const awayInput = document.getElementById("awayScore");
		if (homeInput) homeInput.value = "";
		if (awayInput) awayInput.value = "";
	};

	const init = () => {
		load();
		updateUI();

		// Wire arrows
		document.querySelectorAll(".score-arrow.up").forEach((btn) =>
			btn.addEventListener("click", (e) => {
				// Block scoring until 6 players are on court
				if (courtPositions.filter((p) => p !== null).length < 6) {
					showAlert("Please select 6 players for the court before starting.", "warning");
					return;
				}
				const team = (e.currentTarget || e.target).dataset.team;
				increment(team);
			})
		);
		document.querySelectorAll(".score-arrow.down").forEach((btn) =>
			btn.addEventListener("click", (e) => {
				// Block scoring until 6 players are on court
				if (courtPositions.filter((p) => p !== null).length < 6) {
					showAlert("Please select 6 players for the court before starting.", "warning");
					return;
				}
				const team = (e.currentTarget || e.target).dataset.team;
				decrement(team);
			})
		);

		// Final Score button
		const finalBtn = document.getElementById("finalScore");
		if (finalBtn) {
			finalBtn.addEventListener("click", () => {
				const homeInput = document.getElementById("homeScore");
				const awayInput = document.getElementById("awayScore");
				if (homeInput) homeInput.value = String(scores.home);
				if (awayInput) awayInput.value = String(scores.away);
				showAlert("Final Score Saved!", "success");
				// Also reset everything after saving the final score (Score tab flow)
				performFullReset(true);
			});
		}

		// Court tab Final Score button (with confirmation and PDF generation)
		const finalCourtBtn = document.getElementById("finalScoreCourtBtn");
		if (finalCourtBtn) {
			finalCourtBtn.addEventListener("click", () => {
				// Block until 6 players are on court
				if (courtPositions.filter((p) => p !== null).length < 6) {
					showAlert("Please select 6 players for the court before starting.", "warning");
					return;
				}
				const finalizationTimestamp = Date.now();
				const playerSnapshotAtFinal = snapshotAllPlayerStats(finalizationTimestamp);
				showConfirmModal("Are you sure you want to end the game?", () => {
					// Save final score to inputs like original behavior
					const homeInput = document.getElementById("homeScore");
					const awayInput = document.getElementById("awayScore");
					if (homeInput) homeInput.value = String(scores.home);
					if (awayInput) awayInput.value = String(scores.away);

					const playerSnapshot = playerSnapshotAtFinal;
					stopGameTimer(finalizationTimestamp);
					applySnapshotToPlayerStats(playerSnapshot);
					isGameRunning = false;
					try {
						localStorage.setItem(GAME_STATE_KEY, JSON.stringify(false));
					} catch (storageError) {
						console.error("Failed to persist game running flag during finalization.", storageError);
					}
					updateAllUI();

					// Generate PDF summary
					const generatePdf = () => {
						const { jsPDF } = window.jspdf || {};
						if (!jsPDF) {
							showAlert("PDF library not loaded.", "danger");
							return;
						}
						const doc = new jsPDF();

						// Gather match details
						const matchDetails = {
							date: document.getElementById("matchDate")?.value || "",
							homeAway: document.getElementById("matchHomeAway")?.value || "",
							location: document.getElementById("matchLocation")?.value || "",
							type: document.getElementById("matchType")?.value || "",
							opponent: document.getElementById("opposingTeam")?.value || "",
							score: { home: scores.home, away: scores.away },
						};

						// Determine who played (roster-checked or anyone set on court/bench)
						const roster = loadRosterSet();
						const playedIndexes = new Set();
						courtPositions.forEach((idx) => {
							if (idx !== null) playedIndexes.add(idx);
						});
						// Include bench players from roster
						players.forEach((p, idx) => {
							if (roster.size === 0 || roster.has(p.id)) playedIndexes.add(idx);
						});

						// Title with matchup and bold styling
						const opponentName = matchDetails.opponent || "Opponent";
						doc.setFont("helvetica", "bold");
						doc.setFontSize(16);
						doc.text(`Volleyball Match Summary (Flames vs ${opponentName})`, 14, 16);
						// Details
						doc.setFont("helvetica", "normal");
						doc.setFontSize(11);
						let y = 26;
						// Format date as MMM D, YYYY if possible
						let formattedDate = matchDetails.date;
						try {
							const d = matchDetails.date ? new Date(matchDetails.date) : null;
							if (d && !isNaN(d.getTime())) {
								formattedDate = d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
							}
						} catch (e) {}
						// Helper to draw bold label and normal value on one line
						const drawLabelValue = (label, value, x, y) => {
							doc.setFont("helvetica", "bold");
							doc.text(label, x, y);
							const lw = doc.getTextWidth(label);
							doc.setFont("helvetica", "normal");
							doc.text(String(value || ""), x + lw + 2, y);
						};
						drawLabelValue("Date: ", formattedDate, 14, y);
						y += 6;
						drawLabelValue("Home/Away: ", matchDetails.homeAway, 14, y);
						y += 6;
						drawLabelValue("Location: ", matchDetails.location, 14, y);
						y += 6;
						drawLabelValue("Match Type: ", matchDetails.type, 14, y);
						y += 6;
						drawLabelValue("Opponent: ", matchDetails.opponent, 14, y);
						y += 8;

						// Final Score label bold + value normal
						doc.setFontSize(13);
						doc.setFont("helvetica", "bold");
						const fsLabel = "Final Score: ";
						doc.text(fsLabel, 14, y);
						const fsLabelW = doc.getTextWidth(fsLabel);
						doc.setFont("helvetica", "normal");
						doc.text(`Home ${scores.home} - Away ${scores.away}`, 14 + fsLabelW + 2, y);
						y += 10;

						// Players heading
						doc.setFontSize(12);
						doc.setFont("helvetica", "bold");
						doc.text("Players", 14, y);
						y += 6;
						// Column headers bold
						doc.setFont("helvetica", "bold");
						doc.setFontSize(10);
						doc.text("#", 14, y);
						doc.text("Name", 22, y);
						doc.text("Time", 90, y);
						doc.text("Pts", 120, y);
						doc.text("Fouls", 140, y);
						y += 4;
						doc.setFont("helvetica", "normal");

						const addPlayerRow = (idx) => {
							const p = players[idx];
							const snapshot = playerSnapshot[idx];
							if (!p || !snapshot) return;
							const mins = Math.floor(snapshot.seconds / 60);
							const secs = snapshot.seconds % 60;
							const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
							const pts = snapshot.points ?? 0;
							const fouls = snapshot.fouls ?? 0;

							doc.text(String(p.number), 14, y);
							doc.text(p.name, 22, y);
							doc.text(timeStr, 90, y);
							doc.text(String(pts), 120, y);
							doc.text(String(fouls), 140, y);
							y += 6;
							if (y > 280) {
								doc.addPage();
								y = 20;
							}
						};

						Array.from(playedIndexes)
							.sort((a, b) => players[a].number - players[b].number)
							.forEach(addPlayerRow);

						doc.save(`volleyball_match_${Date.now()}.pdf`);
						showAlert("Final Score Saved and PDF generated.", "success");
						// After PDF is saved/downloaded, reset the entire game state
						performFullReset(true);
					};

					try {
						// If jsPDF isn't loaded (slow network), load it on-demand and then generate
						if (!(window.jspdf && window.jspdf.jsPDF)) {
							const script = document.createElement("script");
							script.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
							script.onload = generatePdf;
							script.onerror = () => showAlert("Failed to load PDF library.", "danger");
							document.head.appendChild(script);
						} else {
							generatePdf();
						}
					} catch (err) {
						console.error(err);
						showAlert("Failed to generate PDF.", "danger");
					}
				});
			});
		}
	};

	return {
		init,
		increment,
		decrement,
		reset,
		get scores() {
			return { ...scores };
		},
	};
})();

// ===================== Modals and Alerts ===================== //
// Track last alert to avoid intrusive stacking
let __lastAlert = { message: null, at: 0, timeoutId: null };
function showAlert(message, type) {
	try {
		const alertContainer = document.getElementById("alertContainer");
		if (!alertContainer) {
			console.warn("Alert container not found in the DOM.");
			return;
		}
		const now = Date.now();
		// Throttle identical alerts fired rapidly
		if (__lastAlert.message === message && now - __lastAlert.at < 1200) {
			return;
		}
		__lastAlert.message = message;
		__lastAlert.at = now;

		// Ensure only one alert is visible at a time
		alertContainer.innerHTML = "";

		const alertDiv = document.createElement("div");
		alertDiv.className = `alert alert-${type} alert-dismissible fade show text-center`;
		alertDiv.setAttribute("role", "alert");
		alertDiv.innerHTML = `
	${message}
	<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;
		alertContainer.appendChild(alertDiv);

		if (__lastAlert.timeoutId) {
			clearTimeout(__lastAlert.timeoutId);
		}
		__lastAlert.timeoutId = setTimeout(() => {
			try {
				bootstrap.Alert.getOrCreateInstance(alertDiv).close();
			} catch (dismissError) {
				// no-op
			}
		}, 3000);
	} catch (error) {
		console.error("Failed to display alert message.", error);
	}
}

function showConfirmModal(body, callback) {
	try {
		const modalElement = document.getElementById("confirmModal");
		const confirmModalBody = document.getElementById("confirmModalBody");
		const confirmModalBtn = document.getElementById("confirmModalBtn");
		if (!modalElement || !confirmModalBody || !confirmModalBtn) {
			console.warn("Confirm modal elements are missing.");
			return;
		}
		const confirmModal = new bootstrap.Modal(modalElement);

		confirmModalBody.textContent = body;

		const newConfirmBtn = confirmModalBtn.cloneNode(true);
		confirmModalBtn.parentNode.replaceChild(newConfirmBtn, confirmModalBtn);

		newConfirmBtn.addEventListener("click", () => {
			try {
				if (typeof callback === "function") {
					callback();
				}
			} catch (error) {
				console.error("Error executing confirmation callback.", error);
			}
			confirmModal.hide();
		});

		confirmModal.show();
	} catch (error) {
		console.error("Failed to show confirmation modal.", error);
	}
}

function showPlayerPicker() {
	try {
		const playerList = document.getElementById("playerList");
		const modalElement = document.getElementById("playerModal");
		if (!playerList || !modalElement) {
			console.warn("Player picker modal elements are missing.");
			return;
		}
		const playerModal = new bootstrap.Modal(modalElement);
		playerList.innerHTML = "";

		const roster = loadRosterSet();
		// Gate: require at least one player checked in roster before allowing selection
		if (roster.size === 0) {
			showAlert("First mark players present on the Players tab (Roster for this Game).", "warning");
			return;
		}
		const eligibleIndexes = players.map((p, idx) => ({ p, idx })).filter(({ p }) => roster.has(p.id));

		eligibleIndexes.forEach(({ p: player, idx: index }) => {
			const isAlreadyOnCourt = courtPositions.includes(index);
			const playerButton = document.createElement("button");
			playerButton.className = "btn btn-outline-primary w-100 my-1";
			playerButton.textContent = `#${player.number} ${player.name}`;
			playerButton.disabled = isAlreadyOnCourt;

			playerButton.addEventListener("click", () => {
				const prevPlayerIndex = courtPositions[selectedSpot];
				if (prevPlayerIndex !== null) stopPlayerTimer(prevPlayerIndex);

				courtPositions[selectedSpot] = index;
				startPlayerTimer(index);

				try {
					localStorage.setItem(COURT_POSITIONS_KEY, JSON.stringify(courtPositions));
				} catch (error) {
					console.error("Failed to persist updated court positions.", error);
				}
				savePlaytimeToStorage();
				updateAllUI();
				playerModal.hide();
			});
			playerList.appendChild(playerButton);
		});
		playerModal.show();
	} catch (error) {
		console.error("Failed to show player picker modal.", error);
	}
}

// ===================== DOM Initialization ===================== //
document.addEventListener("DOMContentLoaded", () => {
	try {
			const initMatchDetails = () => {
				const inputs = document.querySelectorAll("#matchDate, #matchHomeAway, #matchType, #matchLocation, #opposingTeam");
				let savedDetailsRaw = null;
				try {
					savedDetailsRaw = localStorage.getItem("matchDetails");
				} catch (error) {
					console.error("Failed to read saved match details.", error);
				}
				if (savedDetailsRaw) {
					try {
						const matchDetails = JSON.parse(savedDetailsRaw);
						inputs.forEach((input) => {
							if (matchDetails[input.id]) input.value = matchDetails[input.id];
						});
					} catch (error) {
						console.error("Failed to parse saved match details.", error);
					}
				}
				inputs.forEach((input) =>
					input.addEventListener("blur", () => {
						const matchDetails = {};
						inputs.forEach((i) => (matchDetails[i.id] = i.value));
						try {
							localStorage.setItem("matchDetails", JSON.stringify(matchDetails));
						} catch (error) {
							console.error("Failed to persist match details.", error);
						}
					})
				);
			};
			initMatchDetails();

			// Ensure floating labels reflect programmatic values (e.g., date/select)
			const toggleFilledClass = (el) => {
				const hasValue = !!(el && el.value && String(el.value).trim().length > 0);
				if (hasValue) {
					el.classList.add("is-filled");
				} else {
					el.classList.remove("is-filled");
				}
			};
			const syncFloatingLabels = () => {
				document.querySelectorAll(".form-floating .form-control, .form-floating .form-select").forEach((el) => toggleFilledClass(el));
			};
			// Expose to window for cross-scope reset logic
			window.__syncFloatingLabels = syncFloatingLabels;
			// Run at startup and on interactions that can change value
			syncFloatingLabels();
			document.addEventListener("input", (e) => {
				if (e.target && (e.target.classList.contains("form-control") || e.target.classList.contains("form-select"))) {
					toggleFilledClass(e.target);
				}
			});
			document.addEventListener("change", (e) => {
				if (e.target && (e.target.classList.contains("form-control") || e.target.classList.contains("form-select"))) {
					toggleFilledClass(e.target);
				}
			});

			// Initialize score manager
			Score.init();

			// ===== Players Tab: Roster Management ===== //
			const rosterContainer = document.getElementById("rosterList");
			const addPlayerBtn = document.getElementById("addPlayerBtn");
			const newPlayerInput = document.getElementById("newPlayerName");

			function nextPlayerNumber() {
				const used = new Set(players.map((p) => Number(p.number)));
				let n = 1;
				while (used.has(n)) n++;
				return n;
			}

			function renderRoster() {
				if (!rosterContainer) return;
				const roster = loadRosterSet();
				rosterContainer.innerHTML = "";
				players.forEach((p, idx) => {
					const item = document.createElement("label");
					item.className = "list-group-item d-flex align-items-center gap-2";
					item.innerHTML = `
						<input class="form-check-input me-2 roster-check" type="checkbox" data-player-id="${p.id}" ${roster.has(p.id) ? "checked" : ""}>
						<span><strong>#${p.number}</strong> ${p.name}</span>
					`;
					rosterContainer.appendChild(item);
				});
				// wire checks
				rosterContainer.querySelectorAll(".roster-check").forEach((cb) => {
					cb.addEventListener("change", (e) => {
						const set = loadRosterSet();
						const id = e.target.dataset.playerId;
						if (e.target.checked) set.add(id);
						else set.delete(id);
						saveRosterSet(set);
						updateBenchList();
						updateOutTodayList();
					});
				});
			}
			// Expose to window so reset helper can trigger a re-render
			window.__renderRoster = renderRoster;

			function addNewPlayer(name) {
				const trimmed = (name || "").trim();
				if (!trimmed) return;
				const id = `pid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
				const player = { id, name: trimmed, number: nextPlayerNumber() };
				players.push(player);
				// ensure stats entry
				playerStats[players.length - 1] = { totalSeconds: 0, isOnCourt: false, lastStartTime: null, fouls: 0, points: 0 };
				savePlayers(players);
				renderRoster();
				updateAllUI();
				updateOutTodayList();
			}

			if (addPlayerBtn && newPlayerInput) {
				addPlayerBtn.addEventListener("click", () => {
					addNewPlayer(newPlayerInput.value);
					newPlayerInput.value = "";
				});
				newPlayerInput.addEventListener("keydown", (e) => {
					if (e.key === "Enter") {
						addNewPlayer(newPlayerInput.value);
						newPlayerInput.value = "";
					}
				});
			}

			renderRoster();

			document.getElementById("startGameBtn").addEventListener("click", () => {
				if (isGameRunning) return;
				if (courtPositions.filter((p) => p !== null).length < 6) {
					showAlert("Please select 6 players for the court before starting.", "warning");
					return;
				}
				startGameTimer(true);
				isGameRunning = true;
				try {
					localStorage.setItem(GAME_STATE_KEY, JSON.stringify(true));
				} catch (error) {
					console.error("Failed to persist game state flag.", error);
				}
				courtPositions.forEach(startPlayerTimer);
				showAlert("Game Started!", "success");
				document.getElementById("startGameBtn").disabled = true;
			});
			if (isGameRunning) document.getElementById("startGameBtn").disabled = true;

			document.getElementById("rotateBtn").addEventListener("click", rotateCourtClockwise);
			document.getElementById("resetScore").addEventListener("click", resetGame);

			const courtGridEl = document.getElementById("courtGrid");
			courtGridEl.addEventListener("click", (e) => {
				const actionBtn = e.target.closest(".court-action-btn");
				if (actionBtn) {
					const spot = parseInt(actionBtn.dataset.spot, 10);
					if (Number.isNaN(spot)) return;
					selectedSpot = spot;
					const playerIndex = courtPositions[spot];
					if (playerIndex === null || typeof playerIndex === "undefined") {
						showAlert("Assign a player to this spot before performing actions.", "warning");
						return;
					}
					const action = actionBtn.dataset.action;
					switch (action) {
						case "add-point":
							addPoint(playerIndex);
							break;
						case "remove-point":
							removePoint(playerIndex);
							break;
						case "add-foul":
							addFoul(playerIndex);
							break;
						case "sub-player":
							showPlayerPicker();
							break;
						default:
							break;
					}
					return;
				}

				const spotMain = e.target.closest(".court-spot-main");
				if (!spotMain) return;

				const spot = parseInt(spotMain.dataset.spot, 10);
				if (Number.isNaN(spot)) return;
				selectedSpot = spot;
				showPlayerPicker();
			});

			updateAllUI();
			setInterval(() => {
				if (isGameRunning) {
					updateAllUI();
				}
			}, 1000);
	} catch (error) {
		console.error("Failed to initialize the application.", error);
		showAlert("Failed to initialize the application. Please refresh.", "danger");
	}
});

if ("serviceWorker" in navigator) {
	try {
		navigator.serviceWorker
			.register("/service-worker.js")
			.then(() => console.log("Service Worker registered"))
			.catch((err) => console.error("Service Worker error:", err));
	} catch (error) {
		console.error("Service Worker registration failed.", error);
	}
}

})();
