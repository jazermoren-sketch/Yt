require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

const commands = [
  new SlashCommandBuilder()
    .setName("quiz")
    .setDescription("ابدأ لعبة أسئلة عربية")
    .addStringOption(o => o.setName("category").setDescription("التصنيف").setRequired(false)
      .addChoices(
        {name:"ثقافة عامة",value:"general"},
        {name:"كرة القدم",value:"football"},
        {name:"الألعاب",value:"gaming"},
        {name:"أفلام ومسلسلات",value:"movies"},
        {name:"علوم",value:"science"},
        {name:"تاريخ",value:"history"},
        {name:"جغرافيا",value:"geography"},
        {name:"المغرب",value:"morocco"},
        {name:"العالم العربي",value:"arab"},
        {name:"أنمي",value:"anime"}
      ))
    .addStringOption(o => o.setName("difficulty").setDescription("مستوى الصعوبة").setRequired(false)
      .addChoices(
        {name:"سهل",value:"easy"},
        {name:"متوسط",value:"medium"},
        {name:"صعب",value:"hard"}
      )),
  new SlashCommandBuilder().setName("profile").setDescription("عرض ملفك الشخصي"),
  new SlashCommandBuilder().setName("leaderboard").setDescription("عرض ترتيب اللاعبين"),
  new SlashCommandBuilder().setName("daily").setDescription("سؤال اليوم"),
  new SlashCommandBuilder()
    .setName("multiplayer")
    .setDescription("أنشئ مسابقة جماعية بين اللاعبين")
    .addIntegerOption(o => o.setName("questions").setDescription("عدد الأسئلة").setRequired(false).setMinValue(3).setMaxValue(20))
    .addStringOption(o => o.setName("category").setDescription("التصنيف").setRequired(false)
      .addChoices(
        {name:"ثقافة عامة",value:"general"},
        {name:"كرة القدم",value:"football"},
        {name:"الألعاب",value:"gaming"},
        {name:"أفلام ومسلسلات",value:"movies"},
        {name:"علوم",value:"science"},
        {name:"تاريخ",value:"history"},
        {name:"جغرافيا",value:"geography"},
        {name:"المغرب",value:"morocco"},
        {name:"العالم العربي",value:"arab"},
        {name:"أنمي",value:"anime"}
      )),
  new SlashCommandBuilder()
    .setName("admin-question")
    .setDescription("إدارة الأسئلة")
    .addSubcommand(s => s.setName("add").setDescription("إضافة سؤال")
      .addStringOption(o=>o.setName("question").setDescription("السؤال").setRequired(true))
      .addStringOption(o=>o.setName("answer1").setDescription("الاختيار الأول").setRequired(true))
      .addStringOption(o=>o.setName("answer2").setDescription("الاختيار الثاني").setRequired(true))
      .addStringOption(o=>o.setName("answer3").setDescription("الاختيار الثالث").setRequired(true))
      .addStringOption(o=>o.setName("answer4").setDescription("الاختيار الرابع").setRequired(true))
      .addIntegerOption(o=>o.setName("correct").setDescription("رقم الجواب الصحيح: 1 إلى 4").setRequired(true).setMinValue(1).setMaxValue(4))
      .addStringOption(o=>o.setName("category").setDescription("التصنيف").setRequired(true))
      .addStringOption(o=>o.setName("difficulty").setDescription("الصعوبة: easy / medium / hard").setRequired(true))
      .addStringOption(o=>o.setName("explanation").setDescription("شرح الجواب").setRequired(false)))
    .addSubcommand(s => s.setName("list").setDescription("عرض عدد الأسئلة"))
    .addSubcommand(s => s.setName("delete").setDescription("حذف سؤال")
      .addStringOption(o=>o.setName("id").setDescription("معرف السؤال").setRequired(true))),
  new SlashCommandBuilder()
    .setName("question-bank")
    .setDescription("إحصائيات بنك الأسئلة")
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({version:"10"}).setToken(process.env.DISCORD_TOKEN);
  const route = process.env.GUILD_ID
    ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
    : Routes.applicationCommands(process.env.CLIENT_ID);
  await rest.put(route, {body: commands});
  console.log("تم تسجيل أوامر البوت بنجاح.");
}

client.once("ready", () => {
  console.log(`✅ ${client.user.tag} متصل الآن`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;
  try {
    const { handleInteraction } = require("./game/quiz");
    await handleInteraction(interaction);
  } catch (err) {
    console.error(err);
    const msg = "❌ وقع خطأ غير متوقع. حاول مرة أخرى.";
    if (interaction.replied || interaction.deferred) await interaction.followUp({content:msg,ephemeral:true});
    else await interaction.reply({content:msg,ephemeral:true});
  }
});

client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.trim().startsWith("!")) return;

  try {
    const { handlePrefixMessage } = require("./game/quiz");
    await handlePrefixMessage(message);
  } catch (err) {
    console.error("Prefix command error:", err);
    await message.reply("❌ وقع خطأ أثناء تنفيذ الأمر.");
  }
});

registerCommands().then(() => client.login(process.env.DISCORD_TOKEN)).catch(console.error);
