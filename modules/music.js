const {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  getVoiceConnection,
  AudioPlayerStatus,
  NoSubscriberBehavior
} = require("@discordjs/voice");

const yts = require("yt-search");
const play = require("play-dl");

module.exports = (client) => {

  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
  });

  const queue = new Map();

  async function playSong(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) return;

    try {
      const stream = await play.stream(song.url);
      const resource = createAudioResource(stream.stream);

      player.play(resource);
      serverQueue.connection.subscribe(player);

      console.log("▶️ Playing:", song.title);

    } catch (err) {
      console.error("PLAY ERROR:", err);
    }
  }

  player.on(AudioPlayerStatus.Idle, () => {
    const guildId = [...queue.keys()][0];
    if (!guildId) return;

    const serverQueue = queue.get(guildId);
    serverQueue.songs.shift();

    if (serverQueue.songs.length > 0) {
      playSong(client.guilds.cache.get(guildId), serverQueue.songs[0]);
    }
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    if (message.content.startsWith("!mus ")) {

      const voiceChannel = message.member.voice.channel;
      if (!voiceChannel)
        return message.reply("❌ ادخل روم صوتي أول");

      const query = message.content.slice(5).trim();

      // 🔥 نبحث باستخدام yt-search
      const result = await yts(query);
      const video = result.videos[0];

      if (!video || !video.url)
        return message.reply("❌ ما لقيت نتيجة");

      const song = {
        title: video.title,
        url: video.url
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
          songs: []
        };
        queue.set(message.guild.id, serverQueue);
      }

      serverQueue.songs.push(song);

      message.reply(`🎵 تمت الإضافة: ${song.title}`);

      if (serverQueue.songs.length === 1) {
        playSong(message.guild, song);
      }
    }

    if (message.content === "!stop") {
      const serverQueue = queue.get(message.guild.id);
      if (!serverQueue) return;

      serverQueue.songs = [];
      player.stop();
      message.reply("⏹ تم الإيقاف");
    }

    if (message.content === "!skip") {
      player.stop();
      message.reply("⏭ تم التخطي");
    }

  });

};
