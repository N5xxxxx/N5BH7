const {
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  AudioPlayerStatus,
  StreamType
} = require("@discordjs/voice");

const ytdl = require("ytdl-core");
const yts = require("yt-search");

module.exports = (client) => {

  const player = createAudioPlayer();
  let queue = [];
  let isPlaying = false;

  async function playSong(guild, song) {
    try {
      const connection = getVoiceConnection(guild.id);
      if (!connection) {
        console.log("❌ No voice connection");
        return;
      }

      const stream = ytdl(song.url, {
        filter: "audioonly",
        quality: "highestaudio",
        highWaterMark: 1 << 25
      });

      const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary
      });

      connection.subscribe(player);
      player.play(resource);

      isPlaying = true;

      console.log("▶️ Now Playing:", song.title);

    } catch (err) {
      console.error("🔥 Play Error:", err);
      isPlaying = false;
    }
  }

  player.on(AudioPlayerStatus.Idle, () => {
    isPlaying = false;

    if (queue.length > 0) {
      const guild = client.guilds.cache.first();
      playSong(guild, queue.shift());
    }
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

      const song = {
        title: video.title,
        url: video.url
      };

      if (!isPlaying) {
        await playSong(message.guild, song);
        message.reply(`▶️ تم التشغيل: **${video.title}**`);
      } else {
        queue.push(song);
        message.reply(`🎵 تمت الإضافة للطابور: **${video.title}**`);
      }
    }

    if (message.content === "!stop") {
      queue = [];
      player.stop();
      isPlaying = false;
      message.reply("⏹ تم إيقاف الموسيقى");
    }

    if (message.content === "!skip") {
      player.stop();
      message.reply("⏭ تم التخطي");
    }

  });

};
