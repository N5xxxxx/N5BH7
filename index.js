process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

client.once("ready", () => {
  console.log("BOT IS ONLINE");
});

require("./modules/voice")(client);
require("./modules/ai")(client);
require("./modules/protection")(client);

client.login(process.env.TOKEN);
