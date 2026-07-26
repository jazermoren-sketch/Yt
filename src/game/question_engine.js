const fs = require("fs");
const path = require("path");

const bankPath = path.join(__dirname, "../../data/question_bank.json");

function loadBank() {
  try {
    const raw = JSON.parse(fs.readFileSync(bankPath, "utf8"));
    return Array.isArray(raw) ? raw : raw.questions || [];
  } catch (error) {
    console.error("Question bank load error:", error.message);
    return [];
  }
}

function saveBank(questions) {
  fs.writeFileSync(
    bankPath,
    JSON.stringify({version: 1, questions}, null, 2),
    "utf8"
  );
}

function normalizeQuestion(q) {
  return {
    id: q.id || `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    question: String(q.question || "").trim(),
    answers: Array.isArray(q.answers) ? q.answers.map(String) : [],
    correct: Number(q.correct),
    category: q.category || "general",
    difficulty: q.difficulty || "medium",
    explanation: q.explanation || "",
    hint: q.hint || "",
    smartHint: q.smartHint || ""
  };
}

function validateQuestion(q) {
  const errors = [];
  if (!q.question) errors.push("نص السؤال فارغ");
  if (!Array.isArray(q.answers) || q.answers.length !== 4) errors.push("خاص 4 أجوبة");
  if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) errors.push("الإجابة الصحيحة غير صالحة");
  if (!["easy", "medium", "hard"].includes(q.difficulty)) errors.push("الصعوبة غير صالحة");
  return errors;
}

function getQuestions(filters = {}) {
  const all = loadBank().map(normalizeQuestion);
  return all.filter(q =>
    (!filters.category || q.category === filters.category) &&
    (!filters.difficulty || q.difficulty === filters.difficulty) &&
    (!filters.excludeIds || !filters.excludeIds.includes(q.id))
  );
}

function getRandomQuestion(filters = {}) {
  const list = getQuestions(filters);
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function getRandomQuestions(count, filters = {}) {
  const list = getQuestions(filters);
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function addQuestion(question) {
  const q = normalizeQuestion(question);
  const errors = validateQuestion(q);
  if (errors.length) return {ok: false, errors};
  const all = loadBank();
  all.push(q);
  saveBank(all);
  return {ok: true, question: q};
}

function deleteQuestion(id) {
  const all = loadBank();
  const next = all.filter(q => q.id !== id);
  saveBank(next);
  return next.length !== all.length;
}

function getStats() {
  const all = loadBank();
  const byCategory = {};
  const byDifficulty = {};
  for (const q of all) {
    byCategory[q.category] = (byCategory[q.category] || 0) + 1;
    byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] || 0) + 1;
  }
  return {total: all.length, byCategory, byDifficulty};
}

module.exports = {
  loadBank,
  saveBank,
  getQuestions,
  getRandomQuestion,
  getRandomQuestions,
  addQuestion,
  deleteQuestion,
  validateQuestion,
  getStats
};
