window.addEventListener("load", function () {
  // Constants for points and time rules
  const TAG_AWARD_POINTS = [50, 40, 30, 20, 10, 5];
  const TIME_PENALTY_PER_HOUR = 5; // points deducted per full hour held
  const BONUS_UNTAGGED_DAY = 35; // bonus points for being untagged on isolated days
  const UPDATE_INTERVAL_MS = 1000;

  const players = [
    "Tomas Magula", "Marek Magula", "Jakub Novak", "Marek Simko", "Jan Brecka",
    "Adam Sestak", "Janik Mokry", "Beno Drabek", "Pavol Nagy", "Marek Kossey",
    "Jakub Huscava", "Niko Matejov", "Radek Ciernik"
  ];

  // Data storage objects
  let playerData = {};      // holds total time (ms) each player held the tag
  let lastTaggedTimes = {}; // last update time for each player holding the tag
  let playerPoints = {};    // cumulative points per player
  let taggedDays = {};      // record of days each player was tagged (ISO date strings)
  let lastCaughtPlayer = null;

  // Initialize player data
  function initializePlayerData() {
    players.forEach(function (player) {
      playerData[player] = 0;
      playerPoints[player] = 0;
      lastTaggedTimes[player] = 0;
      taggedDays[player] = new Set();
    });
  }

  // Format time in HH:MM:SS
  function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;
    return `${pad(hours)}:${pad(remainingMinutes)}:${pad(remainingSeconds)}`;
  }

  // Pad single-digit numbers with a leading zero
  function pad(num) {
    return num < 10 ? "0" + num : num;
  }

  // Parse TXT data (same comma-separated format)
  function parseCSVData(text) {
    return text
      .trim()
      .split("\n")
      .slice(1) // skip header
      .map(function (row) {
        const parts = row.split(",").map(function (item) {
          return item.trim();
        });
        const [date, time, player] = parts;
        const currentYear = 2025;
        // Split the date and remove empty strings (handles "1.2." properly)
        const dateParts = date.split(".").filter(Boolean);
        const day = dateParts[0];
        const month = dateParts[1];
        // Create an ISO formatted string (YYYY-MM-DDTHH:MM) for compatibility
        const isoDateString = `${currentYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${time}`;
        const timeTagged = new Date(isoDateString);

        if (isNaN(timeTagged)) {
          console.error("Invalid date and time: " + isoDateString);
          return null;
        }

        return { DATETIME: timeTagged, MENO: player };
      })
      .filter(function (entry) {
        return entry !== null;
      });
  }

  // Process a single tag transition from previousEntry to currentEntry
  function processTransition(previousEntry, currentEntry) {
    const previousPlayer = previousEntry.MENO;
    const newHolder = currentEntry.MENO;
    const timeDiff = currentEntry.DATETIME - previousEntry.DATETIME;

    // Update holding time for the previous player
    playerData[previousPlayer] += timeDiff;

    // Deduct penalty based on hours held
    const hoursHeld = Math.floor(timeDiff / (1000 * 60 * 60));
    const penalty = hoursHeld * TIME_PENALTY_PER_HOUR;
    playerPoints[previousPlayer] -= penalty;

    // Award points to the new tag holder based on current ranking
    const rankedLeaderboard = Object.entries(playerData).sort(function (a, b) {
      return b[1] - a[1];
    });
    const taggedPlayerRank =
      rankedLeaderboard.findIndex(function (item) {
        return item[0] === previousPlayer;
      }) + 1;
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
      data.map(function (entry) {
        return entry.DATETIME.toISOString().split("T")[0];
      })
    );
    allDays.forEach(function (day) {
      players.forEach(function (player) {
        if (!taggedDays[player].has(day)) {
          const previousDay = new Date(day);
          previousDay.setDate(previousDay.getDate() - 1);
          const previousDayStr = previousDay.toISOString().split("T")[0];

          const nextDay = new Date(day);
          nextDay.setDate(nextDay.getDate() + 1);
          const nextDayStr = nextDay.toISOString().split("T")[0];

          // Award bonus if the player was not tagged on the previous or next day
          if (!taggedDays[player].has(previousDayStr) && !taggedDays[player].has(nextDayStr)) {
            playerPoints[player] += BONUS_UNTAGGED_DAY;
          }
        }
      });
    });
  }

  // Process all TXT data entries to update stats and points
  function processData(data) {
    data.sort(function (a, b) {
      return a.DATETIME - b.DATETIME;
    });

    var lastEntry = data[0];
    lastTaggedTimes[lastEntry.MENO] = lastEntry.DATETIME;
    lastCaughtPlayer = lastEntry.MENO;

    for (var i = 1; i < data.length; i++) {
      processTransition(lastEntry, data[i]);
      lastEntry = data[i];
      lastTaggedTimes[lastEntry.MENO] = lastEntry.DATETIME;
      lastCaughtPlayer = lastEntry.MENO;
    }

    awardBonusForUntaggedDays(data);
  }

  // Generate HTML for the leaderboard display
  function generateLeaderboard() {
    const leaderboard = Object.entries(playerPoints)
      .sort(function (a, b) {
        return b[1] - a[1];
      })
      .map(function (item) {
        return {
          player: item[0],
          points: item[1],
          time: formatTime(playerData[item[0]])
        };
      });

    var lastPoints = null;
    var rank = 0;
    var displayRank = 0;

    return leaderboard
      .map(function (entry, index) {
        if (entry.points !== lastPoints) {
          rank++;
          displayRank = rank;
        }
        lastPoints = entry.points;

        return (
          '<div class="leaderboard-entry ' +
          (entry.player === lastCaughtPlayer ? "last-caught" : "") +
          '">' +
          "<span>" + displayRank + ".</span>" +
          "<span>" + entry.player + "</span>" +
          "<span>Points: " + entry.points + "</span>" +
          "<span>Time: " + entry.time + "</span>" +
          "</div>"
        );
      })
      .join("");
  }

  // Calculate and generate the achievements HTML
  function calculateAchievements(data) {
    var achievements = [];

    // Worst Player (lowest points)
    var worstPlayer = Object.entries(playerPoints).sort(function (a, b) {
      return a[1] - b[1];
    })[0];
    achievements.push(
      '<div>Worst Player: <span>' +
        worstPlayer[0] +
        '</span> with ' +
        worstPlayer[1] +
        " points</div>"
    );

    // Fastest Player (least time held)
    var fastestPlayer = Object.entries(playerData).sort(function (a, b) {
      return a[1] - b[1];
    })[0];
    achievements.push(
      '<div>Fastest Player: <span>' +
        fastestPlayer[0] +
        '</span> with ' +
        formatTime(fastestPlayer[1]) +
        "</div>"
    );

    // Slowest Player (most time held)
    var slowestPlayer = Object.entries(playerData).sort(function (a, b) {
      return b[1] - a[1];
    })[0];
    achievements.push(
      '<div>Slowest Player: <span>' +
        slowestPlayer[0] +
        '</span> with ' +
        formatTime(slowestPlayer[1]) +
        "</div>"
    );

    // Fastest Catch (shortest time between tags)
    var fastestCatch = Infinity;
    var fastestCatchDetails = "";
    for (var i = 1; i < data.length; i++) {
      var timeDiff = data[i].DATETIME - data[i - 1].DATETIME;
      if (timeDiff < fastestCatch) {
        fastestCatch = timeDiff;
        fastestCatchDetails =
          data[i].MENO +
          " caught " +
          data[i - 1].MENO +
          " in " +
          formatTime(timeDiff);
      }
    }
    achievements.push(
      '<div>Fastest Catch: <span>' + fastestCatchDetails + "</span></div>"
    );

    // Slowest Catch (longest time between tags)
    var slowestCatch = 0;
    var slowestCatchDetails = "";
    for (i = 1; i < data.length; i++) {
      timeDiff = data[i].DATETIME - data[i - 1].DATETIME;
      if (timeDiff > slowestCatch) {
        slowestCatch = timeDiff;
        slowestCatchDetails =
          data[i - 1].MENO +
          " caught " +
          data[i].MENO +
          " in " +
          formatTime(timeDiff);
      }
    }
    achievements.push(
      '<div>Slowest Catch: <span>' + slowestCatchDetails + "</span></div>"
    );

    // Last Caught Player
    if (lastCaughtPlayer) {
      achievements.push(
        '<div>Last Caught Player: <span>' +
          lastCaughtPlayer +
          "</span></div>"
      );
    }

    // Special achievement example
    achievements.push(
      '<div>Special achievements: <span>Marek Magula</span> caught naked <span>Jakub Novák</span></div>'
    );

    return achievements.join("");
  }

  // Helper to load TXT data with a fallback for older iOS browsers
  function getCSVData(url, callback) {
    if (window.fetch) {
      fetch(url)
        .then(function (response) {
          return response.text();
        })
        .then(function (text) {
          callback(null, text);
        })
        .catch(function (err) {
          callback(err, null);
        });
    } else {
      // Fallback for browsers that do not support fetch
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            callback(null, xhr.responseText);
          } else {
            callback(new Error("Failed to load TXT data"), null);
          }
        }
      };
      xhr.send();
    }
  }

  // Main function to load TXT data and update the leaderboard and achievements
  function main() {
    initializePlayerData();

    // Change the file URL to point to your .txt file
    getCSVData("https://magula12.github.io/tag/tag.txt", function (err, text) {
      if (err) {
        console.error("Error loading the file:", err);
        return;
      }
      var data = parseCSVData(text);
      processData(data);

      var leaderboardContainer = document.getElementById("leaderboard");
      leaderboardContainer.innerHTML = generateLeaderboard();

      var achievementsList = document.getElementById("achievements-list");
      achievementsList.innerHTML = calculateAchievements(data);
    });

    // Automatically update the time for the last caught player every second
    setInterval(function () {
      var now = new Date();
      if (lastCaughtPlayer && lastTaggedTimes[lastCaughtPlayer]) {
        playerData[lastCaughtPlayer] += now - lastTaggedTimes[lastCaughtPlayer];
        lastTaggedTimes[lastCaughtPlayer] = now;
      }
      var leaderboardContainer = document.getElementById("leaderboard");
      leaderboardContainer.innerHTML = generateLeaderboard();
    }, UPDATE_INTERVAL_MS);
  }

  // Run the main function
  main();
});
