const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "../../config/ai_questions.json");
const questionPath = path.join(__dirname, "../../data/question_bank.json");

function config() {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function loadQuestions() {
  if (!fs.existsSync(questionPath)) return [];
  return JSON.parse(fs.readFileSync(questionPath, "utf8"));
}

function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ى]/g, "ي")
    .replace(/[ة]/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isDuplicate(candidate, questions = loadQuestions()) {
  const target = normalize(candidate.question);
  return questions.some(q => normalize(q.question) === target);
}

function validate(candidate) {
  const c = config();
  const errors = [];

  if (!candidate || typeof candidate !== "object") errors.push("invalid_object");
  if (!candidate?.question?.trim()) errors.push("empty_question");
  if (!candidate?.answer?.trim()) errors.push("empty_answer");
  if (!candidate?.category?.trim()) errors.push("missing_category");
  if (!["easy","medium","hard"].includes(candidate?.difficulty)) errors.push("invalid_difficulty");
  if (!Array.isArray(candidate?.options) || candidate.options.length !== c.generationRules.multipleChoiceOptions) {
    errors.push("invalid_options");
  }
  if (candidate?.options && !candidate.options.includes(candidate.answer)) errors.push("answer_not_in_options");
  if (c.moderation.requireExplanation && !candidate?.explanation?.trim()) errors.push("missing_explanation");
  if (c.moderation.rejectDuplicates && isDuplicate(candidate)) errors.push("duplicate_question");

  return {valid: errors.length === 0, errors};
}

function buildPrompt({category = "general", difficulty = "medium", count = 5} = {}) {
  const c = config();
  return `أنت مولد أسئلة Quiz عربي احترافي.
أنشئ ${count} أسئلة باللغة العربية فقط.
التصنيف: ${category}
الصعوبة: ${difficulty}
كل سؤال يجب أن يكون اختياراً من متعدد بأربع إجابات.
أعد JSON فقط على شكل Array، بدون Markdown.
كل عنصر يجب أن يحتوي:
question, options, answer, category, difficulty, hint, explanation.
لا تكرر أسئلة شائعة أو موجودة في بنك الأسئلة.
تأكد من أن answer واحدة من options.
`;
}

function validateBatch(items) {
  const accepted = [];
  const rejected = [];
  const seen = new Set();

  for (const item of items || []) {
    const key = normalize(item.question);
    if (seen.has(key)) {
      rejected.push({item, errors:["duplicate_in_batch"]});
      continue;
    }
    const result = validate(item);
    if (result.valid) {
      accepted.push(item);
      seen.add(key);
    } else {
      rejected.push({item, errors:result.errors});
    }
  }
  return {accepted, rejected};
}

function buildOpenRouterRequest(apiKey, options = {}) {
  const c = config();
  return {
    url: "https://openrouter.ai/api/v1/chat/completions",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://discord.com",
      "X-Title": "Arabic Quiz Bot"
    },
    body: {
      model: options.model || c.model,
      temperature: 0.7,
      response_format: {type: "json_object"},
      messages: [
        {role:"system", content:"أنت خبير في إعداد أسئلة مسابقات عربية دقيقة."},
        {role:"user", content:buildPrompt(options)}
      ]
    }
  };
}

module.exports = {
  config,
  loadQuestions,
  normalize,
  isDuplicate,
  validate,
  validateBatch,
  buildPrompt,
  buildOpenRouterRequest
};
