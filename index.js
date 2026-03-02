process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const express = require("express");
const app = express();

/* ===========================
   🌐 WEB SERVER (مهم للاستضافة)
=========================== */

app.get("/", (req, res) => {
  res.send("Bot is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

/* ===========================
   🤖 DISCORD BOT
=========================== */

const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`🟢 BOT ONLINE AS ${client.user.tag}`);
});

/* ===========================
   🔐 LOGIN
=========================== */

client.login(process.env.TOKEN);
