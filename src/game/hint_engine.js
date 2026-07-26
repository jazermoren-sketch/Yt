const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "../../config/hints.json");

function loadConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function getHint(type) {
  return loadConfig().hints[type] || null;
}

function canUse(user, type, usedHints = []) {
  const cfg = loadConfig();
  const hint = getHint(type);
  if (!hint) return {ok:false, reason:"التلميح غير موجود"};
  if (usedHints.length >= cfg.maxHintsPerQuestion) {
    return {ok:false, reason:"وصلتي للحد الأقصى ديال التلميحات فهاد السؤال"};
  }
  if (usedHints.includes(type)) {
    return {ok:false, reason:"استعملتي هاد التلميح من قبل"};
  }
  const tokens = user.hintTokens || 0;
  if (tokens < hint.cost) {
    return {ok:false, reason:`خاصك ${hint.cost} 💡، وعندك غير ${tokens}`};
  }
  return {ok:true, hint};
}

function spend(user, type) {
  const hint = getHint(type);
  if (!hint) return false;
  user.hintTokens = Math.max(0, (user.hintTokens || 0) - hint.cost);
  return true;
}

function revealLetter(answer, revealed = []) {
  const chars = [...answer];
  const hidden = chars.map((c, i) => (c === " " || revealed.includes(i) ? c : i));
  const available = hidden.filter(x => typeof x === "number");
  if (!available.length) return {text: answer, index: null};
  const index = available[Math.floor(Math.random() * available.length)];
  revealed.push(index);
  const text = chars.map((c,i) => (c === " " || revealed.includes(i)) ? c : "•").join("");
  return {text, index};
}

function removeWrongAnswers(answers, correctIndex, count = 2) {
  const wrong = answers.map((_, i) => i).filter(i => i !== correctIndex);
  wrong.sort(() => Math.random() - 0.5);
  const remove = wrong.slice(0, count);
  return answers.map((answer, i) => remove.includes(i) ? null : answer);
}

function getCategoryHint(question) {
  return question.smartHint || question.hint || `التصنيف هو: ${question.category || "عام"}`;
}

module.exports = {
  loadConfig,
  getHint,
  canUse,
  spend,
  revealLetter,
  removeWrongAnswers,
  getCategoryHint
};
