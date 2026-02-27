const {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  getVoiceConnection,
  AudioPlayerStatus,
  NoSubscriberBehavior
} = require("@discordjs/voice");

const play = require("play-dl");

module.exports = (client) => {

  // مشغل واحد عام
  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
  });

  // Queue لكل سيرفر
  const queue = new Map();

  async function playSong(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
      // لا نطلع من الروم إذا عندك voice.js ماسكه 24/7
      // بس نوقف التشغيل ونمسح الطابور
      player.stop();
      serverQueue.songs = [];
      return;
    }

    try {
      const stream = await play.stream(song.url);
      const resource = createAudioResource(stream.stream);

      player.play(resource);
      serverQueue.connection.subscribe(player);

      console.log(`▶️ Now Playing: ${song.title}`);

    } catch (error) {
      console.error("Play Error:", error);
      serverQueue.songs.shift();
      playSong(guild, serverQueue.songs[0]);
    }
  }

  // لما تخلص أغنية يشغل اللي بعدها
  player.on(AudioPlayerStatus.Idle, () => {
    const guildId = [...queue.keys()][0];
    if (!guildId) return;

    const serverQueue = queue.get(guildId);
    serverQueue.songs.shift();
    playSong(client.guilds.cache.get(guildId), serverQueue.songs[0]);
  });

  player.on("error", (err) => {
    console.error("Player Error:", err);
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    // ================= تشغيل =================
    if (message.content.startsWith("!mus ")) {

      const voiceChannel = message.member.voice.channel;
      if (!voiceChannel)
        return message.reply("❌ لازم تدخل روم صوتي أولاً");

      const permissions = voiceChannel.permissionsFor(message.client.user);
      if (!permissions.has("Connect") || !permissions.has("Speak"))
        return message.reply("❌ ما عندي صلاحية دخول أو تكلم");

      const query = message.content.slice(5).trim();
      if (!query) return message.reply("❌ اكتب اسم الأغنية");

      const results = await play.search(query, { limit: 1 });
      if (!results.length)
        return message.reply("❌ ما لقيت الأغنية");

      const song = {
        title: results[0].title,
        url: results[0].url
      };

      let serverQueue = queue.get(message.guild.id);

      // 🔥 هنا الحل المهم — لا نعيد join إذا موجود
      let connection = getVoiceConnection(message.guild.id);

      if (!connection) {
        connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: message.guild.id,
          adapterCreator: message.guild.voiceAdapterCreator,
        });
      }

      if (!serverQueue) {
        serverQueue = {
          voiceChannel,
          connection,
          songs: [],
        };
        queue.set(message.guild.id, serverQueue);
      }

      serverQueue.songs.push(song);

      message.reply(`🎵 تمت الإضافة: **${song.title}**`);

      if (serverQueue.songs.length === 1) {
        playSong(message.guild, serverQueue.songs[0]);
      }
    }

    // ================= إيقاف =================
    if (message.content === "!stop") {
      const serverQueue = queue.get(message.guild.id);
      if (!serverQueue)
        return message.reply("❌ ما فيه شيء يشتغل");

      serverQueue.songs = [];
      player.stop();

      message.reply("⏹ تم إيقاف الموسيقى");
    }

    // ================= تخطي =================
    if (message.content === "!skip") {
      const serverQueue = queue.get(message.guild.id);
      if (!serverQueue)
        return message.reply("❌ ما فيه شيء يشتغل");

      player.stop();
      message.reply("⏭ تم التخطي");
    }

  });

};
