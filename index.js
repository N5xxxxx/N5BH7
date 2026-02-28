process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot running");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("🌐 Web server is running");
});

const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`🛡️ BOT ONLINE AS ${client.user.tag}`);
});

/* ===========================
   🔊 VOICE SYSTEM
=========================== */

require("./modules/voice")(client);

/* ===========================
   🛡️ PROTECTION SYSTEM
=========================== */

require("./modules/protection")(client);

/* ===========================
   🔐 LOGIN
=========================== */

client.login(process.env.TOKEN);
