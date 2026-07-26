const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const storage = require("../database/storage");
const questionEngine = require("./question_engine");

const categories = {
  general:"ثقافة عامة", football:"كرة القدم", gaming:"الألعاب",
  movies:"أفلام ومسلسلات", science:"علوم", history:"تاريخ",
  geography:"جغرافيا", morocco:"المغرب", arab:"العالم العربي", anime:"أنمي"
};

const difficultyNames = {easy:"سهل", medium:"متوسط", hard:"صعب"};
const active = new Map();
const multiplayer = new Map();

function pickQuestion(category, difficulty, used = []) {
  return questionEngine.getRandomQuestion({
    category,
    difficulty,
    excludeIds: used
  }) || questionEngine.getRandomQuestion({category}) || questionEngine.getRandomQuestion({});
}

function questionEmbed(q, number, total, score, tokens) {
  return new EmbedBuilder()
    .setTitle(`🧠 السؤال ${number}/${total}`)
    .setDescription(`**${q.question}**`)
    .addFields(
      {name:"📚 التصنيف",value:categories[q.category] || q.category || "عام",inline:true},
      {name:"🎯 الصعوبة",value:difficultyNames[q.difficulty] || q.difficulty,inline:true},
      {name:"🏆 النقاط",value:String(score),inline:true},
      {name:"💡 تلميحاتك",value:String(tokens),inline:true}
    )
    .setFooter({text:"جاوب أو استعمل تلميحاً من رصيدك"})
    .setTimestamp();
}

function answerRow(qid, answers, removed = []) {
  return new ActionRowBuilder().addComponents(
    answers.map((a,i)=>new ButtonBuilder()
      .setCustomId(`answer:${qid}:${i}`)
      .setLabel(removed.includes(i) ? "🚫 محذوف" : a)
      .setStyle(removed.includes(i) ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(removed.includes(i)))
  );
}

function hintRow(qid) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`hint:${qid}:remove`).setLabel("💡 حذف جواب (1)").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`hint:${qid}:info`).setLabel("🔍 معلومة (2)").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`hint:${qid}:smart`).setLabel("🧩 تلميح قوي (3)").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`hint:${qid}:letter`).setLabel("🔤 أول حرف (4)").setStyle(ButtonStyle.Secondary)
  );
}

function tokensForDifficulty(difficulty) {
  return difficulty === "hard" ? 3 : difficulty === "medium" ? 2 : 1;
}

async function startQuiz(interaction) {
  const category = interaction.options.getString("category");
  const difficulty = interaction.options.getString("difficulty");
  const user = storage.getUser(interaction.user.id, interaction.user.username);
  const q = pickQuestion(category, difficulty);
  const game = {userId:interaction.user.id, q, category, difficulty, score:0, usedHints:[], removed:[], started:Date.now()};
  active.set(interaction.user.id, game);

  await interaction.reply({
    embeds:[questionEmbed(q,1,1,0,user.hintTokens)],
    components:[answerRow(q.id,q.answers), hintRow(q.id)]
  });
}

async function startPrefixQuiz(message, category = null, difficulty = null) {
  const user = storage.getUser(message.author.id, message.author.username);
  const q = pickQuestion(category, difficulty);
  if (!q) return message.reply("❌ ما لقيتش أسئلة مناسبة لهاد التصنيف.");

  const game = {userId:message.author.id, q, category, difficulty, score:0, usedHints:[], removed:[], started:Date.now()};
  active.set(message.author.id, game);

  return message.channel.send({
    embeds:[questionEmbed(q,1,1,0,user.hintTokens || 0)],
    components:[answerRow(q.id,q.answers), hintRow(q.id)]
  });
}

function normalizePrefixCategory(value) {
  if (!value) return null;
  const aliases = {
    "ثقافة":"general", "ثقافة عامة":"general", "عام":"general",
    "كرة القدم":"football", "كورة":"football", "فوتبول":"football",
    "الألعاب":"gaming", "العاب":"gaming",
    "أفلام":"movies", "أفلام ومسلسلات":"movies",
    "علوم":"science", "تاريخ":"history", "جغرافيا":"geography",
    "المغرب":"morocco", "العالم العربي":"arab", "أنمي":"anime"
  };
  const normalized = value.trim().toLowerCase();
  return aliases[normalized] || (Object.prototype.hasOwnProperty.call(categories, normalized) ? normalized : null);
}

