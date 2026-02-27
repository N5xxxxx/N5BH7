const {
  joinVoiceChannel,
  getVoiceConnection,
  entersState,
  VoiceConnectionStatus
} = require("@discordjs/voice");

const GUILD_ID = "1367976354104086629";
const VOICE_CHANNEL_ID = "1401074295022817381";

module.exports = (client) => {

  async function connect() {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 20000);
      console.log("🎧 Connected & Stable");
    } catch (err) {
      console.log("⚠️ Reconnecting...");
      connection.destroy();
      setTimeout(connect, 5000);
    }
  }

  client.once("clientReady", async () => {
    await connect();
  });

  // 🔥 لو انفصل يرجع
  client.on("voiceStateUpdate", (oldState, newState) => {

    if (oldState.id === client.user.id && !newState.channelId) {
      console.log("⚠️ Disconnected, reconnecting...");
      setTimeout(connect, 3000);
    }

    // لو أحد نقله روم ثاني يرجعه
    if (
      newState.id === client.user.id &&
      newState.channelId !== VOICE_CHANNEL_ID
    ) {
      console.log("⚠️ Moved, returning...");
      connect();
    }

  });

};
