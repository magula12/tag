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

    players.forEach(player => {
        playerData[player] = 0;
        playerPoints[player] = 0;
        lastTaggedTimes[player] = 0;
        taggedDays[player] = new Set();
    });

    fetch("https://magula12.github.io/tag/tag.csv")
        .then(response => response.text())
        .then(text => {
            const rows = text.trim().split("\n").slice(1).map(row => row.split(","));

            let data = rows.map(row => {
                const dateString = `${row[0].trim()} ${row[1].trim()}`;
                const currentYear = 2025;
                const [day, month] = dateString.split(" ")[0].split(".");
                const timeString = dateString.split(" ")[1];
                const formattedDateString = `${month}-${day}-${currentYear} ${timeString}`;
                const timeTagged = new Date(formattedDateString);

                if (isNaN(timeTagged)) {
                    console.error(`Invalid date and time: ${formattedDateString}`);
                    return null;
                }

                return {
                    DATETIME: timeTagged,
                    MENO: row[2].trim()
                };
            }).filter(entry => entry !== null);

            data.sort((a, b) => a.DATETIME - b.DATETIME);

            let lastTag = data[0].DATETIME;
            let lastPlayer = data[0].MENO;

            data.forEach((entry, index) => {
                const newHolder = entry.MENO;
                const timeTagged = entry.DATETIME;

                if (index === 0) {
                    lastTag = timeTagged;
                    lastPlayer = newHolder;
                    return;
                }

                const timeDiff = timeTagged - lastTag;
                playerData[lastPlayer] += timeDiff;

                const hoursHeld = Math.floor(timeDiff / (1000 * 60 * 60));
                const penalty = hoursHeld * 5;
                playerPoints[lastPlayer] -= penalty;

                const rankedLeaderboard = Object.entries(playerData)
                    .sort(([, timeA], [, timeB]) => timeB - timeA);
                
                const taggedPlayerRank = rankedLeaderboard.findIndex(([player]) => player === lastPlayer) + 1;
                let pointsAwarded = 0;

                switch (taggedPlayerRank) {
                    case 1: pointsAwarded = 50; break;
                    case 2: pointsAwarded = 40; break;
                    case 3: pointsAwarded = 30; break;
                    case 4: pointsAwarded = 20; break;
                    case 5: pointsAwarded = 10; break;
                    case 6: pointsAwarded = 5; break;
                    default: pointsAwarded = 0; break;
                }

                playerPoints[newHolder] += pointsAwarded;

                const lastTagDay = lastTag.toISOString().split("T")[0];
                const currentTagDay = timeTagged.toISOString().split("T")[0];

                taggedDays[lastPlayer].add(lastTagDay);
                taggedDays[newHolder].add(currentTagDay);

                lastPlayer = newHolder;
                lastTag = timeTagged;
                lastTaggedTimes[lastPlayer] = timeTagged;

                lastCaughtPlayer = lastPlayer;
            });

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
                            playerPoints[player] += 50;
                        }
                    }
                });
            });

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

            console.log("Leaderboard:");
            const leaderboardContainer = document.getElementById("leaderboard");
            leaderboardContainer.innerHTML = leaderboard.map((entry, index) => {
                if (entry.points !== lastPoints) {
                    rank++;
                    displayRank = rank;
                }
                lastPoints = entry.points;

                console.log(`${displayRank}. ${entry.player} - Points: ${entry.points} | Time: ${entry.time}`);

                return `
                    <div class="leaderboard-entry ${entry.player === lastCaughtPlayer ? 'last-caught' : ''}" style="top: ${index * 30}px;">
                        <span>${displayRank}.</span>
                        <span>${entry.player}</span>
                        <span>Points: ${entry.points}</span>
                        <span>Time: ${entry.time}</span>
                    </div>
                `;
            }).join("");
        })
        .catch(error => console.error("Error loading the file:", error));

    function formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        const remainingSeconds = seconds % 60;

        return `${pad(hours)}:${pad(remainingMinutes)}:${pad(remainingSeconds)}`;
    }

    function pad(num) {
        return num < 10 ? `0${num}` : num;
    }
});
