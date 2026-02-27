const {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  AudioPlayerStatus,
  NoSubscriberBehavior
} = require("@discordjs/voice");

const play = require("play-dl");

module.exports = (client) => {

  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Pause,
    },
  });

  const queue = new Map();

  async function playSong(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
      serverQueue.connection.destroy();
      queue.delete(guild.id);
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

    // تشغيل
    if (message.content.startsWith("!mus ")) {

      const voiceChannel = message.member.voice.channel;
      if (!voiceChannel)
        return message.reply("❌ لازم تدخل روم صوتي أولاً");

      const permissions = voiceChannel.permissionsFor(message.client.user);
      if (!permissions.has("Connect") || !permissions.has("Speak"))
        return message.reply("❌ ما عندي صلاحية دخول أو تكلم");

      const query = message.content.slice(5);

      const search = await play.search(query, { limit: 1 });
      if (!search.length)
        return message.reply("❌ ما لقيت الأغنية");

      const song = {
        title: search[0].title,
        url: search[0].url
      };

      let serverQueue = queue.get(message.guild.id);

      if (!serverQueue) {

        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: message.guild.id,
          adapterCreator: message.guild.voiceAdapterCreator,
        });

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

    // إيقاف
    if (message.content === "!stop") {
      const serverQueue = queue.get(message.guild.id);
      if (!serverQueue) return message.reply("❌ ما فيه شيء يشتغل");

      serverQueue.songs = [];
      player.stop();
      serverQueue.connection.destroy();
      queue.delete(message.guild.id);

      message.reply("⏹ تم إيقاف الموسيقى");
    }

    // تخطي
    if (message.content === "!skip") {
      const serverQueue = queue.get(message.guild.id);
      if (!serverQueue) return message.reply("❌ ما فيه شيء يشتغل");

      player.stop();
      message.reply("⏭ تم التخطي");
    }

  });

};
