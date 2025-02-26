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
  let playerData = {}; // holds total time (ms) each player held the tag
  let lastTaggedTimes = {}; // last update time for each player holding the tag
  let playerPoints = {}; // cumulative points per player
  let taggedDays = {}; // record of days each player was tagged (ISO date strings)
  let playerCatchCounts = {}; // how many times each player was caught
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

  /* 
    New time formatter:
    - If time is at least 1 hour, display "X hour(s) Y min(s)"
    - If less than one hour but at least one minute, display "Y min(s)"
    - If less than one minute, display "Z sec(s)"
  */
  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours} h${hours === 1 ? "" : "s"} ${minutes} m${minutes === 1 ? "" : "s"}`;
    } else if (minutes > 0) {
      return `${minutes} m${minutes === 1 ? "" : "s"}`;
    } else {
      return `${seconds} sec${seconds === 1 ? "" : "s"}`;
    }
  }

  // Parse TXT data into structured objects
  // Expected TXT format (same as CSV):
  // DEŇ,ČAS,MENO
  // 1.2.,0:00,Jakub Novak
  // 2.2.,20:49,Marek Simko
  // ...
  function parseData(text) {
    return text
      .trim()
      .split("\n")
      .slice(1)
      .map((row) => {
        const [date, time, player] = row.split(",").map((item) => item.trim());
        const currentYear = 2025;
        // Split date and remove any empty strings (in case of trailing dots)
        const [day, month] = date.split(".").filter(Boolean);
        // Split the time string into hours and minutes
        const [hourStr, minuteStr] = time.split(":");
        const hours = parseInt(hourStr, 10);
        const minutes = parseInt(minuteStr, 10);
        // Create the date with numeric parameters (month is zero-indexed)
        const timeTagged = new Date(currentYear, month - 1, day, hours, minutes);
        if (isNaN(timeTagged)) {
          console.error(`Invalid date for ${date} ${time}`);
          return null;
        }
        return { DATETIME: timeTagged, MENO: player };
      })
      .filter((entry) => entry !== null);
  }
  

  // Process a single tag transition from previousEntry to currentEntry
  function processTransition(previousEntry, currentEntry) {
    const previousPlayer = previousEntry.MENO;
    const newHolder = currentEntry.MENO;
    const timeDiff = currentEntry.DATETIME - previousEntry.DATETIME;

    // Update holding time for the previous player
    playerData[previousPlayer] += timeDiff;
    // Increment catch count for the previous player (they were caught)
    playerCatchCounts[previousPlayer]++;

    // Deduct penalty based on full hours held
    const hoursHeld = Math.floor(timeDiff / (1000 * 60 * 60));
    const penalty = hoursHeld * TIME_PENALTY_PER_HOUR;
    playerPoints[previousPlayer] -= penalty;

    // Award points to the new tag holder based on the ranking of the previous player's hold time
    const rankedLeaderboard = Object.entries(playerData).sort(
      ([, timeA], [, timeB]) => timeB - timeA
    );
    const taggedPlayerRank =
      rankedLeaderboard.findIndex(([player]) => player === previousPlayer) + 1;
    const pointsAwarded = TAG_AWARD_POINTS[taggedPlayerRank - 1] || 0;
    playerPoints[newHolder] += pointsAwarded;

    // Update tagged days for both players
    const previousTagDay = previousEntry.DATETIME.toISOString().split("T")[0];
    const currentTagDay = currentEntry.DATETIME.toISOString().split("T")[0];
    taggedDays[previousPlayer].add(previousTagDay);
    taggedDays[newHolder].add(currentTagDay);
  }

  // Award bonus points for untagged days based on specific rules
  function awardBonusForUntaggedDays(data) {
    const allDays = new Set(
      data.map((entry) => entry.DATETIME.toISOString().split("T")[0])
    );
    allDays.forEach((day) => {
      players.forEach((player) => {
        if (!taggedDays[player].has(day)) {
          const previousDay = new Date(day);
          previousDay.setDate(previousDay.getDate() - 1);
          const previousDayStr = previousDay.toISOString().split("T")[0];

          const nextDay = new Date(day);
          nextDay.setDate(nextDay.getDate() + 1);
          const nextDayStr = nextDay.toISOString().split("T")[0];

          // Award bonus if the player was not tagged on the previous or next day
          if (
            !taggedDays[player].has(previousDayStr) &&
            !taggedDays[player].has(nextDayStr)
          ) {
            playerPoints[player] += BONUS_UNTAGGED_DAY;
          }
        }
      });
    });
  }

  // Process all TXT data entries to update stats and points
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

  // Generate HTML for the leaderboard display including catch counts
  function generateLeaderboard() {
    const leaderboard = Object.entries(playerPoints)
      .sort(([, pointsA], [, pointsB]) => pointsB - pointsA)
      .map(([player, points]) => ({
        player,
        points,
        time: formatTime(playerData[player]),
        catches: playerCatchCounts[player]
      }));
    let lastPoints = null;
    let rank = 0;
    let displayRank = 0;
    return leaderboard
      .map((entry) => {
        if (entry.points !== lastPoints) {
          rank++;
          displayRank = rank;
        }
        lastPoints = entry.points;
        return `
          <div class="leaderboard-entry ${entry.player === lastCaughtPlayer ? "last-caught" : ""}">
            <span class="rank">${displayRank}.</span>
            <span class="player">${entry.player}</span>
            <span class="points">Points: ${entry.points}</span>
            <span class="time">Time: ${entry.time}</span>
            <span class="catches">Caught: ${entry.catches}</span>
          </div>
        `;
      })
      .join("");
  }

  // Calculate and generate the achievements HTML
  function calculateAchievements(data) {
    const achievements = [];
    // Worst Player (lowest points)
    const worstPlayer = Object.entries(playerPoints).sort(
      ([, pointsA], [, pointsB]) => pointsA - pointsB
    )[0];
    achievements.push(
      `<div>Worst Player: <span>${worstPlayer[0]}</span> with ${worstPlayer[1]} points</div>`
    );
    // Fastest Player (least time held)
    const fastestPlayer = Object.entries(playerData).sort(
      ([, timeA], [, timeB]) => timeA - timeB
    )[0];
    achievements.push(
      `<div>Fastest Player: <span>${fastestPlayer[0]}</span> with ${formatTime(fastestPlayer[1])}</div>`
    );
    // Slowest Player (most time held)
    const slowestPlayer = Object.entries(playerData).sort(
      ([, timeA], [, timeB]) => timeB - timeA
    )[0];
    achievements.push(
      `<div>Slowest Player: <span>${slowestPlayer[0]}</span> with ${formatTime(slowestPlayer[1])}</div>`
    );
    // Fastest Catch (shortest time between tags)
    let fastestCatch = Infinity;
    let fastestCatchDetails = "";
    for (let i = 1; i < data.length; i++) {
      const timeDiff = data[i].DATETIME - data[i - 1].DATETIME;
      if (timeDiff < fastestCatch) {
        fastestCatch = timeDiff;
        fastestCatchDetails = `${data[i].MENO} caught ${data[i - 1].MENO} in ${formatTime(timeDiff)}`;
      }
    }
    achievements.push(`<div>Fastest Catch: <span>${fastestCatchDetails}</span></div>`);
    // Slowest Catch (longest time between tags)
    let slowestCatch = 0;
    let slowestCatchDetails = "";
    for (let i = 1; i < data.length; i++) {
      const timeDiff = data[i].DATETIME - data[i - 1].DATETIME;
      if (timeDiff > slowestCatch) {
        slowestCatch = timeDiff;
        slowestCatchDetails = `${data[i - 1].MENO} caught ${data[i].MENO} in ${formatTime(timeDiff)}`;
      }
    }
    achievements.push(`<div>Slowest Catch: <span>${slowestCatchDetails}</span></div>`);
    // Last Caught Player
    if (lastCaughtPlayer) {
      achievements.push(`<div>Last Caught Player: <span>${lastCaughtPlayer}</span></div>`);
    }
    // Special achievements (example)
    achievements.push(`
      <div>
        Special achievements:
        <span>Marek Magula</span> caught naked <span>Jakub Novák</span><br>
        <span>Jakub Huščava</span> was caught by <span>Superman(Brečkis) &amp; Spiderman(Nováčik)</span><br>
        <span>Adam Šesták</span> for being absolute "hajzel" in the game
      </div>
    `);
    return achievements.join("");
  }

  // Countdown: update the countdown timer every second
  function updateCountdown() {
    const now = new Date();
    let diff = COUNTDOWN_TARGET - now;
    if (diff < 0) diff = 0;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    const countdownEl = document.getElementById("countdown");
    countdownEl.innerHTML = `
      <div class="countdown-wrapper">
        <span class="countdown-item">${days}<small>Days</small></span>
        <span class="countdown-item">${hours}<small>Hours</small></span>
        <span class="countdown-item">${minutes}<small>Minutes</small></span>
        <span class="countdown-item">${seconds}<small>Seconds</small></span>
      </div>
    `;
  }
  setInterval(updateCountdown, 1000);
  updateCountdown();

  // Main function: load TXT data and update leaderboard & achievements
  function main() {
    initializePlayerData();
    fetch("https://magula12.github.io/tag/tag.txt")
      .then((response) => response.text())
      .then((text) => {
        const data = parseData(text);
        processData(data);
        const leaderboardContainer = document.getElementById("leaderboard");
        leaderboardContainer.innerHTML = generateLeaderboard();
        const achievementsList = document.getElementById("achievements-list");
        achievementsList.innerHTML = calculateAchievements(data);
      })
      .catch((error) => console.error("Error loading the file:", error));

    // Automatically update the time for the last caught player every second
    setInterval(() => {
      const now = new Date();
      if (lastCaughtPlayer && lastTaggedTimes[lastCaughtPlayer]) {
        playerData[lastCaughtPlayer] += now - lastTaggedTimes[lastCaughtPlayer];
        lastTaggedTimes[lastCaughtPlayer] = now;
      }
      const leaderboardContainer = document.getElementById("leaderboard");
      leaderboardContainer.innerHTML = generateLeaderboard();
    }, UPDATE_INTERVAL_MS);
  }

  main();
});
