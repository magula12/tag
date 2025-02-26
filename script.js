document.addEventListener("DOMContentLoaded", () => {
  // Constants for points and time rules
  const TAG_AWARD_POINTS = [50, 40, 30, 20, 10, 5];
  const TIME_PENALTY_PER_HOUR = 5; // points deducted per full hour held
  const BONUS_UNTAGGED_DAY = 35; // bonus points for being untagged on isolated days
  const UPDATE_INTERVAL_MS = 1000;
  // Countdown target (preset to February 28, 2025). Edit this constant as needed.
  const COUNTDOWN_TARGET = new Date("2025-02-28T23:59:59");

  const players = [
    "Tomas Magula",
    "Marek Magula",
    "Jakub Novak",
    "Marek Simko",
    "Jan Brecka",
    "Adam Sestak",
    "Janik Mokry",
    "Beno Drabek",
    "Pavol Nagy",
    "Marek Kossey",
    "Jakub Huscava",
    "Niko Matejov",
    "Radek Ciernik"
  ];

  // Data storage objects
  let playerData = {};
  let lastTaggedTimes = {};
  let playerPoints = {};
  let taggedDays = {};
  let playerCatchCounts = {};
  let lastCaughtPlayer = null;

  // Initialize player data
  function initializePlayerData() {
    players.forEach((player) => {
      playerData[player] = 0;
      playerPoints[player] = 0;
      lastTaggedTimes[player] = 0;
      taggedDays[player] = new Set();
      playerCatchCounts[player] = 0;
    });
  }

  // Format time for display
  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return ${hours} h ${minutes} m;
    if (minutes > 0) return ${minutes} m;
    return ${seconds} sec;
  }

  // Parse TXT data
  function parseData(text) {
    return text
      .trim()
      .split("\n")
      .slice(1)
      .map((row) => {
        const [date, time, player] = row.split(",").map((item) => item.trim());
        const currentYear = 2025;
        const [day, month] = date.split(".").filter(Boolean);
        const [hours, minutes] = time.split(":").map(Number);
        const timeTagged = new Date(currentYear, month - 1, day, hours, minutes);

        if (isNaN(timeTagged)) {
          console.error(Invalid date for ${date} ${time});
          return null;
        }
        return { DATETIME: timeTagged, MENO: player };
      })
      .filter((entry) => entry !== null);
  }

  // Process tag transitions
  function processTransition(previousEntry, currentEntry) {
    const previousPlayer = previousEntry.MENO;
    const newHolder = currentEntry.MENO;
    const timeDiff = currentEntry.DATETIME - previousEntry.DATETIME;

    playerData[previousPlayer] += timeDiff;
    playerCatchCounts[previousPlayer]++;

    const hoursHeld = Math.floor(timeDiff / (1000 * 60 * 60));
    playerPoints[previousPlayer] -= hoursHeld * TIME_PENALTY_PER_HOUR;

    const rankedLeaderboard = Object.entries(playerData).sort(([, timeA], [, timeB]) => timeB - timeA);
    const taggedPlayerRank = rankedLeaderboard.findIndex(([player]) => player === previousPlayer) + 1;
    playerPoints[newHolder] += TAG_AWARD_POINTS[taggedPlayerRank - 1] || 0;

    taggedDays[previousPlayer].add(previousEntry.DATETIME.toISOString().split("T")[0]);
    taggedDays[newHolder].add(currentEntry.DATETIME.toISOString().split("T")[0]);
  }

  // Award untagged day bonus
  function awardBonusForUntaggedDays(data) {
    const allDays = new Set(data.map((entry) => entry.DATETIME.toISOString().split("T")[0]));
    allDays.forEach((day) => {
      players.forEach((player) => {
        if (!taggedDays[player].has(day)) {
          const previousDay = new Date(day);
          previousDay.setDate(previousDay.getDate() - 1);
          const nextDay = new Date(day);
          nextDay.setDate(nextDay.getDate() + 1);

          if (!taggedDays[player].has(previousDay.toISOString().split("T")[0]) &&
              !taggedDays[player].has(nextDay.toISOString().split("T")[0])) {
            playerPoints[player] += BONUS_UNTAGGED_DAY;
          }
        }
      });
    });
  }

  // Process all tag data
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

  // Generate rules section
  function generateRules() {
    return 
      <div class="rules">
        <h3>Rules for Point Calculation</h3>
        <ul>
          <li><b>Tagging Points:</b> Players gain points based on the previous holder's ranking:</li>
          <ul>
            <li>1st place: +50 points</li>
            <li>2nd place: +40 points</li>
            <li>3rd place: +30 points</li>
            <li>4th place: +20 points</li>
            <li>5th place: +10 points</li>
            <li>6th and below: +5 points</li>
          </ul>
          <li><b>Holding Time Penalty:</b> -5 points per full hour held.</li>
          <li><b>Untagged Bonus:</b> +35 points if not tagged for an isolated day.</li>
        </ul>
      </div>
    ;
  }

  // Countdown timer
  function updateCountdown() {
    const now = new Date();
    let diff = COUNTDOWN_TARGET - now;
    if (diff < 0) diff = 0;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    document.getElementById("countdown").innerHTML = 
      <div class="countdown-wrapper">
        <span class="countdown-item">${days}<small>Days</small></span>
        <span class="countdown-item">${hours}<small>Hours</small></span>
        <span class="countdown-item">${minutes}<small>Minutes</small></span>
        <span class="countdown-item">${seconds}<small>Seconds</small></span>
      </div>
    ;
  }

  setInterval(updateCountdown, 1000);
  updateCountdown();

  // Main function
  function main() {
    initializePlayerData();
    fetch("https://magula12.github.io/tag/tag.txt")
      .then((response) => response.text())
      .then((text) => {
        const data = parseData(text);
        processData(data);
        document.getElementById("rules").innerHTML = generateRules();
      })
      .catch((error) => console.error("Error loading the file:", error));
  }

  main();
}); 