function normalizePrefixDifficulty(value) {
  if (!value) return null;
  const aliases = {"سهل":"easy", "easy":"easy", "متوسط":"medium", "medium":"medium", "صعب":"hard", "hard":"hard"};
  return aliases[value.trim().toLowerCase()] || null;
}

async function handlePrefixMessage(message) {
  const parts = message.content.trim().split(/\s+/);
  const command = parts.shift().toLowerCase();
  if (command !== "!اسئلة") return;

  const difficulty = normalizePrefixDifficulty(parts[parts.length - 1]);
  if (difficulty) parts.pop();

  const category = normalizePrefixCategory(parts.join(" "));
  return startPrefixQuiz(message, category, difficulty);
}

async function answer(interaction, qid, index) {
  const game = active.get(interaction.user.id);
  if (!game || game.q.id !== qid) return interaction.reply({content:"❌ هذه اللعبة انتهت أو لم تعد صالحة.",ephemeral:true});

  const q = game.q;
  const user = storage.getUser(interaction.user.id, interaction.user.username);
  const correct = Number(index) === Number(q.correct);
  const base = q.difficulty === "hard" ? 30 : q.difficulty === "medium" ? 20 : 10;
  const earned = correct ? base : 0;
  const earnedTokens = correct ? tokensForDifficulty(q.difficulty) : 0;

  user.games++;
  if (correct) {
    user.correct++;
    user.streak++;
    user.bestStreak = Math.max(user.bestStreak, user.streak);
    user.points += earned;
    user.xp += earned;
    user.hintTokens = (user.hintTokens || 0) + earnedTokens;
  } else user.streak = 0;
  storage.saveUser(user);
  active.delete(interaction.user.id);

  const result = new EmbedBuilder()
    .setTitle(correct ? "✅ جواب صحيح!" : "❌ جواب خاطئ")
    .setDescription(correct
      ? `أحسنت! ربحت **${earned} نقطة** و **${earnedTokens} 💡 تلميح** 🎉`
      : `الجواب الصحيح هو: **${q.answers[q.correct]}**`)
    .addFields(
      {name:"💡 الشرح",value:q.explanation || "لا يوجد شرح مضاف لهذا السؤال."},
      {name:"🔥 السلسلة",value:String(user.streak),inline:true},
      {name:"⭐ XP",value:String(user.xp),inline:true},
      {name:"💡 رصيد التلميحات",value:String(user.hintTokens || 0),inline:true}
    );
  await interaction.update({embeds:[result],components:[]});
}

async function hint(interaction, qid, type) {
  const game = active.get(interaction.user.id);
  if (!game || game.q.id !== qid) return interaction.reply({content:"❌ لا يوجد سؤال نشط.",ephemeral:true});

  const costs = {remove:1, info:2, smart:3, letter:4};
  const cost = costs[type];
  if (!cost) return interaction.reply({content:"❌ تلميح غير معروف.",ephemeral:true});
  if (game.usedHints.includes(type)) return interaction.reply({content:"❌ استعملت هذا التلميح من قبل في هذا السؤال.",ephemeral:true});

  const user = storage.getUser(interaction.user.id, interaction.user.username);
  if ((user.hintTokens || 0) < cost) {
    return interaction.reply({content:`❌ ما عندكش تلميحات كافية. تحتاج **${cost} 💡** وعندك **${user.hintTokens || 0} 💡**.`,ephemeral:true});
  }

  user.hintTokens -= cost;
  storage.saveUser(user);
  game.usedHints.push(type);

  const q = game.q;

  if (type === "info") {
    return interaction.reply({content:`🔍 **معلومة:** ${q.hint || q.explanation || "فكر في السؤال جيداً، الجواب موجود ضمن الاختيارات."}

💡 رصيدك الآن: **${user.hintTokens}**`,ephemeral:true});
  }

  if (type === "smart") {
    return interaction.reply({content:`🧩 **تلميح قوي:** ${q.smartHint || q.hint || q.explanation || "حاول ربط السؤال بالمعلومة الأشهر المرتبطة به."}

💡 رصيدك الآن: **${user.hintTokens}**`,ephemeral:true});
  }

  if (type === "letter") {
    const answer = String(q.answers[q.correct] || "");
    const first = [...answer.trim()][0] || "?";
    return interaction.reply({content:`🔤 **أول حرف من الجواب:** \`${first}\`

💡 رصيدك الآن: **${user.hintTokens}**`,ephemeral:true});
  }

  const wrong = q.answers.map((_,i)=>i).filter(i=>i!==q.correct && !game.removed.includes(i));
  if (!wrong.length) return interaction.reply({content:"❌ لا يوجد جواب خاطئ آخر يمكن حذفه.",ephemeral:true});
  const remove = wrong[Math.floor(Math.random()*wrong.length)];
  game.removed.push(remove);

  await interaction.reply({content:`💡 تم حذف جواب خاطئ.
💡 رصيدك الآن: **${user.hintTokens}**`,ephemeral:true});
  await interaction.message.edit({components:[answerRow(q.id,q.answers,game.removed), hintRow(q.id)]});
}

