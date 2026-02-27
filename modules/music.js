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

  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
  });

  const queue = new Map();

  async function playSong(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
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

  player.on(AudioPlayerStatus.Idle, () => {
    const guildId = [...queue.keys()][0];
    if (!guildId) return;

    const serverQueue = queue.get(guildId);
    serverQueue.songs.shift();
    playSong(client.guilds.cache.get(guildId), serverQueue.songs[0]);
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    if (message.content.startsWith("!mus ")) {

      const voiceChannel = message.member.voice.channel;
      if (!voiceChannel)
        return message.reply("❌ ادخل روم صوتي أول");

      const query = message.content.slice(5).trim();
      if (!query)
        return message.reply("❌ اكتب اسم الأغنية");

      let results;

      try {
        results = await play.search(query, { source: { youtube: "video" }, limit: 1 });
      } catch (err) {
        return message.reply("❌ فشل البحث");
      }

      if (!results || results.length === 0 || !results[0].url)
        return message.reply("❌ ما لقيت نتيجة صالحة");

      const song = {
        title: results[0].title,
        url: results[0].url
      };

      let serverQueue = queue.get(message.guild.id);
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
          connection,
          songs: [],
        };
        queue.set(message.guild.id, serverQueue);
      }

      serverQueue.songs.push(song);

      message.reply(`🎵 تمت الإضافة: **${song.title}**`);

      if (serverQueue.songs.length === 1) {
        playSong(message.guild, song);
      }
    }

    if (message.content === "!stop") {
      const serverQueue = queue.get(message.guild.id);
      if (!serverQueue)
        return message.reply("❌ ما فيه شيء يشتغل");

      serverQueue.songs = [];
      player.stop();
      message.reply("⏹ تم الإيقاف");
    }

    if (message.content === "!skip") {
      const serverQueue = queue.get(message.guild.id);
      if (!serverQueue)
        return message.reply("❌ ما فيه شيء يشتغل");

      player.stop();
      message.reply("⏭ تم التخطي");
    }

  });

};
