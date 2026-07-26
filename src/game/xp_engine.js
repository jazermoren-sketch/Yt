const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "../../config/xp_levels.json");

function config() {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function xpForLevel(level) {
  const c = config();
  if (level <= 1) return 0;
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += Math.floor(c.baseXP * Math.pow(c.growth, i - 1));
  }
  return total;
}

function levelFromXP(xp = 0) {
  const c = config();
  let level = 1;
  while (level < c.maxLevel && xp >= xpForLevel(level + 1)) level++;
  return level;
}

function getProgress(xp = 0) {
  const c = config();
  const level = levelFromXP(xp);
  const current = xpForLevel(level);
  const next = level >= c.maxLevel ? current : xpForLevel(level + 1);
  return {
    level,
    currentXP: xp,
    xpInLevel: xp - current,
    xpNeeded: Math.max(0, next - current),
    nextLevelXP: next,
    progress: next === current ? 1 : Math.min(1, (xp - current) / (next - current))
  };
}

function getRank(level) {
  const ranks = config().ranks || [];
  return ranks.find(r => level >= r.minLevel && level <= r.maxLevel) || ranks[0];
}

function addXP(user, amount) {
  const before = levelFromXP(user.xp || 0);
  user.xp = Math.max(0, (user.xp || 0) + Math.max(0, amount));
  const after = levelFromXP(user.xp);
  return {
    xp: user.xp,
    oldLevel: before,
    newLevel: after,
    levelUp: after > before,
    progress: getProgress(user.xp),
    rank: getRank(after)
  };
}

module.exports = {config, xpForLevel, levelFromXP, getProgress, getRank, addXP};