async function profile(interaction) {
  const u = storage.getUser(interaction.user.id, interaction.user.username);
  const accuracy = u.games ? Math.round((u.correct/u.games)*100) : 0;
  await interaction.reply({embeds:[new EmbedBuilder().setTitle(`👤 ملف ${interaction.user.username}`)
    .addFields(
      {name:"⭐ XP",value:String(u.xp),inline:true},
      {name:"🏆 النقاط",value:String(u.points),inline:true},
      {name:"💡 التلميحات",value:String(u.hintTokens || 0),inline:true},
      {name:"🎮 المباريات",value:String(u.games),inline:true},
      {name:"🎯 الدقة",value:`${accuracy}%`,inline:true},
      {name:"🔥 السلسلة الحالية",value:String(u.streak),inline:true},
      {name:"🏅 أفضل سلسلة",value:String(u.bestStreak),inline:true}
    )]});
}

async function leaderboard(interaction) {
  const users = storage.allUsers().sort((a,b)=>b.points-a.points).slice(0,10);
  const text = users.length ? users.map((u,i)=>`${i+1}. **${u.name}** — ${u.points} نقطة — 💡 ${u.hintTokens || 0}`).join("\n") : "لا يوجد لاعبون بعد.";
  await interaction.reply({embeds:[new EmbedBuilder().setTitle("🏆 ترتيب اللاعبين").setDescription(text)]});
}

async function daily(interaction) {
  const q = pickQuestion();
  const user = storage.getUser(interaction.user.id, interaction.user.username);
  await interaction.reply({embeds:[questionEmbed(q,1,1,0,user.hintTokens || 0)],components:[answerRow(q.id,q.answers),hintRow(q.id)]});
  active.set(interaction.user.id,{userId:interaction.user.id,q,score:0,usedHints:[],removed:[]});
}

function multiplayerLobbyEmbed(game) {
  const players = [...game.players.values()];
  const names = players.length ? players.map((p,i)=>`${i+1}. ${p.name}`).join("\n") : "لا يوجد لاعبون بعد.";
  return new EmbedBuilder()
    .setTitle("🏟️ مسابقة Quiz جماعية")
    .setDescription(`**${game.hostName}** أنشأ مسابقة!\n\nاضغط **انضمام** للدخول.\n\n⏱️ تبدأ المباراة عندما يضغط المنشئ **ابدأ**.`)
    .addFields(
      {name:"👥 اللاعبون",value:names},
      {name:"🧠 الأسئلة",value:String(game.totalQuestions),inline:true},
      {name:"📚 التصنيف",value:categories[game.category] || "عشوائي",inline:true}
    );
}

function lobbyButtons(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mpjoin:${id}`).setLabel("🙋 انضمام").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`mpstart:${id}`).setLabel("🚀 ابدأ").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`mpcancel:${id}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Danger)
  );
}

function mpAnswerRow(gameId, answers) {
  return new ActionRowBuilder().addComponents(
    answers.map((a,i)=>new ButtonBuilder().setCustomId(`mpanswer:${gameId}:${i}`).setLabel(a).setStyle(ButtonStyle.Primary))
  );
}

function mpQuestionEmbed(game) {
  return new EmbedBuilder()
    .setTitle(`🏟️ السؤال ${game.currentIndex + 1}/${game.totalQuestions}`)
    .setDescription(`**${game.currentQuestion.question}**\n\n⏱️ كل لاعب يجاوب مرة واحدة.`)
    .addFields(
      {name:"👥 اللاعبون",value:String(game.players.size),inline:true},
      {name:"📚 التصنيف",value:categories[game.category] || "عشوائي",inline:true}
    )
    .setFooter({text:"الجواب الأسرع والصحيح يحصل على أفضل مكافأة"});
}

function mpLeaderboard(game) {
  return [...game.players.values()]
    .sort((a,b)=>b.score-a.score)
    .map((p,i)=>`${i+1}. **${p.name}** — ${p.score} نقطة — ${p.correct} ✅`)
    .join("\n");
}

