const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "../../config/shop.json");

function config() {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function listItems() {
  return Object.entries(config().items).map(([id, item]) => ({id, ...item}));
}

function getItem(id) {
  return config().items[id] ? {id, ...config().items[id]} : null;
}

function buy(user, itemId) {
  const item = getItem(itemId);
  if (!item) return {ok:false, reason:"العنصر غير موجود"};
  if ((user.coins || 0) < item.price) return {ok:false, reason:`خاصك ${item.price} 🪙، وعندك غير ${user.coins || 0}`};

  user.coins -= item.price;
  user.inventory = user.inventory || {};
  user.inventory[itemId] = (user.inventory[itemId] || 0) + 1;

  if (item.type === "hint_tokens") {
    user.hintTokens = (user.hintTokens || 0) + item.amount;
  }
  if (item.type === "badge") {
    user.badges = user.badges || [];
    if (!user.badges.includes(item.badge)) user.badges.push(item.badge);
  }
  if (item.type === "boost") {
    user.activeBoosts = user.activeBoosts || [];
    user.activeBoosts.push({
      itemId,
      multiplier: item.multiplier,
      expiresAt: Date.now() + item.durationHours * 3600000
    });
  }
  return {ok:true, item};
}

function inventory(user) {
  return {
    coins: user.coins || 0,
    hintTokens: user.hintTokens || 0,
    items: user.inventory || {},
    badges: user.badges || [],
    activeBoosts: (user.activeBoosts || []).filter(b => b.expiresAt > Date.now())
  };
}

module.exports = {config, listItems, getItem, buy, inventory};
