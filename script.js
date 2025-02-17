document.addEventListener("DOMContentLoaded", () => {
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

    // Initialize player data
    function initializePlayerData() {
        players.forEach(player => {
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

    // Pad single-digit numbers with leading zero
    function pad(num) {
        return num < 10 ? `0${num}` : num;
    }

    // Parse CSV data into structured format
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

    // Process data to calculate player stats
    function processData(data) {
        data.sort((a, b) => a.DATETIME - b.DATETIME);

        let lastTag = data[0].DATETIME;
        let lastPlayer = data[0].MENO;

        data.forEach((entry, index) => {
            const newHolder = entry.MENO;
            const timeTagged = entry.DATETIME;

            if (index > 0) {
                const timeDiff = timeTagged - lastTag;
                playerData[lastPlayer] += timeDiff;

                const hoursHeld = Math.floor(timeDiff / (1000 * 60 * 60));
                const penalty = hoursHeld * 5;
                playerPoints[lastPlayer] -= penalty;

                const rankedLeaderboard = Object.entries(playerData)
                    .sort(([, timeA], [, timeB]) => timeB - timeA);

                const taggedPlayerRank = rankedLeaderboard.findIndex(([player]) => player === lastPlayer) + 1;
                const pointsAwarded = [50, 40, 30, 20, 10, 5][taggedPlayerRank - 1] || 0;
                playerPoints[newHolder] += pointsAwarded;

                const lastTagDay = lastTag.toISOString().split("T")[0];
                const currentTagDay = timeTagged.toISOString().split("T")[0];

                taggedDays[lastPlayer].add(lastTagDay);
                taggedDays[newHolder].add(currentTagDay);
            }

            lastPlayer = newHolder;
            lastTag = timeTagged;
            lastTaggedTimes[lastPlayer] = timeTagged;
            lastCaughtPlayer = lastPlayer;
        });

        // Award points for consecutive untagged days
        const allDays = new Set(data.map(entry => entry.DATETIME.toISOString().split("T")[0]));
        allDays.forEach(day => {
            players.forEach(player => {
                if (!taggedDays[player].has(day)) {
                    const previousDay = new Date(day);
                    previousDay.setDate(previousDay.getDate() - 1);
                    const previousDayStr = previousDay.toISOString().split("T")[0];

                    const nextDay = new Date(day);
                    nextDay.setDate(nextDay.getDate() + 1);
                    const nextDayStr = nextDay.toISOString().split("T")[0];

                    if (!taggedDays[player].has(previousDayStr) && !taggedDays[player].has(nextDayStr)) {
                        playerPoints[player] += 35;
                    }
                }
            });
        });
    }

    // Generate leaderboard HTML
    function generateLeaderboard() {
        const leaderboard = Object.entries(playerPoints)
            .sort(([, pointsA], [, pointsB]) => pointsB - pointsA)
            .map(([player, points]) => ({
                player,
                points: points,
                time: formatTime(playerData[player])
            }));

        let lastPoints = null;
        let rank = 0;
        let displayRank = 0;

        return leaderboard.map((entry, index) => {
            if (entry.points !== lastPoints) {
                rank++;
                displayRank = rank;
            }
            lastPoints = entry.points;

            return `
                <div class="leaderboard-entry ${entry.player === lastCaughtPlayer ? 'last-caught' : ''}" style="top: ${index * 30}px;">
                    <span>${displayRank}.</span>
                    <span>${entry.player}</span>
                    <span>Points: ${entry.points}</span>
                    <span>Time: ${entry.time}</span>
                </div>
            `;
        }).join("");
    }

    // Calculate achievements
    function calculateAchievements(data) {
        const achievements = [];

        // Worst Player (lowest points)
        const worstPlayer = Object.entries(playerPoints).sort(([, pointsA], [, pointsB]) => pointsA - pointsB)[0];
        achievements.push(`<div>Worst Player: <span>${worstPlayer[0]}</span> with ${worstPlayer[1]} points</div>`);

        // Fastest Player (least time held)
        const fastestPlayer = Object.entries(playerData).sort(([, timeA], [, timeB]) => timeA - timeB)[0];
        achievements.push(`<div>Fastest Player: <span>${fastestPlayer[0]}</span> with ${formatTime(fastestPlayer[1])}</div>`);

        // Slowest Player (most time held)
        const slowestPlayer = Object.entries(playerData).sort(([, timeA], [, timeB]) => timeB - timeA)[0];
        achievements.push(`<div>Slowest Player: <span>${slowestPlayer[0]}</span> with ${formatTime(slowestPlayer[1])}</div>`);

        // Fastest Catch (shortest time between tags)
        let fastestCatch = Infinity;
        let fastestCatchDetails = "";
        for (let i = 1; i < data.length; i++) {
            const timeDiff = data[i].DATETIME - data[i - 1].DATETIME;
            if (timeDiff < fastestCatch) {
                fastestCatch = timeDiff;
                fastestCatchDetails = `${data[i].MENO} caught ${data[i-1].MENO} in ${formatTime(timeDiff)}`;
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

        achievements.push(`<div>Special achievements: <span>Marek Magula</span> caught naked<span>Jakub Novák</span></div>`);

        return achievements.join("");
    }

    // Main function to load and process data
    function main() {
        initializePlayerData();

        fetch("https://magula12.github.io/tag/tag.csv")
            .then(response => response.text())
            .then(text => {
                const data = parseCSVData(text);
                processData(data);

                const leaderboardContainer = document.getElementById("leaderboard");
                leaderboardContainer.innerHTML = generateLeaderboard();

                const achievementsList = document.getElementById("achievements-list");
                achievementsList.innerHTML = calculateAchievements(data);
            })
            .catch(error => console.error("Error loading the file:", error));

        // Automatically update the time for the last caught player every second
        setInterval(() => {
            const now = new Date();
            if (lastCaughtPlayer && lastTaggedTimes[lastCaughtPlayer]) {
                playerData[lastCaughtPlayer] += (now - lastTaggedTimes[lastCaughtPlayer]);
                lastTaggedTimes[lastCaughtPlayer] = now; // Aktualizácia posledného označenia na teraz
            }
            const leaderboardContainer = document.getElementById("leaderboard");
            leaderboardContainer.innerHTML = generateLeaderboard();
        }, 1000);
    }

    // Run the main function
    main();
});
