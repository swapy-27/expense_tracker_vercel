const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

const BOT_TOKEN  = process.env.BOT_TOKEN;
const SHEET_ID   = process.env.SHEET_ID;
const GOOGLE_EMAIL      = process.env.GOOGLE_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");

const CATEGORIES = {
  Food:          ["zomato", "swiggy", "blinkit", "zepto", "pizza", "burger", "restaurant", "cafe", "lunch", "dinner", "breakfast", "chai", "coffee", "biryani"],
  Travel:        ["uber", "ola", "rapido", "metro", "bus", "auto", "travel", "petrol", "fuel", "cab", "train", "flight"],
  Shopping:      ["amazon", "flipkart", "myntra", "meesho", "clothes", "shoes", "shopping", "mall"],
  Entertainment: ["netflix", "hotstar", "prime", "spotify", "movie", "cinema", "game"],
  Health:        ["pharmacy", "medicine", "doctor", "gym", "hospital", "medical", "chemist"],
  Bills:         ["electricity", "water", "wifi", "internet", "rent", "recharge", "mobile", "dth"],
  Groceries:     ["dmart", "bigbasket", "grofers", "vegetables", "fruits", "milk", "grocery"],
};

function detectCategory(name) {
  const lower = name.toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORIES)) {
    if (words.some(w => lower.includes(w))) return cat;
  }
  return "Other";
}

function parseExpense(text) {
  const m1 = text.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/);
  const m2 = text.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  const m  = m1 || m2;
  if (!m) return null;
  const name   = isNaN(m[1]) ? m[1].trim() : m[2].trim();
  const amount = isNaN(m[1]) ? parseFloat(m[2]) : parseFloat(m[1]);
  if (!name || amount <= 0) return null;
  return { name, amount, category: detectCategory(name) };
}

async function getSheet() {
  const auth = new JWT({
    email: GOOGLE_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(SHEET_ID, auth);
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle["Expenses"];
  if (!sheet) {
    sheet = await doc.addSheet({ title: "Expenses", headerValues: ["Date", "Time", "Name", "Amount", "Category"] });
  }
  return sheet;
}

async function saveExpense(expense) {
  const sheet = await getSheet();
  const now   = new Date();
  await sheet.addRow({
    Date:     now.toISOString().split("T")[0],
    Time:     now.toTimeString().slice(0, 5),
    Name:     expense.name,
    Amount:   expense.amount,
    Category: expense.category,
  });
}

async function buildSummary(period) {
  const sheet = await getSheet();
  const rows  = await sheet.getRows();
  if (!rows.length) return "📭 No expenses yet!";

  const now   = new Date();
  const filtered = rows.filter(r => {
    const d = new Date(r.get("Date"));
    if (period === "today") return r.get("Date") === now.toISOString().split("T")[0];
    if (period === "week")  { const w = new Date(now); w.setDate(w.getDate()-7); return d >= w; }
    if (period === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  if (!filtered.length) return "📭 No expenses for this period!";

  const total = filtered.reduce((s, r) => s + parseFloat(r.get("Amount") || 0), 0);
  const byCat = {};
  filtered.forEach(r => { const c = r.get("Category"); byCat[c] = (byCat[c] || 0) + parseFloat(r.get("Amount") || 0); });

  const label = period === "today" ? "Today" : period === "week" ? "This Week" : "This Month";
  let msg = `📊 *${label}*\n\n💰 *Total: ₹${total.toLocaleString("en-IN")}*\n\n`;
  Object.entries(byCat).sort((a,b) => b[1]-a[1]).forEach(([cat, amt]) => {
    msg += `• ${cat}: ₹${amt.toLocaleString("en-IN")} (${Math.round(amt/total*100)}%)\n`;
  });
  msg += `\n_${filtered.length} transaction${filtered.length > 1 ? "s" : ""}_`;
  return msg;
}

async function reply(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("OK");

  const { message } = req.body;
  if (!message) return res.status(200).send("OK");

  const chatId = message.chat.id;
  const text   = (message.text || "").trim();

  try {
    if (text === "/start") {
      await reply(chatId,
        "👋 *Welcome to Expense Tracker!*\n\n" +
        "Log expenses like:\n• `Zomato 300`\n• `Uber 150`\n• `Amazon 999`\n\n" +
        "Commands:\n/summary — today\n/week — last 7 days\n/month — this month"
      );
    } else if (text === "/summary") {
      await reply(chatId, await buildSummary("today"));
    } else if (text === "/week") {
      await reply(chatId, await buildSummary("week"));
    } else if (text === "/month") {
      await reply(chatId, await buildSummary("month"));
    } else {
      const expense = parseExpense(text);
      if (expense) {
        await saveExpense(expense);
        await reply(chatId, `✅ *Saved!*\n\n📌 ${expense.name}\n💰 ₹${expense.amount}\n🏷️ ${expense.category}`);
      } else {
        await reply(chatId, "❓ Try: `Zomato 300` or `Uber 120`");
      }
    }
  } catch (err) {
    console.error(err);
    await reply(chatId, "⚠️ Error: " + err.message);
  }

  res.status(200).send("OK");
}
