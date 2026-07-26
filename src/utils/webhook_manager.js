const { WebhookClient } = require("discord.js");
const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "../../config/webhooks.json");
let config = { enabled: true, username: "🧠 Quiz Master", avatarURL: "" };

try {
  if (fs.existsSync(configPath)) {
    config = { ...config, ...JSON.parse(fs.readFileSync(configPath, "utf8")) };
  }
} catch (e) {
  console.error("Webhook config error:", e.message);
}

const cache = new Map();

function getChannelWebhook(channel) {
  if (!config.enabled || !channel?.isTextBased?.()) return null;
  if (cache.has(channel.id)) return cache.get(channel.id);

  const webhook = new WebhookClient({
    id: process.env.QUIZ_WEBHOOK_ID,
    token: process.env.QUIZ_WEBHOOK_TOKEN
  });

  if (!process.env.QUIZ_WEBHOOK_ID || !process.env.QUIZ_WEBHOOK_TOKEN) return null;
  cache.set(channel.id, webhook);
  return webhook;
}

async function sendAsWebhook(channel, payload = {}, style = "default") {
  const webhook = getChannelWebhook(channel);
  if (!webhook) return channel.send(payload);

  const styles = {
    default: { username: "🧠 Quiz Master", avatarURL: config.avatarURL || undefined },
    question: { username: "❓ Quiz Question", avatarURL: config.avatarURL || undefined },
    hint: { username: "💡 Hint Master", avatarURL: config.avatarURL || undefined },
    result: { username: "📊 Quiz Referee", avatarURL: config.avatarURL || undefined },
    winner: { username: "🏆 Quiz Champion", avatarURL: config.avatarURL || undefined },
    lobby: { username: "🏟️ Quiz Arena", avatarURL: config.avatarURL || undefined }
  };

  const identity = styles[style] || styles.default;
  return webhook.send({
    ...payload,
    username: payload.username || identity.username,
    avatarURL: payload.avatarURL || identity.avatarURL
  });
}

module.exports = { sendAsWebhook, getChannelWebhook, config };
