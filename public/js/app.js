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
];

const PLAYTIME_KEY = "volleyballPlaytimes";
const MAX_FOULS = 5;
let courtPositions = Array(6).fill(null);
let selectedSpot = null;

// MODIFIED: Added 'points: 0' to the player stats object.
let playerStats = players.reduce((acc, player, i) => {
	acc[i] = { totalSeconds: 0, isOnCourt: false, lastStartTime: null, fouls: 0, points: 0 };
	return acc;
}, {});

const savedStats = localStorage.getItem(PLAYTIME_KEY);
if (savedStats) {
	const parsedStats = JSON.parse(savedStats);
    players.forEach((player, i) => {
        // Safely merge, providing defaults for any missing properties
        playerStats[i] = {
            ...{ totalSeconds: 0, isOnCourt: false, lastStartTime: null, fouls: 0, points: 0 },
            ...(parsedStats[i] || {})
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
const savedCourt = localStorage.getItem(COURT_POSITIONS_KEY);
if (savedCourt) {
	courtPositions = JSON.parse(savedCourt);
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
	localStorage.setItem(PLAYTIME_KEY, JSON.stringify(playerStats));
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

// NEW: Function to add a point to a player and update the team score.
function addPoint(playerIndex) {
    if (!isGameRunning) {
		showAlert("You can only add points after the game has started.", "warning");
		return;
	}
    playerStats[playerIndex].points++;
    
    // Update the main score on the Score tab
    const homeAway = document.getElementById("matchHomeAway").value;
    const teamToScore = (homeAway === 'Home' || homeAway === 'Away') ? homeAway.toLowerCase() : 'home'; // Default to home if not set
    const scoreEl = document.getElementById(`score${teamToScore.charAt(0).toUpperCase() + teamToScore.slice(1)}Actual`);
    let currentScore = parseInt(scoreEl.textContent, 10);
    currentScore++;
    scoreEl.textContent = currentScore;
    
    // Save the main score
    const awayScore = teamToScore === 'home' ? document.getElementById("scoreAwayActual").textContent : scoreEl.textContent;
    const homeScore = teamToScore === 'away' ? document.getElementById("scoreHomeActual").textContent : scoreEl.textContent;
    localStorage.setItem("scoreTracking", JSON.stringify({ home: homeScore, away: awayScore }));

    savePlaytimeToStorage();
    updateAllUI();
    showAlert(`Point for ${players[playerIndex].name}!`, "success");
}

// ===================== UI Update Functions ===================== //

function updateAllUI() {
    updateCourtGrid();
    updatePlaytimeList();
    updateBenchList();
}

// MODIFIED: updateCourtGrid now displays points as well.
function updateCourtGrid() {
    const courtGrid = document.getElementById("courtGrid");
    if (!courtGrid) return;
    courtGrid.innerHTML = ""; // Clear the grid before redrawing

    for (let i = 0; i < 6; i++) {
        const playerIndex = courtPositions[i];
        const spotButton = document.createElement("button");
        spotButton.dataset.spot = i;
        spotButton.classList.add('court-spot', 'btn');

        if (playerIndex !== null) {
            const player = players[playerIndex];
            const stats = playerStats[playerIndex];
            spotButton.innerHTML = `
                <span>#${player.number} ${player.name}</span>
                <div>
                    <span class="point-count">Pts: ${stats.points}</span> | 
                    <span class="foul-count">Fouls: ${stats.fouls}</span>
                </div>
            `;
            spotButton.classList.add('btn-light');

            spotButton.classList.remove('fouls-warning', 'fouls-danger');
            if (stats.fouls >= MAX_FOULS) {
                spotButton.classList.add('fouls-danger');
            } else if (stats.fouls >= 3) {
                spotButton.classList.add('fouls-warning');
            }
        } else {
            spotButton.textContent = `Spot ${i + 1}`;
            spotButton.classList.add('btn-outline-secondary');
        }
        courtGrid.appendChild(spotButton);
    }
}


// MODIFIED: Player lists now show points.
function updatePlaytimeList() {
	const list = document.getElementById("playtimeList");
	if (!list) return;
	list.innerHTML = "";

    courtPositions.forEach(i => {
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

// MODIFIED: Player lists now show points.
function updateBenchList() {
	const benchList = document.getElementById("benchList");
	if (!benchList) return;
	benchList.innerHTML = "";

	players.forEach((player, i) => {
		if (!courtPositions.includes(i)) {
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

	localStorage.setItem(COURT_POSITIONS_KEY, JSON.stringify(courtPositions));
	updateAllUI();
	savePlaytimeToStorage();
    showAlert("Players Rotated!", "info");
}

// MODIFIED: Reset function now also clears player points.
function resetGame() {
    showConfirmModal("Are you sure you want to reset everything? This will clear all scores, play times, and fouls.", () => {
        courtPositions.forEach(playerIndex => stopPlayerTimer(playerIndex));

        let scores = { home: 0, away: 0 };
        localStorage.removeItem("scoreTracking");
        document.getElementById("scoreHomeActual").textContent = "0";
        document.getElementById("scoreAwayActual").textContent = "0";
        document.getElementById("homeScore").value = "";
        document.getElementById("awayScore").value = "";

        isGameRunning = false;
        localStorage.removeItem(GAME_STATE_KEY);
        document.getElementById("startGameBtn").disabled = false;

        courtPositions = Array(6).fill(null);
        localStorage.removeItem(COURT_POSITIONS_KEY);
        // Reset all player stats including points
        players.forEach((_, i) => (playerStats[i] = { totalSeconds: 0, isOnCourt: false, lastStartTime: null, fouls: 0, points: 0 }));
        localStorage.removeItem(PLAYTIME_KEY);

        updateAllUI();
        showAlert("Game has been reset!", "warning");
    });
}


// ===================== Modals and Alerts ===================== //
function showAlert(message, type) {
	const alertContainer = document.getElementById("alertContainer");
	const alertDiv = document.createElement("div");
	alertDiv.className = `alert alert-${type} alert-dismissible fade show text-center`;
	alertDiv.setAttribute("role", "alert");
	alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;
	alertContainer.appendChild(alertDiv);
	setTimeout(() => bootstrap.Alert.getOrCreateInstance(alertDiv).close(), 3000);
}

function showConfirmModal(body, callback) {
    const confirmModalBody = document.getElementById('confirmModalBody');
    const confirmModalBtn = document.getElementById('confirmModalBtn');
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));

    confirmModalBody.textContent = body;

    const newConfirmBtn = confirmModalBtn.cloneNode(true);
    confirmModalBtn.parentNode.replaceChild(newConfirmBtn, confirmModalBtn);

    newConfirmBtn.addEventListener('click', () => {
        callback();
        confirmModal.hide();
    });

    confirmModal.show();
}

function showPlayerPicker() {
    const playerList = document.getElementById("playerList");
    const playerModal = new bootstrap.Modal(document.getElementById("playerModal"));
    playerList.innerHTML = "";

    players.forEach((player, index) => {
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

            localStorage.setItem(COURT_POSITIONS_KEY, JSON.stringify(courtPositions));
            savePlaytimeToStorage();
            updateAllUI();
            playerModal.hide();
        });
        playerList.appendChild(playerButton);
    });
    playerModal.show();
}

// MODIFIED: Court action modal now handles the "Add Point" button.
function showCourtActionModal() {
    const playerIndex = courtPositions[selectedSpot];
    const player = players[playerIndex];
    const modal = new bootstrap.Modal(document.getElementById("courtActionModal"));
    document.getElementById("courtActionModalLabel").textContent = `Action for ${player.name}`;

    const addPointBtn = document.getElementById('modalAddPointBtn');
    const addFoulBtn = document.getElementById('modalAddFoulBtn');
    const subPlayerBtn = document.getElementById('modalSubPlayerBtn');

    addPointBtn.onclick = () => {
        addPoint(playerIndex);
        modal.hide();
    };

    addFoulBtn.onclick = () => {
        addFoul(playerIndex);
        modal.hide();
    };

    subPlayerBtn.onclick = () => {
        modal.hide();
        setTimeout(showPlayerPicker, 200);
    };

    modal.show();
}


// ===================== DOM Initialization ===================== //
document.addEventListener("DOMContentLoaded", () => {
    const initMatchDetails = () => {
		const inputs = document.querySelectorAll("#matchID, #matchDate, #matchHomeAway, #matchType, #matchLocation, #opposingTeam");
		const savedDetails = localStorage.getItem("matchDetails");
		if (savedDetails) {
			const matchDetails = JSON.parse(savedDetails);
			inputs.forEach((input) => {
				if (matchDetails[input.id]) input.value = matchDetails[input.id];
			});
		}
		inputs.forEach((input) => input.addEventListener("blur", () => {
            const matchDetails = {};
            inputs.forEach(i => matchDetails[i.id] = i.value);
            localStorage.setItem("matchDetails", JSON.stringify(matchDetails));
        }));
	};
	initMatchDetails();

    (() => {
        const STORAGE_KEY = "scoreTracking";
        let scores = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { home: 0, away: 0 };
        const scoreHomeEl = document.getElementById("scoreHomeActual");
        const scoreAwayEl = document.getElementById("scoreAwayActual");
        const updateScoreUI = () => {
            scoreHomeEl.textContent = scores.home;
            scoreAwayEl.textContent = scores.away;
        };
        document.querySelectorAll(".score-arrow.up").forEach(btn => btn.addEventListener('click', e => { scores[e.target.dataset.team]++; localStorage.setItem(STORAGE_KEY, JSON.stringify(scores)); updateScoreUI(); }));
        document.querySelectorAll(".score-arrow.down").forEach(btn => btn.addEventListener('click', e => { if (scores[e.target.dataset.team] > 0) { scores[e.target.dataset.team]--; localStorage.setItem(STORAGE_KEY, JSON.stringify(scores)); updateScoreUI();} }));
        document.getElementById("finalScore").addEventListener('click', () => { document.getElementById("homeScore").value = scores.home; document.getElementById("awayScore").value = scores.away; showAlert("Final Score Saved!", "success");});
        updateScoreUI();
    })();

	document.getElementById("startGameBtn").addEventListener("click", () => {
        if (isGameRunning) return;
        if (courtPositions.filter(p => p !== null).length < 6) {
            showAlert("Please select 6 players for the court before starting.", "warning");
            return;
        }
		isGameRunning = true;
		localStorage.setItem(GAME_STATE_KEY, JSON.stringify(true));
		courtPositions.forEach(startPlayerTimer);
		showAlert("Game Started!", "success");
		document.getElementById("startGameBtn").disabled = true;
	});
    if(isGameRunning) document.getElementById("startGameBtn").disabled = true;

	document.getElementById("rotateBtn").addEventListener("click", rotateCourtClockwise);
	document.getElementById("resetScore").addEventListener("click", resetGame);

    document.getElementById("courtGrid").addEventListener("click", (e) => {
        const spotButton = e.target.closest('.court-spot');
        if (!spotButton) return;

        selectedSpot = parseInt(spotButton.dataset.spot);
        const playerIndex = courtPositions[selectedSpot];

        if (playerIndex !== null) {
            showCourtActionModal();
        } else {
            showPlayerPicker();
        }
    });

	updateAllUI();
	setInterval(() => {
		if (isGameRunning) {
			updateAllUI();
		}
	}, 1000);
});

if ("serviceWorker" in navigator) {
	navigator.serviceWorker
		.register("/service-worker.js")
		.then(() => console.log("✅ Service Worker registered"))
		.catch((err) => console.error("❌ Service Worker error:", err));
}