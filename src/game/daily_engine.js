const fs = require("fs");
const path = require("path");
const questionEngine = require("./question_engine");

const configPath = path.join(__dirname, "../../config/daily_challenges.json");
const statePath = path.join(__dirname, "../../data/daily_state.json");

function config() {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function loadState() {
  if (!fs.existsSync(statePath)) {
    const state = {date: today(), questions: [], users: {}};
    saveState(state);
    return state;
  }
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  if (state.date !== today()) {
    const next = {date: today(), questions: [], users: {}};
    saveState(next);
    return next;
  }
  return state;
}

function saveState(state) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
}

function getDailyQuestions() {
  const state = loadState();
  if (!state.questions.length) {
    state.questions = questionEngine.getRandomQuestions(config().dailyQuestions, {});
    saveState(state);
  }
  return state.questions;
}

function getUser(userId) {
  const state = loadState();
  if (!state.users[userId]) {
    state.users[userId] = {
      completed: false,
      correct: 0,
      streak: 0,
      lastCompleted: null
    };
    saveState(state);
  }
  return state.users[userId];
}

function complete(userId, correct) {
  const state = loadState();
  const user = getUser(userId);
  user.correct = correct;
  user.completed = true;
  user.lastCompleted = today();
  user.streak++;
  saveState(state);
  return user;
}

module.exports = {today, getDailyQuestions, getUser, complete, config};
