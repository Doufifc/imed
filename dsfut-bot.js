const axios = require("axios");
const crypto = require("crypto");
const TelegramBot = require("node-telegram-bot-api");

// ====== CONFIG من Environment Variables ======
const PARTNER_ID = process.env.PARTNER_ID;
const SECRET_KEY = process.env.SECRET_KEY;
const GAME_YEAR = process.env.GAME_YEAR || "26";
const CONSOLES = (process.env.CONSOLES || "ps").split(",");
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_OWNER_ID = process.env.TELEGRAM_OWNER_ID;
const TELEGRAM_GROUP_ID = process.env.TELEGRAM_GROUP_ID; // جديد

// ====== TELEGRAM BOT ======
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
let isRunning = false;

// Dynamic min/max
let dynamicMin = 20000;
let dynamicMax = 300000;

// ====== FUNCTIONS ======

// توليد signature
function getSignature(timestamp) {
  return crypto
    .createHash("md5")
    .update(PARTNER_ID + SECRET_KEY + timestamp)
    .digest("hex");
}

// تحويل expires لساعة/دقيقة/ثانية
function formatExpire(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

// فورمات رسالة التلغرام
function formatPlayer(p, consoleName) {
  return `🎮 Console: ${consoleName.toUpperCase()}
👤 Player: ${p.name} (${p.rating})
📍 Position: ${p.position}
💰 Start: ${p.startPrice}
⚡ Buy Now: ${p.buyNowPrice}
🔑 Trade ID: ${p.tradeID}
🕒 Expire: ${formatExpire(p.expires)}`;
}

// دالة تبعث للـ Owner و الـ Group
async function notifyAll(text) {
  try {
    await bot.sendMessage(TELEGRAM_OWNER_ID, text);
  } catch (e) {
    console.error("❌ Error sending to owner:", e.message);
  }

  try {
    if (TELEGRAM_GROUP_ID) {
      await bot.sendMessage(TELEGRAM_GROUP_ID, text);
    }
  } catch (e) {
    console.error("❌ Error sending to group:", e.message);
  }
}

// جلب لاعب من DSFUT
async function getPlayer(consoleName) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = getSignature(timestamp);
  const url = `https://dsfut.net/api/${GAME_YEAR}/${consoleName}/${PARTNER_ID}/${timestamp}/${signature}?min_buy=${dynamicMin}&max_buy=${dynamicMax}&take_after=3`;

  try {
    const res = await axios.get(url);
    if (res.data && res.data.player) {
      const msg = formatPlayer(res.data.player, consoleName);
      await notifyAll(msg);

      // بعد ما يهز Player → stop البوت تلقائياً
      isRunning = false;
      await notifyAll("🛑 Bot stopped automatically after taking the player.");
    } else if (res.data.error) {
      await notifyAll(`⚠️ Error: ${res.data.error}`);
    }
  } catch (err) {
    await notifyAll(`❌ Request failed on ${consoleName}: ${err.message}`);
  }
}

// Loop متاع البوت مع rotation
async function loop() {
  while (isRunning) {
    for (const consoleName of CONSOLES) {
      if (!isRunning) break; // باش ما يكملش بعد stop
      await getPlayer(consoleName);
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
}

// ====== أوامر Telegram ======
bot.onText(/\/start/, (msg) => {
  if (msg.chat.id.toString() !== TELEGRAM_OWNER_ID) return;
  if (!isRunning) {
    isRunning = true;
    notifyAll("✅ Bot started.");
    loop();
  } else {
    notifyAll("⚠️ Bot already running.");
  }
});

bot.onText(/\/stop/, (msg) => {
  if (msg.chat.id.toString() !== TELEGRAM_OWNER_ID) return;
  isRunning = false;
  notifyAll("🛑 Bot stopped.");
});

// تغيير min/max ديناميكي من Telegram
bot.onText(/\/setmin (\d+)/, (msg, match) => {
  if (msg.chat.id.toString() !== TELEGRAM_OWNER_ID) return;
  dynamicMin = parseInt(match[1], 10);
  notifyAll(`✅ Min buy updated: ${dynamicMin}`);
});

bot.onText(/\/setmax (\d+)/, (msg, match) => {
  if (msg.chat.id.toString() !== TELEGRAM_OWNER_ID) return;
  dynamicMax = parseInt(match[1], 10);
  notifyAll(`✅ Max buy updated: ${dynamicMax}`);
});

console.log("🤖 DSFUT Bot ready.");
