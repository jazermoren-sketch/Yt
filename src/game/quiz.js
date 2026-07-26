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

  const game = {
    userId: message.author.id,
    q,
    category,
    difficulty,
    score: 0,
    usedHints: [],
    removed: [],
    started: Date.now()
  };

  active.set(message.author.id, game);

  return message.channel.send({
    embeds:[questionEmbed(q,1,1,0,user.hintTokens || 0)],
    components:[answerRow(q.id,q.answers), hintRow(q.id)]
  });
}

function normalizePrefixCategory(value) {
  if (!value) return null;
  const aliases = {
    "ثقافة": "general", "ثقافة عامة": "general", "عام": "general",
    "كرة القدم": "football", "كورة": "football", "فوتبول": "football",
    "الألعاب": "gaming", "العاب": "gaming",
    "أفلام": "movies", "أفلام ومسلسلات": "movies",
    "علوم": "science", "تاريخ": "history", "جغرافيا": "geography",
    "المغرب": "morocco", "العالم العربي": "arab", "أنمي": "anime"
  };
  return aliases[value.trim().toLowerCase()] || Object.keys(categories).find(k => k === value.trim().toLowerCase()) || null;
}

function normalizePrefixDifficulty(value) {
  if (!value) return null;
  const aliases = {
    "سهل":"easy", "easy":"easy",
    "متوسط":"medium", "medium":"medium",
    "صعب":"hard", "hard":"hard"
  };
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

async function multiplayer(interaction) {
  return interaction.reply({content:"🏟️ المسابقة الجماعية موجودة في النسخة الحالية.",ephemeral:true});
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
  await interaction.reply({content:`✅ تمت إضافة السؤال بنجاح.
🆔 المعرف: \`${q.id}\``,ephemeral:true});
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
  }
}

module.exports = {handleInteraction, handlePrefixMessage};
