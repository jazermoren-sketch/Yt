const fs = require("fs");
const path = require("path");
const questionEngine = require("./question_engine");

function exportQuestions() {
  const questions = questionEngine.loadBank();
  return JSON.stringify({version: 1, questions}, null, 2);
}

function importQuestions(jsonText) {
  const parsed = JSON.parse(jsonText);
  const incoming = Array.isArray(parsed) ? parsed : parsed.questions;
  if (!Array.isArray(incoming)) throw new Error("صيغة بنك الأسئلة غير صحيحة");

  const valid = [];
  const errors = [];
  for (const raw of incoming) {
    const q = {...raw};
    const result = questionEngine.validateQuestion(q);
    if (result.length) errors.push({question: q.question || "بدون عنوان", errors: result});
    else valid.push(q);
  }

  if (errors.length) return {ok: false, imported: 0, errors};
  questionEngine.saveBank(valid);
  return {ok: true, imported: valid.length, errors: []};
}

module.exports = {exportQuestions, importQuestions};
