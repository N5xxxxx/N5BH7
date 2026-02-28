process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Web server is running");
});

const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
  console.log("BOT IS ONLINE");
});

// ❌ عطلهم مؤقتًا
// require("./modules/voice")(client);
// require("./modules/ai")(client);
// require("./modules/protection")(client);

client.login(process.env.TOKEN);
