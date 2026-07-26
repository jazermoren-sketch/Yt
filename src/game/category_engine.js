const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "../../config/categories.json");
let categories = {};

try {
  categories = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (e) {
  console.error("Categories config error:", e.message);
}

const difficulty = {
  easy: {name:"سهل", emoji:"🟢", points:10, xp:10, tokens:1, multiplier:1},
  medium: {name:"متوسط", emoji:"🟡", points:20, xp:20, tokens:2, multiplier:2},
  hard: {name:"صعب", emoji:"🔴", points:30, xp:30, tokens:3, multiplier:3}
};

function getCategory(id) {
  return categories[id] || categories.general || {
    name:"عام", emoji:"🧠", baseXP:10, multiplier:1
  };
}

function getDifficulty(id) {
  return difficulty[id] || difficulty.medium;
}

function calculateReward(categoryId, difficultyId, speedBonus = 0) {
  const cat = getCategory(categoryId);
  const diff = getDifficulty(difficultyId);
  const points = Math.round(diff.points * cat.multiplier) + speedBonus;
  const xp = Math.round(diff.xp * cat.multiplier) + Math.floor(speedBonus / 2);
  return {
    points,
    xp,
    hintTokens: diff.tokens,
    categoryMultiplier: cat.multiplier,
    speedBonus
  };
}

function getCategoryStats(users, categoryId) {
  return users
    .map(u => ({
      id: u.id,
      name: u.name,
      score: u.categoryStats?.[categoryId]?.points || 0,
      correct: u.categoryStats?.[categoryId]?.correct || 0,
      games: u.categoryStats?.[categoryId]?.games || 0,
      xp: u.categoryStats?.[categoryId]?.xp || 0
    }))
    .filter(u => u.games > 0)
    .sort((a,b) => b.score - a.score);
}

module.exports = {categories, difficulty, getCategory, getDifficulty, calculateReward, getCategoryStats};
