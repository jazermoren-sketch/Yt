const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "../../config/achievements.json");

function list() {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function check(user) {
  const unlocked = new Set(user.achievements || []);
  const result = [];
  const stats = user.stats || user;
  const correct = stats.correct || user.correct || 0;
  const wins = stats.wins || user.wins || 0;
  const streak = stats.bestStreak || user.bestStreak || 0;

  for (const a of list()) {
    let unlock = false;
    if (a.id === "first_win" && wins >= 1) unlock = true;
    if (a.id === "streak_3" && streak >= 3) unlock = true;
    if (a.id === "streak_10" && streak >= 10) unlock = true;
    if (a.id === "quiz_50" && correct >= 50) unlock = true;
    if (a.id === "quiz_100" && correct >= 100) unlock = true;
    if (a.id === "daily_7" && (user.dailyStreak || 0) >= 7) unlock = true;
    if (a.id === "category_master" && Object.values(user.categoryStats || {}).some(x => (x.points || 0) >= 100)) unlock = true;

    if (unlock && !unlocked.has(a.id)) {
      unlocked.add(a.id);
      result.push(a);
    }
  }

  user.achievements = [...unlocked];
  return result;
}

module.exports = {list, check};
