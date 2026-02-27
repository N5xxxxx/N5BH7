const {
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  AudioPlayerStatus
} = require("@discordjs/voice");

const ytSearch = require("yt-search");
const ytdl = require("ytdl-core");

module.exports = (client) => {

  const player = createAudioPlayer();
  let queue = [];
  let currentGuildId = null;

  // لما البوت يجهز، اربط المشغل بالاتصال الصوتي
  client.once("clientReady", () => {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    const connection = getVoiceConnection(guild.id);
    if (connection) {
      connection.subscribe(player);
      currentGuildId = guild.id;
      console.log("🎵 Music system ready");
    }
  });

  async function playNext() {
    if (!currentGuildId) return;
    if (queue.length === 0) return;

    const song = queue.shift();

    try {
      const stream = ytdl(song.url, {
        filter: "audioonly",
        quality: "highestaudio",
        highWaterMark: 1 << 25
      });

      const resource = createAudioResource(stream);
      player.play(resource);

      console.log(`▶️ Now playing: ${song.title}`);

    } catch (err) {
      console.error("Music Error:", err);
      playNext();
    }
  }

  player.on(AudioPlayerStatus.Idle, () => {
    playNext();
  });

  player.on("error", (error) => {
    console.error("Player Error:", error);
    playNext();
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    // تشغيل
    if (message.content.startsWith("!mus ")) {
      const query = message.content.slice(5).trim();
      if (!query) return message.reply("❌ اكتب اسم الأغنية");

      const search = await ytSearch(query);
      const video = search.videos[0];

      if (!video) return message.reply("❌ ما لقيت نتيجة");

      queue.push({
        title: video.title,
        url: video.url
      });

      message.reply(`🎶 تمت الإضافة: **${video.title}**`);

      if (player.state.status !== AudioPlayerStatus.Playing) {
        playNext();
      }
    }

    // إيقاف
    if (message.content === "!stop") {
      queue = [];
      player.stop();
      message.reply("⏹ تم إيقاف الموسيقى");
    }

    // تخطي
    if (message.content === "!skip") {
      player.stop();
      message.reply("⏭ تم التخطي");
    }
  });

};
