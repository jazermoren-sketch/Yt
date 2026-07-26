const fs = require("fs");
const path = require("path");

const engine = require("./ai_question_engine");

const runtimePath = path.join(__dirname, "../../config/ai_runtime.json");
const bankPath = path.join(__dirname, "../../data/question_bank.json");

function runtime() {
  return JSON.parse(fs.readFileSync(runtimePath, "utf8"));
}

function loadBank() {
  if (!fs.existsSync(bankPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(bankPath, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveBank(questions) {
  fs.writeFileSync(bankPath, JSON.stringify(questions, null, 2), "utf8");
}

function extractJson(content) {
  if (Array.isArray(content)) return content;
  if (content && Array.isArray(content.questions)) return content.questions;
  if (typeof content !== "string") return [];
  const cleaned = content.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed : (parsed.questions || []);
}

async function generate({apiKey, category, difficulty, count}) {
  const cfg = runtime();
  const safeCount = Math.min(Math.max(Number(count) || 5, 1), cfg.maxQuestionsPerRequest);
  const request = engine.buildOpenRouterRequest(apiKey, {
    category,
    difficulty,
    count: safeCount,
    model: cfg.model
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const response = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: controller.signal
    });

    const raw = await response.text();
    if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}: ${raw.slice(0, 500)}`);

    const payload = JSON.parse(raw);
    const content = payload?.choices?.[0]?.message?.content;
    const items = extractJson(content);
    const checked = engine.validateBatch(items);

    let saved = [];
    if (cfg.autoSaveAcceptedQuestions && checked.accepted.length) {
      const bank = loadBank();
      const existing = new Set(bank.map(q => engine.normalize(q.question)));
      saved = checked.accepted.filter(q => !existing.has(engine.normalize(q.question)));
      saveBank([...bank, ...saved]);
    }

    return {
      generated: items.length,
      accepted: checked.accepted.length,
      rejected: checked.rejected.length,
      saved: saved.length,
      questions: checked.accepted,
      rejectedItems: checked.rejected
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {runtime, loadBank, saveBank, generate};