async function multiplayer(interaction) {
  const id = `mp_${Date.now()}_${interaction.user.id}`;
  const game = {
    id,
    hostId: interaction.user.id,
    hostName: interaction.user.username,
    category: interaction.options.getString("category"),
    totalQuestions: interaction.options.getInteger("questions") || 10,
    players: new Map(),
    started: false,
    currentIndex: 0,
    questions: [],
    currentQuestion: null,
    answers: new Map(),
    timer: null
  };
  game.players.set(interaction.user.id, {id:interaction.user.id,name:interaction.user.username,score:0,correct:0,answered:false});
  multiplayer.set(id, game);

  await interaction.reply({embeds:[multiplayerLobbyEmbed(game)],components:[lobbyButtons(id)]});
}

async function startMultiplayer(interaction, id) {
  const game = multiplayer.get(id);
  if (!game) return interaction.reply({content:"❌ هذه المسابقة لم تعد موجودة.",ephemeral:true});
  if (interaction.user.id !== game.hostId) return interaction.reply({content:"❌ فقط منشئ المسابقة يقدر يبدأها.",ephemeral:true});
  if (game.players.size < 2) return interaction.reply({content:"❌ خاص على الأقل جوج لاعبين باش تبدا المسابقة.",ephemeral:true});

  game.started = true;
  game.questions = questionEngine.getRandomQuestions(game.totalQuestions, {category: game.category});
  game.totalQuestions = game.questions.length;
  await sendNextMultiplayerQuestion(interaction, game);
}

async function sendNextMultiplayerQuestion(interaction, game) {
  if (game.currentIndex >= game.totalQuestions) return finishMultiplayer(interaction, game);

  game.currentQuestion = game.questions[game.currentIndex];
  game.answers = new Map();
  for (const p of game.players.values()) p.answered = false;

  await interaction.update({embeds:[mpQuestionEmbed(game)],components:[mpAnswerRow(game.id, game.currentQuestion.answers)]});

  game.timer = setTimeout(async () => {
    if (!multiplayer.has(game.id)) return;
    await finishMultiplayerQuestion(interaction, game);
  }, 15000);
}

async function mpAnswer(interaction, id, index) {
  const game = multiplayer.get(id);
  if (!game || !game.started || !game.currentQuestion) return interaction.reply({content:"❌ لا توجد مسابقة نشطة.",ephemeral:true});
  const player = game.players.get(interaction.user.id);
  if (!player) return interaction.reply({content:"❌ أنت لست مشاركاً في هذه المسابقة.",ephemeral:true});
  if (player.answered) return interaction.reply({content:"❌ جاوبتي من قبل على هذا السؤال.",ephemeral:true});

  player.answered = true;
  const correct = Number(index) === Number(game.currentQuestion.correct);
  game.answers.set(interaction.user.id, {index:Number(index),correct,time:Date.now()});

  await interaction.reply({content:correct ? "✅ جوابك تسجل!": "❌ جوابك تسجل.",ephemeral:true});

  if (game.answers.size >= game.players.size) await finishMultiplayerQuestion(interaction, game);
}

async function finishMultiplayerQuestion(interaction, game) {
  if (game.timer) clearTimeout(game.timer);
  if (!game.currentQuestion) return;

  const q = game.currentQuestion;
  const responses = [...game.answers.entries()]
    .filter(([,a])=>a.correct)
    .sort((a,b)=>a[1].time-b[1].time);

  responses.forEach(([uid], i) => {
    const p = game.players.get(uid);
    p.correct++;
    p.score += Math.max(5, 30 - (i * 5));
  });

  const resultText = responses.length
    ? responses.map(([uid],i)=>`${i+1}. ${game.players.get(uid).name} — +${Math.max(5,30-(i*5))} نقطة`).join("\n")
    : "❌ لم يجب أي لاعب بشكل صحيح.";

  game.currentIndex++;
  const embed = new EmbedBuilder()
    .setTitle("📊 نتيجة السؤال")
    .setDescription(`الجواب الصحيح: **${q.answers[q.correct]}**\n\n${resultText}`)
    .addFields({name:"🏆 الترتيب المؤقت",value:mpLeaderboard(game)});

  await interaction.editReply({embeds:[embed],components:[]});
  setTimeout(() => {
    if (multiplayer.has(game.id)) sendNextMultiplayerQuestion(interaction, game).catch(console.error);
  }, 2500);
}

