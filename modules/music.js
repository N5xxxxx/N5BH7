const {
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  AudioPlayerStatus
} = require("@discordjs/voice");

const ytdl = require("ytdl-core");
const yts = require("yt-search");

module.exports = (client) => {

  const player = createAudioPlayer();
  const queue = [];

  async function playNext(guild) {
    if (queue.length === 0) return;

    const song = queue.shift();

    try {
      const stream = ytdl(song.url, {
        filter: "audioonly",
        quality: "highestaudio",
        highWaterMark: 1 << 25
      });

      const resource = createAudioResource(stream);

      const connection = getVoiceConnection(guild.id);
      if (!connection) return;

      connection.subscribe(player);
      player.play(resource);

      console.log("▶️ Playing:", song.title);

    } catch (err) {
      console.error("Music Error:", err);
    }
  }

  player.on(AudioPlayerStatus.Idle, () => {
    const guild = client.guilds.cache.first();
    if (guild) playNext(guild);
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    if (message.content.startsWith("!mus ")) {

      const query = message.content.slice(5).trim();
      if (!query) return message.reply("❌ اكتب اسم الأغنية");

      const result = await yts(query);
      const video = result.videos[0];

      if (!video)
        return message.reply("❌ ما لقيت نتيجة");

      queue.push({
        title: video.title,
        url: video.url
      });

      message.reply(`🎵 تمت الإضافة: ${video.title}`);

      if (player.state.status !== AudioPlayerStatus.Playing) {
        playNext(message.guild);
      }
    }

    if (message.content === "!stop") {
      queue.length = 0;
      player.stop();
      message.reply("⏹ تم الإيقاف");
    }

    if (message.content === "!skip") {
      player.stop();
      message.reply("⏭ تم التخطي");
    }

  });

};
