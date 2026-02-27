const {
  joinVoiceChannel,
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
      console.log("🎧 Voice Connected 24/7");
    } catch {
      setTimeout(connect, 5000);
    }
  }

  client.once("clientReady", () => {
    connect();
  });

};
