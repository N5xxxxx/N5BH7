const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");
const { ChannelType } = require("discord.js");

// عدلها لو غيرت الروم أو السيرفر
const GUILD_ID = "1367976354104086629";
const VOICE_CHANNEL_ID = "1401074295022817381";

module.exports = (client) => {

  client.once("clientReady", async () => {
    console.log(`🔥 ${client.user.tag} is online`);

    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      if (!guild) return console.log("❌ Guild not found");

      const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);
      if (!channel || channel.type !== ChannelType.GuildVoice) {
        return console.log("❌ Voice channel invalid");
      }

      // يمنع إعادة الاتصال إذا كان متصل
      const existing = getVoiceConnection(guild.id);
      if (existing) {
        console.log("✅ Already connected");
        return;
      }

      joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true
      });

      console.log("🎧 Connected to voice channel");

    } catch (err) {
      console.error("Voice Error:", err);
    }
  });

};
