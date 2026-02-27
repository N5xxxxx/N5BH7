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
  let volume = 0.5;
  let boundGuildId = null;

  // ربط المشغل بالاتصال الصوتي الموجود (من voice.js)
  client.on("clientReady", () => {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    const connection = getVoiceConnection(guild.id);
    if (connection) {
      connection.subscribe(player);
      boundGuildId = guild.id;
      console.log("🎵 Music system ready");
    }
  });

  async function playNext() {
    if (!boundGuildId) return;
    if (queue.length === 0) return;

    const song = queue.shift();

    try {
      const stream = ytdl(song.url, {
        filter: "audioonly",
        quality: "highestaudio",
        highWaterMark: 1 << 25
      });

      const resource = createAudioResource(stream, { inlineVolume: true });
      resource.volume.setVolume(volume);

      player.play(resource);
      console.log(`▶️ Now playing: ${song.title}`);

    } catch (err) {
      console.error("Music Error:", err);
      playNext();
    }
  }

  // إذا خلصت الأغنية شغّل اللي بعدها
  player.on(AudioPlayerStatus.Idle, () => {
    playNext();
  });

  player.on("error", (error) => {
    console.error("Player Error:", error);
    playNext();
  });

  // أمر تشغيل
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    if (!message.content.startsWith("!mus ")) return;

    const query = message.content.slice(5).trim();
    if (!query) return message.reply("❌ اكتب اسم الأغنية بعد !mus");

    try {
      const search = await ytSearch(query);
      const video = search.videos[0];

      if (!video) {
        return message.reply("❌ ما لقيت الأغنية");
      }

      queue.push({
        title: video.title,
        url: video.url
      });

      message.reply(`🎶 تمت الإضافة للطابور: **${video.title}**`);

      if (player.state.status !== AudioPlayerStatus.Playing) {
        playNext();
      }

    } catch (err) {
      console.error("Search Error:", err);
      message.reply("⚠️ صار خطأ أثناء البحث");
    }
  });

  // أوامر التحكم
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    switch (message.content) {
      case "!stop":
        queue = [];
        player.stop();
        return message.reply("⏹ تم إيقاف الموسيقى");

      case "!skip":
        player.stop();
        return message.reply("⏭ تم التخطي");

      case "!volup":
        volume = Math.min(volume + 0.1, 2);
        return message.reply(`🔊 مستوى الصوت: ${Math.round(volume * 100)}%`);

      case "!voldown":
        volume = Math.max(volume - 0.1, 0);
        return message.reply(`🔉 مستوى الصوت: ${Math.round(volume * 100)}%`);
    }
  });

};
