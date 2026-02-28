process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot running");
});

app.listen(process.env.PORT || 3000);

const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log("🛡️ BOT IS ONLINE");
});

// 🔥 تفعيل الحماية
require("./modules/protection")(client);

client.login(process.env.TOKEN);
