require("dotenv").config();
const axios = require("axios");
const crypto = require("crypto");
const TelegramBot = require("node-telegram-bot-api");

// ====== CONFIG ======
const PARTNER_ID = process.env.PARTNER_ID;
const SECRET_KEY = process.env.SECRET_KEY;
const GAME_YEAR = process.env.GAME_YEAR || "26";
const CONSOLES = (process.env.CONSOLES || "ps").split(",");
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_OWNER_ID = process.env.TELEGRAM_OWNER_ID;

// ====== TELEGRAM BOT ======
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
let isRunning = false;

// توليد signature
function getSignature(timestamp) {
  return crypto
    .createHash("md5")
    .update(PARTNER_ID + SECRET_KEY + timestamp)
    .digest("hex");
}

// جلب لاعب من DSFUT
async function getPlayer(consoleName) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = getSignature(timestamp);
  const url = `https://dsfut.net/api/${GAME_YEAR}/${consoleName}/${PARTNER_ID}/${timestamp}/${signature}?min_buy=10000&max_buy=50000&take_after=3`;

  try {
    const res = await axios.get(url);
    if (res.data && res.data.player) {
      const p = res.data.player;
      const msg = `
🎮 Console: ${consoleName.toUpperCase()}
👤 Player: ${p.name} (${p.rating})
📍 Position: ${p.position}
💰 Start: ${p.startPrice}
⚡ Buy Now: ${p.buyNowPrice}
🔑 Trade ID: ${p.tradeID}
🕒 Expire: ${p.expires} sec
`;
      await bot.sendMessage(TELEGRAM_OWNER_ID, msg);
    } else if (res.data.error) {
      await bot.sendMessage(TELEGRAM_OWNER_ID, `⚠️ Error: ${res.data.error}`);
    }
  } catch (err) {
    await bot.sendMessage(
      TELEGRAM_OWNER_ID,
      `❌ Request failed on ${consoleName}: ${err.message}`
    );
  }
}

// Loop متاع البوت
async function loop() {
  while (isRunning) {
    for (const consoleName of CONSOLES) {
      await getPlayer(consoleName);
      await new Promise((r) => setTimeout(r, 1200)); // باش ما نتخطاوش limit
    }
  }
}

// أوامر Telegram
bot.onText(/\/start/, (msg) => {
  if (msg.chat.id.toString() !== TELEGRAM_OWNER_ID) return;
  if (!isRunning) {
    isRunning = true;
    bot.sendMessage(TELEGRAM_OWNER_ID, "✅ Bot started.");
    loop();
  } else {
    bot.sendMessage(TELEGRAM_OWNER_ID, "⚠️ Bot already running.");
  }
});

bot.onText(/\/stop/, (msg) => {
  if (msg.chat.id.toString() !== TELEGRAM_OWNER_ID) return;
  isRunning = false;
  bot.sendMessage(TELEGRAM_OWNER_ID, "🛑 Bot stopped.");
});

console.log("🤖 DSFUT Bot ready.");
