const { 
  joinVoiceChannel, 
  getVoiceConnection, 
  VoiceConnectionStatus,
  entersState 
} = require('@discordjs/voice');

const GUILD_ID = "1367976354104086629";
const VOICE_CHANNEL_ID = "1401074295022817381";

module.exports = (client) => {

  async function connect() {
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);

      if (!channel) return;

      const existing = getVoiceConnection(guild.id);
      if (existing) return;

      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true
      });

      console.log("🎧 Connected to voice channel");

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        console.log("⚠️ Disconnected... Reconnecting");
        try {
          await entersState(connection, VoiceConnectionStatus.Connecting, 5000);
        } catch {
          connection.destroy();
          setTimeout(connect, 3000);
        }
      });

    } catch (err) {
      console.error("Voice error:", err);
    }
  }

  // أول ما يشتغل
  client.once("clientReady", () => {
    connect();
  });

  // لو أحد نقله أو طرده
  client.on("voiceStateUpdate", (oldState, newState) => {
    if (!client.user) return;

    if (oldState.id === client.user.id && !newState.channelId) {
      console.log("🚨 Bot was kicked. Rejoining...");
      setTimeout(connect, 2000);
    }
  });

};
