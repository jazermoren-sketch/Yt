const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "../../config/season.json");
const statePath = path.join(__dirname, "../../data/season_state.json");

function loadConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function loadState() {
  if (!fs.existsSync(statePath)) {
    const config = loadConfig();
    const state = {
      seasonNumber: config.seasonNumber,
      seasonName: config.seasonName,
      startedAt: Date.now(),
      endsAt: Date.now() + config.seasonDurationDays * 86400000,
      scores: {}
    };
    saveState(state);
    return state;
  }
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

function saveState(state) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
}

function ensureSeason() {
  let state = loadState();
  if (Date.now() >= state.endsAt) {
    const config = loadConfig();
    state = {
      seasonNumber: state.seasonNumber + 1,
      seasonName: `الموسم ${state.seasonNumber + 1}`,
      startedAt: Date.now(),
      endsAt: Date.now() + config.seasonDurationDays * 86400000,
      scores: {}
    };
    saveState(state);
  }
  return state;
}

function addScore(userId, points, xp = 0) {
  const state = ensureSeason();
  if (!state.scores[userId]) state.scores[userId] = {points: 0, xp: 0, wins: 0};
  state.scores[userId].points += points;
  state.scores[userId].xp += xp;
  saveState(state);
  return state.scores[userId];
}

function addWin(userId) {
  const state = ensureSeason();
  if (!state.scores[userId]) state.scores[userId] = {points: 0, xp: 0, wins: 0};
  state.scores[userId].wins++;
  saveState(state);
}

function leaderboard(limit = 10) {
  const state = ensureSeason();
  return Object.entries(state.scores)
    .map(([id, data]) => ({id, ...data}))
    .sort((a,b) => b.points - a.points || b.xp - a.xp)
    .slice(0, limit);
}

function getSeasonInfo() {
  const state = ensureSeason();
  return {
    seasonNumber: state.seasonNumber,
    seasonName: state.seasonName,
    startedAt: state.startedAt,
    endsAt: state.endsAt,
    remainingMs: Math.max(0, state.endsAt - Date.now())
  };
}

function getRewards() {
  return loadConfig().rewards || [];
}

module.exports = {
  ensureSeason,
  addScore,
  addWin,
  leaderboard,
  getSeasonInfo,
  getRewards
};
