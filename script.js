document.addEventListener("DOMContentLoaded", () => {
  const TAG_AWARD_POINTS = [50, 40, 30, 20, 10, 5];
  const TIME_PENALTY_PER_HOUR = 5;
  const BONUS_UNTAGGED_DAY = 35;
  const UPDATE_INTERVAL_MS = 1000;

  const players = [
    "Tomas Magula", "Marek Magula", "Jakub Novak", "Marek Simko", "Jan Brecka",
    "Adam Sestak", "Janik Mokry", "Beno Drabek", "Pavol Nagy", "Marek Kossey",
    "Jakub Huscava", "Niko Matejov", "Radek Ciernik"
  ];

  let playerData = {};
  let lastTaggedTimes = {};
  let playerPoints = {};
  let taggedDays = {};
  let lastCaughtPlayer = null;

  function initializePlayerData() {
    players.forEach(player => {
      playerData[player] = 0;
      playerPoints[player] = 0;
      lastTaggedTimes[player] = 0;
      taggedDays[player] = new Set();
    });
  }

  function formatTime(ms) {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / (1000 * 60)) % 60;
    const hours = Math.floor(ms / (1000 * 60 * 60));

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  function pad(num) {
    return num < 10 ? `0${num}` : num;
  }

  function parseCSVData(text) {
    return text.trim().split("\n").slice(1).map(row => {
      const [date, time, player] = row.split(",").map(item => item.trim());
      const currentYear = 2025;
      const [day, month] = date.split(".");
      const formattedDateString = `${month}-${day}-${currentYear} ${time}`;
      const timeTagged = new Date(formattedDateString);

      if (isNaN(timeTagged)) {
        console.error(`Invalid date and time: ${formattedDateString}`);
        return null;
      }

      return { DATETIME: timeTagged, MENO: player };
    }).filter(entry => entry !== null);
  }

  function processTransition(previousEntry, currentEntry) {
    const previousPlayer = previousEntry.MENO;
    const newHolder = currentEntry.MENO;
    const timeDiff = currentEntry.DATETIME - previousEntry.DATETIME;

    playerData[previousPlayer] += timeDiff;
    const hoursHeld = Math.floor(timeDiff / (1000 * 60 * 60));
    playerPoints[previousPlayer] -= hoursHeld * TIME_PENALTY_PER_HOUR;

    const rankedLeaderboard = Object.entries(playerData).sort((a, b) => b[1] - a[1]);
    const taggedPlayerRank = rankedLeaderboard.findIndex(([player]) => player === previousPlayer) + 1;
    playerPoints[newHolder] += TAG_AWARD_POINTS[taggedPlayerRank - 1] || 0;

    taggedDays[previousPlayer].add(previousEntry.DATETIME.toISOString().split("T")[0]);
    taggedDays[newHolder].add(currentEntry.DATETIME.toISOString().split("T")[0]);
  }

  function awardBonusForUntaggedDays(data) {
    const allDays = new Set(data.map(entry => entry.DATETIME.toISOString().split("T")[0]));
    allDays.forEach(day => {
      players.forEach(player => {
        if (!taggedDays[player].has(day)) {
          playerPoints[player] += BONUS_UNTAGGED_DAY;
        }
      });
    });
  }

  function processData(data) {
    data.sort((a, b) => a.DATETIME - b.DATETIME);

    let lastEntry = data[0];
    lastTaggedTimes[lastEntry.MENO] = lastEntry.DATETIME;
    lastCaughtPlayer = lastEntry.MENO;

    for (let i = 1; i < data.length; i++) {
      processTransition(lastEntry, data[i]);
      lastEntry = data[i];
      lastTaggedTimes[lastEntry.MENO] = lastEntry.DATETIME;
      lastCaughtPlayer = lastEntry.MENO;
    }

    awardBonusForUntaggedDays(data);
  }

  function updateLeaderboard() {
    const leaderboardContainer = document.getElementById("leaderboard");

    if (!leaderboardContainer) return;

    const sortedLeaderboard = Object.entries(playerPoints)
      .sort((a, b) => b[1] - a[1]);

    sortedLeaderboard.forEach(([player, points], index) => {
      const timeHeld = formatTime(playerData[player]);
      let row = document.getElementById(`leaderboard-${player}`);

      if (!row) {
        // 🆕 Create row only if it does not exist
        row = document.createElement("div");
        row.id = `leaderboard-${player}`;
        row.className = "leaderboard-entry";
        row.innerHTML = `
          <span class="rank">${index + 1}.</span>
          <span class="player-name">${player}</span>
          <span class="points">Points: <span class="points-value">${points}</span></span>
          <span class="time">Time: <span class="time-value">${timeHeld}</span></span>
        `;
        leaderboardContainer.appendChild(row);
      } else {
        // ✏️ Update existing row instead of replacing it
        row.querySelector(".rank").textContent = `${index + 1}.`;
        row.querySelector(".points-value").textContent = points;
        row.querySelector(".time-value").textContent = timeHeld;
      }

      if (player === lastCaughtPlayer) {
        row.classList.add("last-caught");
      } else {
        row.classList.remove("last-caught");
      }
    });
  }

  function getCSVData(url, callback) {
    fetch(url)
      .then(response => response.text())
      .then(text => callback(null, text))
      .catch(err => callback(err, null));
  }

  function main() {
    initializePlayerData();

    getCSVData("https://magula12.github.io/tag/tag.csv", (err, text) => {
      if (err) {
        console.error("Error loading CSV:", err);
        return;
      }

      const data = parseCSVData(text);
      if (data.length === 0) {
        console.error("No valid data parsed.");
        return;
      }

      processData(data);
      updateLeaderboard();
    });

    setInterval(() => {
      const now = new Date();
      if (lastCaughtPlayer && lastTaggedTimes[lastCaughtPlayer]) {
        playerData[lastCaughtPlayer] += now - lastTaggedTimes[lastCaughtPlayer];
        lastTaggedTimes[lastCaughtPlayer] = now;
      }
      updateLeaderboard();
    }, UPDATE_INTERVAL_MS);
  }

  main();
});