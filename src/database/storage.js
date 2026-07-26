const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "../../data");
const USERS = path.join(DATA, "users.json");
const QUESTIONS = path.join(DATA, "questions.json");

function ensure() {
  if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, {recursive:true});
  if (!fs.existsSync(USERS)) fs.writeFileSync(USERS, "{}");
  if (!fs.existsSync(QUESTIONS)) fs.writeFileSync(QUESTIONS, "[]");
}
ensure();

function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function write(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

function getUser(id, name="لاعب") {
  const users = read(USERS);
  if (!users[id]) users[id] = {id, name, xp:0, points:0, hintTokens:0, coins:0, wins:0, games:0, correct:0, streak:0, bestStreak:0, categoryStats:{}, inventory:{}, badges:[], activeBoosts:[]};
  users[id].name = name;
  write(USERS, users);
  return users[id];
}
function saveUser(user) {
  const users = read(USERS);
  users[user.id] = user;
  write(USERS, users);
}
function allUsers() { return Object.values(read(USERS)); }
function getQuestions() { return read(QUESTIONS); }
function saveQuestions(q) { write(QUESTIONS, q); }

module.exports = {getUser, saveUser, allUsers, getQuestions, saveQuestions};