async function finishMultiplayer(interaction, game) {
  const ranking = [...game.players.values()].sort((a,b)=>b.score-a.score);
  const winner = ranking[0];
  const text = ranking.map((p,i)=>`${i+1}. **${p.name}** — ${p.score} نقطة — ${p.correct}/${game.totalQuestions} صحيحة`).join("\n");

  for (const p of ranking) {
    const u = storage.getUser(p.id, p.name);
    u.games += game.totalQuestions;
    u.correct += p.correct;
    u.points += p.score;
    u.xp += p.score;
    if (p.correct > 0) u.hintTokens = (u.hintTokens || 0) + p.correct;
    storage.saveUser(u);
    seasonEngine.addScore(p.id, p.score, p.score);
    if (p === winner) seasonEngine.addWin(p.id);
  }

  const embed = new EmbedBuilder()
    .setTitle("🏆 انتهت المسابقة الجماعية!")
    .setDescription(`🎉 الفائز هو: **${winner.name}**\n\n${text}`)
    .setFooter({text:"كل إجابة صحيحة في Multiplayer تمنح +1 💡 تلميح"});
  await interaction.editReply({embeds:[embed],components:[]});
  multiplayer.delete(game.id);
}

async function adminQuestion(interaction) {
  if (!interaction.memberPermissions?.has("Administrator")) return interaction.reply({content:"❌ هذا الأمر مخصص للإدارة فقط.",ephemeral:true});
  const sub = interaction.options.getSubcommand();
  const qs = storage.getQuestions();
  if (sub === "list") return interaction.reply({content:`📚 عدد الأسئلة الموجودة: **${qs.length}**`,ephemeral:true});
  if (sub === "delete") {
    const id = interaction.options.getString("id");
    const next = qs.filter(q=>q.id !== id);
    storage.saveQuestions(next);
    return interaction.reply({content:next.length < qs.length ? "✅ تم حذف السؤال." : "❌ لم يتم العثور على السؤال.",ephemeral:true});
  }
  const question = interaction.options.getString("question");
  const answers = [1,2,3,4].map(i=>interaction.options.getString(`answer${i}`));
  const correct = interaction.options.getInteger("correct") - 1;
  const q = {id:`q_${Date.now()}`, question, answers, correct,
    category:interaction.options.getString("category"),
    difficulty:interaction.options.getString("difficulty"),
    explanation:interaction.options.getString("explanation") || "لا يوجد شرح."
  };
  qs.push(q); storage.saveQuestions(qs);
  await interaction.reply({content:`✅ تمت إضافة السؤال بنجاح.\n🆔 المعرف: \`${q.id}\``,ephemeral:true});
}

async function handleInteraction(interaction) {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "quiz") return startQuiz(interaction);
    if (interaction.commandName === "profile") return profile(interaction);
    if (interaction.commandName === "leaderboard") return leaderboard(interaction);
    if (interaction.commandName === "daily") return daily(interaction);
    if (interaction.commandName === "multiplayer") return multiplayer(interaction);
    if (interaction.commandName === "admin-question") return adminQuestion(interaction);
  }
  if (interaction.isButton()) {
    const [type,id,arg] = interaction.customId.split(":");
    if (type === "answer") return answer(interaction,id,arg);
    if (type === "hint") return hint(interaction,id,arg);
    if (type === "mpjoin") {
      const game = multiplayer.get(id);
      if (!game || game.started) return interaction.reply({content:"❌ لا يمكن الانضمام الآن.",ephemeral:true});
      if (!game.players.has(interaction.user.id)) game.players.set(interaction.user.id,{id:interaction.user.id,name:interaction.user.username,score:0,correct:0,answered:false});
      return interaction.update({embeds:[multiplayerLobbyEmbed(game)],components:[lobbyButtons(id)]});
    }
    if (type === "mpstart") return startMultiplayer(interaction,id);
    if (type === "mpcancel") {
      const game = multiplayer.get(id);
      if (!game) return interaction.reply({content:"❌ المسابقة غير موجودة.",ephemeral:true});
      if (interaction.user.id !== game.hostId) return interaction.reply({content:"❌ فقط المنشئ يقدر يلغي المسابقة.",ephemeral:true});
      multiplayer.delete(id);
      return interaction.update({content:"❌ تم إلغاء المسابقة.",embeds:[],components:[]});
    }
    if (type === "mpanswer") return mpAnswer(interaction,id,arg);
  }
}

module.exports = {handleInteraction, handlePrefixMessage};
