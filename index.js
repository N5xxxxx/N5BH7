const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// تحميل الأنظمة
require("./modules/voice")(client);
require("./modules/music")(client);
require("./modules/ai")(client);
require("./modules/protection")(client);

client.login(process.env.TOKEN);
