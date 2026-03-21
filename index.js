const fs = require("fs");
const path = require("path");
const play = require("play-dl");

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require("discord.js");

const {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  entersState,
  VoiceConnectionStatus
} = require("@discordjs/voice");

const TOKEN = process.env.TOKEN;

const GUILD_ID = "1367976354104086629";
const VOICE_CHANNEL_ID = "1401074295022817381";

/* ✅ روم الفيديو */
const VIDEO_ROOM = "1477417977472090316";

/* ✅ روم الليدر بورد + رتبة التحكم */
const LEADERBOARD_CHANNEL_ID = "1484809257361870892";
const LEADERBOARD_ROLE_ID = "1426999940944756889";

/* ✅ تحديث تلقائي كل 5 ثواني */
const LEADERBOARD_UPDATE_INTERVAL = 5000;

/* ✅ إعدادات الموسيقى */
const MUSIC_RESULT_LIMIT = 5;
const MUSIC_SELECT_TIMEOUT = 60_000;

/* ✅ حالة النظام */
let mediaOnlyEnabled = true;

const LOG_SEND = "1367984035283996753";
const LOG_WARN = "1482927462168920186";
const LOG_WARNINGS = "1482927612627128516";
const LOG_DMALL = "1482927730050859080";
const LOG_CLEARWARN = "1482927958548287499";

/* WARN ROLES */
const WARN_ROLES = {
  1: "1482963105943126108",
  2: "1482963310860042300",
  3: "1482963374605340734",
  4: "1482963614775115837",
  5: "1482963685428433068",
  6: "1482963748267233412"
};

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "bot-data.json");

let saveTimeout = null;
let leaderboardInterval = null;
let leaderboardUpdating = false;

const activeVoiceSessions = new Map();
const pendingMusicSelections = new Map();
const musicStates = new Map();

const db = {
  warnings: {},
  leaderboard: {
    channelId: LEADERBOARD_CHANNEL_ID,
    messageId: null,
    users: {}
  }
};

function ensureDataFolder() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadDatabase() {
  try {
    ensureDataFolder();

    if (!fs.existsSync(DATA_FILE)) {
      saveDatabase();
      return;
    }

    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);

    db.warnings = parsed.warnings || {};
    db.leaderboard = {
      channelId: parsed.leaderboard?.channelId || LEADERBOARD_CHANNEL_ID,
      messageId: parsed.leaderboard?.messageId || null,
      users: parsed.leaderboard?.users || {}
    };
  } catch (error) {
    console.error("❌ Failed to load database:", error);
  }
}

function saveDatabase() {
  try {
    ensureDataFolder();
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
  } catch (error) {
    console.error("❌ Failed to save database:", error);
  }
}

function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    flushActiveVoiceSessions();
    saveDatabase();
  }, 500);
}

function getUserStats(userId) {
  if (!db.leaderboard.users[userId]) {
    db.leaderboard.users[userId] = {
      messages: 0,
      voiceMs: 0,
      lastMessageAt: null,
      updatedAt: Date.now()
    };
  }

  return db.leaderboard.users[userId];
}

function addMessageCount(userId) {
  const stats = getUserStats(userId);
  stats.messages += 1;
  stats.lastMessageAt = Date.now();
  stats.updatedAt = Date.now();
  scheduleSave();
}

function startVoiceSession(userId, channelId) {
  if (activeVoiceSessions.has(userId)) return;

  activeVoiceSessions.set(userId, {
    channelId,
    joinedAt: Date.now()
  });
}

function endVoiceSession(userId) {
  const session = activeVoiceSessions.get(userId);
  if (!session) return;

  const stats = getUserStats(userId);
  const elapsed = Date.now() - session.joinedAt;

  if (elapsed > 0) {
    stats.voiceMs += elapsed;
    stats.updatedAt = Date.now();
  }

  activeVoiceSessions.delete(userId);
  scheduleSave();
}

function moveVoiceSession(userId, newChannelId) {
  const session = activeVoiceSessions.get(userId);

  if (!session) {
    startVoiceSession(userId, newChannelId);
    return;
  }

  const stats = getUserStats(userId);
  const elapsed = Date.now() - session.joinedAt;

  if (elapsed > 0) {
    stats.voiceMs += elapsed;
  }

  activeVoiceSessions.set(userId, {
    channelId: newChannelId,
    joinedAt: Date.now()
  });

  stats.updatedAt = Date.now();
  scheduleSave();
}

function flushActiveVoiceSessions() {
  const now = Date.now();

  for (const [userId, session] of activeVoiceSessions.entries()) {
    const elapsed = now - session.joinedAt;
    if (elapsed <= 0) continue;

    const stats = getUserStats(userId);
    stats.voiceMs += elapsed;
    stats.updatedAt = now;

    activeVoiceSessions.set(userId, {
      channelId: session.channelId,
      joinedAt: now
    });
  }
}

function formatVoiceDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} دقيقة`;
  }

  return `${hours} ساعة • ${minutes} دقيقة`;
}

function sortLeaderboardEntries() {
  return Object.entries(db.leaderboard.users)
    .sort((a, b) => {
      const aData = a[1];
      const bData = b[1];

      if (bData.messages !== aData.messages) {
        return bData.messages - aData.messages;
      }

      return bData.voiceMs - aData.voiceMs;
    });
}

function buildLeaderboardEmbed(guild) {
  flushActiveVoiceSessions();

  const entries = sortLeaderboardEntries().slice(0, 10);

  const description = entries.length
    ? entries.map(([userId, data], index) => {
        return `**#${index + 1}** | <@${userId}>\n> **الرسائل:** \`${data.messages}\` | **الوقت الصوتي:** \`${formatVoiceDuration(data.voiceMs)}\``;
      }).join("\n\n")
    : "لا يوجد بيانات حتى الآن.";

  return new EmbedBuilder()
    .setColor("#000000")
    .setAuthor({
      name: `${guild.name} Leaderboard`,
      iconURL: guild.iconURL({ dynamic: true }) || undefined
    })
    .setTitle(" Leaderboards for N5BH ")
    .setDescription(description)
    .addFields({
      name: "🕒 آخر تحديث",
      value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
      inline: true
    })
    .setFooter({
      text: "يتحدث تلقائيًا كل 5 ثواني"
    })
    .setTimestamp();
}

async function ensureLeaderboardMessage(guild) {
  const channel = guild.channels.cache.get(db.leaderboard.channelId);
  if (!channel || !channel.isTextBased()) return null;

  if (db.leaderboard.messageId) {
    try {
      const existingMessage = await channel.messages.fetch(db.leaderboard.messageId);
      return existingMessage;
    } catch {
      db.leaderboard.messageId = null;
      saveDatabase();
    }
  }

  const embed = buildLeaderboardEmbed(guild);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("تحديث الليدر بورد")
      .setStyle(ButtonStyle.Secondary)
      .setCustomId("leaderboard_refresh")
  );

  const newMessage = await channel.send({
    embeds: [embed],
    components: [row]
  });

  db.leaderboard.messageId = newMessage.id;
  saveDatabase();

  return newMessage;
}

async function updateLeaderboardMessage(guild) {
  if (leaderboardUpdating) return;
  leaderboardUpdating = true;

  try {
    const channel = guild.channels.cache.get(db.leaderboard.channelId);
    if (!channel || !channel.isTextBased()) {
      leaderboardUpdating = false;
      return;
    }

    const message = await ensureLeaderboardMessage(guild);
    if (!message) {
      leaderboardUpdating = false;
      return;
    }

    const embed = buildLeaderboardEmbed(guild);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("تحديث الليدر بورد")
        .setStyle(ButtonStyle.Secondary)
        .setCustomId("leaderboard_refresh")
    );

    await message.edit({
      embeds: [embed],
      components: [row]
    });

    saveDatabase();
  } catch (error) {
    console.error("❌ Failed to update leaderboard:", error);
  } finally {
    leaderboardUpdating = false;
  }
}

function hasLeaderboardRole(member) {
  return member.roles.cache.has(LEADERBOARD_ROLE_ID);
}

function warningMapGet(userId) {
  return db.warnings[userId] || null;
}

function warningMapSet(userId, value) {
  db.warnings[userId] = value;
  scheduleSave();
}

function warningMapDelete(userId) {
  delete db.warnings[userId];
  scheduleSave();
}

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(seconds)) return "غير معروف";

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function truncate(text, max = 90) {
  if (!text) return "بدون عنوان";
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function getMusicState(guildId) {
  if (musicStates.has(guildId)) {
    return musicStates.get(guildId);
  }

  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Pause
    }
  });

  const state = {
    player,
    queue: [],
    current: null,
    connection: null,
    textChannelId: null,
    voiceChannelId: null,
    allowedChannelId: null,
    isPlaying: false
  };

  player.on(AudioPlayerStatus.Idle, async () => {
    state.isPlaying = false;
    state.current = null;
    await playNextTrack(guildId);
  });

  player.on("error", async (error) => {
    console.error("❌ Music player error:", error);
    state.isPlaying = false;
    state.current = null;

    const guild = client.guilds.cache.get(guildId);
    if (guild && state.textChannelId) {
      const textChannel = guild.channels.cache.get(state.textChannelId);
      if (textChannel && textChannel.isTextBased()) {
        textChannel.send("❌ صار خطأ أثناء تشغيل المقطع، انتقلت للمقطع اللي بعده.").catch(() => {});
      }
    }

    await playNextTrack(guildId);
  });

  musicStates.set(guildId, state);
  return state;
}

async function joinBaseVoiceChannel(guild) {
  const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);
  if (!channel || !channel.isVoiceBased()) return null;

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
  } catch {}

  const state = getMusicState(guild.id);
  state.connection = connection;
  state.allowedChannelId = null;
  state.voiceChannelId = channel.id;
  state.connection.subscribe(state.player);

  return connection;
}

async function connectToVoiceChannel(voiceChannel, textChannelId) {
  const state = getMusicState(voiceChannel.guild.id);

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: true
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

  state.connection = connection;
  state.voiceChannelId = voiceChannel.id;
  state.allowedChannelId = voiceChannel.id;
  state.textChannelId = textChannelId;
  state.connection.subscribe(state.player);

  return state;
}

async function playNextTrack(guildId) {
  const guild = client.guilds.cache.get(guildId);
  const state = getMusicState(guildId);

  if (!guild) return;

  if (state.queue.length === 0) {
    await joinBaseVoiceChannel(guild).catch(() => {});
    return;
  }

  const track = state.queue.shift();
  state.current = track;
  state.isPlaying = true;

  try {
    if (!state.connection || state.voiceChannelId !== track.voiceChannelId) {
      const voiceChannel = guild.channels.cache.get(track.voiceChannelId);
      if (!voiceChannel || !voiceChannel.isVoiceBased()) {
        state.current = null;
        state.isPlaying = false;
        return playNextTrack(guildId);
      }

      await connectToVoiceChannel(voiceChannel, track.textChannelId);
    }

    const stream = await play.stream(track.url);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type
    });

    state.player.play(resource);

    const textChannel = guild.channels.cache.get(track.textChannelId);
    if (textChannel && textChannel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor("#000000")
        .setTitle("🎶 يتم الآن التشغيل")
        .setDescription(`**[${truncate(track.title, 120)}](${track.url})**`)
        .addFields(
          {
            name: "👤 بواسطة",
            value: `<@${track.requestedBy}>`,
            inline: true
          },
          {
            name: "⏱ المدة",
            value: track.duration || "غير معروف",
            inline: true
          },
          {
            name: "🎧 الروم",
            value: `<#${track.voiceChannelId}>`,
            inline: true
          }
        )
        .setThumbnail(track.thumbnail || null)
        .setFooter({
          text: "YouTube Music Search"
        })
        .setTimestamp();

      textChannel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (error) {
    console.error("❌ Failed to play track:", error);
    state.current = null;
    state.isPlaying = false;
    await playNextTrack(guildId);
  }
}

async function queueTrack(guild, textChannelId, voiceChannelId, track) {
  const state = getMusicState(guild.id);

  state.queue.push({
    ...track,
    textChannelId,
    voiceChannelId
  });

  if (!state.isPlaying && !state.current) {
    await playNextTrack(guild.id);
  }
}

function buildQueueEmbed(guildId) {
  const state = getMusicState(guildId);

  const currentLine = state.current
    ? `**الآن:** [${truncate(state.current.title, 70)}](${state.current.url}) - <@${state.current.requestedBy}>`
    : "لا يوجد شيء يعمل الآن.";

  const queueLines = state.queue.length
    ? state.queue.slice(0, 10).map((track, index) => {
        return `**${index + 1}.** [${truncate(track.title, 60)}](${track.url}) - <@${track.requestedBy}>`;
      }).join("\n")
    : "القائمة فارغة.";

  return new EmbedBuilder()
    .setColor("#000000")
    .setTitle("🎵 قائمة التشغيل")
    .addFields(
      {
        name: "Now Playing",
        value: currentLine
      },
      {
        name: "Queue",
        value: queueLines
      }
    )
    .setTimestamp();
}

function makeSearchResultsEmbed(query, results, user) {
  const description = results.map((video, index) => {
    return `**${index + 1}.** ${truncate(video.title, 80)}\n> المدة: \`${video.durationRaw || "غير معروف"}\``;
  }).join("\n\n");

  return new EmbedBuilder()
    .setColor("#000000")
    .setTitle("🔎 نتائج البحث")
    .setDescription(description)
    .addFields(
      {
        name: "🎵 البحث",
        value: query
      },
      {
        name: "👤 الطلب بواسطة",
        value: `<@${user.id}>`,
        inline: true
      }
    )
    .setFooter({
      text: "اختر الأغنية من القائمة بالأسفل"
    })
    .setTimestamp();
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const commands = [
  new SlashCommandBuilder()
    .setName("send")
    .setDescription("ارسال رسالة بالخاص")
    .addUserOption(o => o.setName("user").setDescription("الشخص").setRequired(true))
    .addStringOption(o => o.setName("message").setDescription("الرسالة").setRequired(true)),

  new SlashCommandBuilder()
    .setName("dmall")
    .setDescription("ارسال رسالة لكل السيرفر")
    .addStringOption(o => o.setName("message").setDescription("الرسالة").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("تحذير عضو")
    .addUserOption(o => o.setName("user").setDescription("الشخص").setRequired(true))
    .addIntegerOption(o =>
      o.setName("level")
        .setDescription("رقم الوارن")
        .setRequired(true)
        .addChoices(
          { name: "Warn 1", value: 1 },
          { name: "Warn 2", value: 2 },
          { name: "Warn 3", value: 3 },
          { name: "Warn 4", value: 4 },
          { name: "Warn 5", value: 5 },
          { name: "Warn 6", value: 6 }
        )
    )
    .addStringOption(o => o.setName("reason").setDescription("السبب").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("عرض تحذيرات عضو")
    .addUserOption(o => o.setName("user").setDescription("الشخص").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarnings")
    .setDescription("مسح التحذيرات")
    .addUserOption(o => o.setName("user").setDescription("الشخص").setRequired(true)),

  new SlashCommandBuilder()
    .setName("mediaonly")
    .setDescription("تشغيل او ايقاف نظام الصور فقط"),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("نظام الليدر بورد")
    .addStringOption(o =>
      o.setName("action")
        .setDescription("نوع العملية")
        .setRequired(true)
        .addChoices(
          { name: "setup", value: "setup" },
          { name: "refresh", value: "refresh" },
          { name: "stats", value: "stats" }
        )
    )
    .addUserOption(o =>
      o.setName("user")
        .setDescription("عضو معين لعرض احصائياته")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("play")
    .setDescription("تشغيل اغنية من يوتيوب عبر البحث")
    .addStringOption(o =>
      o.setName("query")
        .setDescription("اسم الأغنية")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("skip")
    .setDescription("تخطي الأغنية الحالية"),

  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("إيقاف الموسيقى وتصفير القائمة"),

  new SlashCommandBuilder()
    .setName("pause")
    .setDescription("إيقاف مؤقت"),

  new SlashCommandBuilder()
    .setName("resume")
    .setDescription("استكمال التشغيل"),

  new SlashCommandBuilder()
    .setName("queue")
    .setDescription("عرض قائمة التشغيل")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  loadDatabase();

  await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    { body: commands }
  );

  console.log("✅ Commands Registered");

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  await joinBaseVoiceChannel(guild).catch(() => {});

  guild.voiceStates.cache.forEach(state => {
    if (!state.member) return;
    if (state.member.user.bot) return;
    if (!state.channelId) return;

    startVoiceSession(state.id, state.channelId);
  });

  await ensureLeaderboardMessage(guild);
  await updateLeaderboardMessage(guild);

  if (leaderboardInterval) clearInterval(leaderboardInterval);
  leaderboardInterval = setInterval(() => {
    updateLeaderboardMessage(guild).catch(() => {});
  }, LEADERBOARD_UPDATE_INTERVAL);
});

client.on("messageCreate", async (message) => {
  if (!message.guild || message.guild.id !== GUILD_ID) return;
  if (message.author.bot) return;

  addMessageCount(message.author.id);

  if (!mediaOnlyEnabled) return;
  if (message.channel.id !== VIDEO_ROOM) return;

  if (message.attachments.size === 0) {
    return message.delete().catch(() => {});
  }

  if (message.content && message.content.trim() !== "") {
    return message.delete().catch(() => {});
  }
});

function sendLog(interaction, channelId, embed, row) {
  const channel = interaction.guild.channels.cache.get(channelId);

  if (channel) {
    channel.send({
      embeds: [embed],
      components: row ? [row] : []
    }).catch(() => {});
  }
}

client.on("interactionCreate", async interaction => {
  if (interaction.isButton()) {
    if (interaction.customId !== "leaderboard_refresh") return;

    if (!interaction.member || !hasLeaderboardRole(interaction.member)) {
      return interaction.reply({
        content: "❌ ما عندك صلاحية استخدام زر التحديث.",
        ephemeral: true
      });
    }

    await updateLeaderboardMessage(interaction.guild);

    return interaction.reply({
      content: "✅ تم تحديث الليدر بورد.",
      ephemeral: true
    });
  }

if (interaction.isStringSelectMenu()) {
  if (!interaction.customId.startsWith("music_select_")) return;

  const selection = pendingMusicSelections.get(interaction.customId);

  if (!selection) {
    return interaction.reply({
      content: "❌ انتهت صلاحية القائمة، أعد كتابة الأمر /play",
      ephemeral: true
    });
  }

  if (selection.userId !== interaction.user.id) {
    return interaction.reply({
      content: "❌ هذه القائمة ليست لك.",
      ephemeral: true
    });
  }

  const selectedIndex = Number(interaction.values[0]);
  const selectedTrack = selection.results[selectedIndex];

  if (!selectedTrack) {
    return interaction.reply({
      content: "❌ الاختيار غير صالح.",
      ephemeral: true
    });
  }

  pendingMusicSelections.delete(interaction.customId);

  try {
    await interaction.deferUpdate();

    await queueTrack(
      interaction.guild,
      interaction.channel.id,
      selection.voiceChannelId,
      {
        title: selectedTrack.title,
        url: selectedTrack.url,
        duration: selectedTrack.durationRaw || "غير معروف",
        thumbnail: selectedTrack.thumbnails?.[0]?.url || null,
        requestedBy: interaction.user.id
      }
    );

    const embed = new EmbedBuilder()
      .setColor("#000000")
      .setTitle("➕ تمت الإضافة للقائمة")
      .setDescription(`**[${truncate(selectedTrack.title, 120)}](${selectedTrack.url})**`)
      .addFields(
        {
          name: "👤 بواسطة",
          value: `<@${interaction.user.id}>`,
          inline: true
        },
        {
          name: "⏱ المدة",
          value: selectedTrack.durationRaw || "غير معروف",
          inline: true
        }
      )
      .setThumbnail(selectedTrack.thumbnails?.[0]?.url || null)
      .setTimestamp();

    await interaction.editReply({
      content: `✅ تم اختيار الأغنية: **${truncate(selectedTrack.title, 100)}**`,
      embeds: [embed],
      components: []
    });
  } catch (error) {
    console.error("❌ Music select error:", error);

    try {
      await interaction.editReply({
        content: "❌ صار خطأ أثناء اختيار أو تشغيل الأغنية.",
        embeds: [],
        components: []
      });
    } catch {}
  }

  return;
}

    if (!interaction.customId.startsWith("music_select_")) return;

    const selection = pendingMusicSelections.get(interaction.customId);

    if (!selection) {
      return interaction.reply({
        content: "❌ انتهت صلاحية القائمة، أعد كتابة الأمر `/play`.",
        ephemeral: true
      });
    }

    if (selection.userId !== interaction.user.id) {
      return interaction.reply({
        content: "❌ هذه القائمة ليست لك.",
        ephemeral: true
      });
    }

    const selectedIndex = Number(interaction.values[0]);
    const selectedTrack = selection.results[selectedIndex];

    if (!selectedTrack) {
      return interaction.reply({
        content: "❌ الاختيار غير صالح.",
        ephemeral: true
      });
    }

    pendingMusicSelections.delete(interaction.customId);

    await queueTrack(
      interaction.guild,
      interaction.channel.id,
      selection.voiceChannelId,
      {
        title: selectedTrack.title,
        url: selectedTrack.url,
        duration: selectedTrack.durationRaw || "غير معروف",
        thumbnail: selectedTrack.thumbnails?.[0]?.url || null,
        requestedBy: interaction.user.id
      }
    );

    const disabledMenu = new ActionRowBuilder().addComponents(
      StringSelectMenuBuilder.from(interaction.component).setDisabled(true)
    );

    await interaction.update({
      content: `✅ تم اختيار: **${truncate(selectedTrack.title, 100)}**`,
      embeds: [],
      components: [disabledMenu]
    });

    const embed = new EmbedBuilder()
      .setColor("#000000")
      .setTitle("➕ تمت الإضافة للقائمة")
      .setDescription(`**[${truncate(selectedTrack.title, 120)}](${selectedTrack.url})**`)
      .addFields(
        {
          name: "👤 بواسطة",
          value: `<@${interaction.user.id}>`,
          inline: true
        },
        {
          name: "⏱ المدة",
          value: selectedTrack.durationRaw || "غير معروف",
          inline: true
        }
      )
      .setThumbnail(selectedTrack.thumbnails?.[0]?.url || null)
      .setTimestamp();

    return interaction.followUp({
      embeds: [embed]
    });
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const user = interaction.user;

  if (interaction.commandName === "mediaonly") {
    mediaOnlyEnabled = !mediaOnlyEnabled;

    return interaction.reply({
      content: mediaOnlyEnabled ? "✅ تم تشغيل النظام" : "❌ تم ايقاف النظام",
      ephemeral: true
    });
  }

  if (interaction.commandName === "leaderboard") {
    if (!interaction.member || !hasLeaderboardRole(interaction.member)) {
      return interaction.reply({
        content: `❌ هذا الأمر يحتاج رتبة <@&${LEADERBOARD_ROLE_ID}>`,
        ephemeral: true
      });
    }

    const action = interaction.options.getString("action");
    const targetUser = interaction.options.getUser("user") || user;

    if (action === "setup") {
      db.leaderboard.channelId = LEADERBOARD_CHANNEL_ID;
      db.leaderboard.messageId = null;
      saveDatabase();

      const msg = await ensureLeaderboardMessage(interaction.guild);
      await updateLeaderboardMessage(interaction.guild);

      return interaction.reply({
        content: msg
          ? `✅ تم إنشاء الليدر بورد في <#${LEADERBOARD_CHANNEL_ID}>`
          : "❌ ما قدرت أنشئ رسالة الليدر بورد.",
        ephemeral: true
      });
    }

    if (action === "refresh") {
      await updateLeaderboardMessage(interaction.guild);

      return interaction.reply({
        content: `✅ تم تحديث الليدر بورد في <#${LEADERBOARD_CHANNEL_ID}>`,
        ephemeral: true
      });
    }

    if (action === "stats") {
      flushActiveVoiceSessions();

      const stats = getUserStats(targetUser.id);

      const embed = new EmbedBuilder()
        .setColor("#000000")
        .setAuthor({
          name: "Member Activity Stats",
          iconURL: targetUser.displayAvatarURL()
        })
        .setTitle(`📊 احصائيات ${targetUser.username}`)
        .setDescription(`<@${targetUser.id}>`)
        .addFields(
          {
            name: "💬 عدد الرسائل",
            value: `${stats.messages}`,
            inline: true
          },
          {
            name: "🎤 الوقت الصوتي",
            value: formatVoiceDuration(stats.voiceMs),
            inline: true
          },
          {
            name: "🕒 آخر تحديث",
            value: stats.updatedAt
              ? `<t:${Math.floor(stats.updatedAt / 1000)}:R>`
              : "غير متوفر",
            inline: true
          }
        )
        .setFooter({
          text: interaction.guild.name
        })
        .setTimestamp();

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }
  }

  if (interaction.commandName === "play") {
    const memberVoiceChannel = interaction.member.voice?.channel;
    const query = interaction.options.getString("query");

    if (!memberVoiceChannel || !memberVoiceChannel.isVoiceBased()) {
      return interaction.reply({
        content: "❌ ادخل روم صوتي أول ثم استخدم الأمر.",
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      const results = await play.search(query, {
        limit: MUSIC_RESULT_LIMIT,
        source: { youtube: "video" }
      });

      const videos = results.filter(video => video && video.url).slice(0, MUSIC_RESULT_LIMIT);

      if (!videos.length) {
        return interaction.editReply({
          content: "❌ ما لقيت نتائج مناسبة."
        });
      }

      const customId = `music_select_${interaction.id}`;

      pendingMusicSelections.set(customId, {
        userId: interaction.user.id,
        voiceChannelId: memberVoiceChannel.id,
        results: videos,
        createdAt: Date.now()
      });

      setTimeout(() => {
        pendingMusicSelections.delete(customId);
      }, MUSIC_SELECT_TIMEOUT);

      const embed = makeSearchResultsEmbed(query, videos, interaction.user);

      const menu = new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder("اختر الأغنية التي تريد تشغيلها")
        .addOptions(
          videos.map((video, index) => ({
            label: truncate(video.title, 100),
            description: `المدة: ${video.durationRaw || "غير معروف"}`,
            value: String(index)
          }))
        );

      const row = new ActionRowBuilder().addComponents(menu);

      return interaction.editReply({
        embeds: [embed],
        components: [row]
      });
    } catch (error) {
      console.error("❌ Search error:", error);

      return interaction.editReply({
        content: "❌ صار خطأ أثناء البحث في يوتيوب."
      });
    }
  }

  if (interaction.commandName === "skip") {
    const state = getMusicState(interaction.guild.id);

    if (!state.current) {
      return interaction.reply({
        content: "❌ ما فيه شيء شغال الآن.",
        ephemeral: true
      });
    }

    state.player.stop(true);

    return interaction.reply({
      content: "⏭ تم تخطي الأغنية."
    });
  }

  if (interaction.commandName === "stop") {
    const state = getMusicState(interaction.guild.id);
    state.queue = [];
    state.current = null;
    state.isPlaying = false;
    state.player.stop(true);

    await joinBaseVoiceChannel(interaction.guild).catch(() => {});

    return interaction.reply({
      content: "⏹ تم إيقاف الموسيقى وتصفير القائمة."
    });
  }

  if (interaction.commandName === "pause") {
    const state = getMusicState(interaction.guild.id);

    if (!state.current) {
      return interaction.reply({
        content: "❌ ما فيه شيء شغال الآن.",
        ephemeral: true
      });
    }

    state.player.pause();

    return interaction.reply({
      content: "⏸ تم إيقاف الأغنية مؤقتًا."
    });
  }

  if (interaction.commandName === "resume") {
    const state = getMusicState(interaction.guild.id);

    if (!state.current) {
      return interaction.reply({
        content: "❌ ما فيه شيء شغال الآن.",
        ephemeral: true
      });
    }

    state.player.unpause();

    return interaction.reply({
      content: "▶ تم استكمال التشغيل."
    });
  }

  if (interaction.commandName === "queue") {
    const embed = buildQueueEmbed(interaction.guild.id);

    return interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  if (interaction.commandName === "send") {
    const target = interaction.options.getUser("user");
    const message = interaction.options.getString("message");

    try {
      await target.send(`${message}\n\n<@${target.id}>`);

      await interaction.reply({
        content: "تم إرسال الرسالة بنجاح",
        ephemeral: true
      });

      const embed = new EmbedBuilder()
        .setColor("#2ecc71")
        .setAuthor({
          name: "📩 Send Command Used",
          iconURL: user.displayAvatarURL()
        })
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: "👤 المرسل", value: `<@${user.id}>`, inline: true },
          { name: "🆔 ID المرسل", value: user.id, inline: true },
          { name: "📨 المستلم", value: `<@${target.id}>`, inline: true },
          { name: "🆔 ID المستلم", value: target.id, inline: true },
          { name: "💬 محتوى الرسالة", value: message },
          { name: "📍 الروم", value: `<#${interaction.channel.id}>`, inline: true },
          { name: "🖥 السيرفر", value: interaction.guild.name, inline: true },
          { name: "📊 الحالة", value: "✅ تم الإرسال", inline: true }
        )
        .setTimestamp()
        .setFooter({
          text: `Server ID: ${interaction.guild.id}`
        });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("فتح بروفايل المرسل")
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/users/${user.id}`)
      );

      sendLog(interaction, LOG_SEND, embed, row);
    } catch {
      return interaction.reply({
        content: "ما قدرت أرسل له خاص",
        ephemeral: true
      });
    }
  }

  if (interaction.commandName === "dmall") {
    const message = interaction.options.getString("message");

    await interaction.reply({
      content: "⏳ جاري إرسال الرسالة للأعضاء...",
      ephemeral: true
    });

    let success = 0;
    let failed = 0;

    const members = await interaction.guild.members.fetch();

    for (const [, member] of members) {
      if (member.user.bot) continue;

      try {
        await member.send(`${message}\n\n<@${member.id}>`);
        success++;
      } catch {
        failed++;
      }
    }

    const embed = new EmbedBuilder()
      .setColor("#3498db")
      .setTitle("📨 DM All Used")
      .addFields(
        { name: "🛡 بواسطة", value: `<@${user.id}>`, inline: true },
        { name: "✅ تم الإرسال", value: `${success}`, inline: true },
        { name: "❌ فشل", value: `${failed}`, inline: true },
        { name: "💬 الرسالة", value: message }
      )
      .setTimestamp();

    sendLog(interaction, LOG_DMALL, embed);

    return interaction.editReply({
      content: `✅ انتهى الإرسال\nنجح: ${success}\nفشل: ${failed}`
    });
  }

  if (interaction.commandName === "warn") {
    const target = interaction.options.getMember("user");
    const level = interaction.options.getInteger("level");
    const reason = interaction.options.getString("reason");

    if (!target) {
      return interaction.reply({
        content: "❌ ما قدرت أحدد العضو.",
        ephemeral: true
      });
    }

    warningMapSet(target.id, {
      level,
      reason,
      moderator: user.id,
      time: Date.now(),
      channel: interaction.channel.id
    });

    for (const role of Object.values(WARN_ROLES)) {
      if (target.roles.cache.has(role)) {
        await target.roles.remove(role).catch(() => {});
      }
    }

    const roleId = WARN_ROLES[level];

    await target.roles.add(roleId).catch(() => {});

    if (level === 4) {
      await target.kick(reason).catch(() => {});
    }

    if (level === 6) {
      await target.ban({ reason }).catch(() => {});
    }

    const embed = new EmbedBuilder()
      .setColor("#e67e22")
      .setTitle("⚠ Warn Added")
      .addFields(
        { name: "👤 المستخدم", value: `<@${target.id}>`, inline: true },
        { name: "🆔 ID", value: target.id, inline: true },
        { name: "🚨 المستوى", value: `Warn ${level}`, inline: true },
        { name: "⚠ السبب", value: reason },
        { name: "🛡 المشرف", value: `<@${user.id}>`, inline: true },
        { name: "📍 الروم", value: `<#${interaction.channel.id}>`, inline: true },
        { name: "🖥 السيرفر", value: interaction.guild.name, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    sendLog(interaction, LOG_WARN, embed);
  }

  if (interaction.commandName === "warnings") {
    const target = interaction.options.getUser("user");
    const data = warningMapGet(target.id);

    if (!data) {
      return interaction.reply({
        content: "لا يوجد تحذيرات لهذا المستخدم",
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor("#f1c40f")
      .setTitle("⚠ Warnings List")
      .addFields(
        { name: "👤 المستخدم", value: `<@${target.id}>`, inline: true },
        { name: "🆔 ID", value: target.id, inline: true },
        { name: "🚨 المستوى", value: `Warn ${data.level}`, inline: true },
        { name: "⚠ السبب", value: data.reason },
        { name: "🛡 المشرف", value: `<@${data.moderator}>`, inline: true },
        { name: "📍 الروم", value: `<#${data.channel}>`, inline: true },
        { name: "🕒 وقت التحذير", value: `<t:${Math.floor(data.time / 1000)}:F>` }
      )
      .setTimestamp()
      .setFooter({ text: interaction.guild.name });

    await interaction.reply({ embeds: [embed] });

    sendLog(interaction, LOG_WARNINGS, embed);
  }

  if (interaction.commandName === "clearwarnings") {
    const target = interaction.options.getMember("user");

    if (!target) {
      return interaction.reply({
        content: "❌ ما قدرت أحدد العضو.",
        ephemeral: true
      });
    }

    warningMapDelete(target.id);

    for (const role of Object.values(WARN_ROLES)) {
      if (target.roles.cache.has(role)) {
        await target.roles.remove(role).catch(() => {});
      }
    }

    await interaction.reply({
      content: "تم مسح التحذيرات",
      ephemeral: true
    });

    const embed = new EmbedBuilder()
      .setColor("#2ecc71")
      .setTitle("🧹 Warnings Cleared")
      .addFields(
        { name: "👤 المستخدم", value: `<@${target.id}>` },
        { name: "🛡 بواسطة", value: `<@${user.id}>` }
      )
      .setTimestamp();

    sendLog(interaction, LOG_CLEARWARN, embed);
  }
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  const data = warningMapGet(newMember.id);
  if (!data) return;

  const warnRole = WARN_ROLES[data.level];
  if (!warnRole) return;

  const hadRole = oldMember.roles.cache.has(warnRole);
  const hasRole = newMember.roles.cache.has(warnRole);

  if (hadRole && !hasRole) {
    const logs = await newMember.guild.fetchAuditLogs({
      limit: 1,
      type: 25
    }).catch(() => null);

    if (!logs) return;

    const entry = logs.entries.first();
    if (!entry) return;

    if (entry.executor.id !== client.user.id) {
      await newMember.roles.add(warnRole).catch(() => {});
    }
  }
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  const botId = client.user.id;

  if (oldState.id === botId) {
    const state = getMusicState(oldState.guild.id);
    const expectedChannelId = state.allowedChannelId || VOICE_CHANNEL_ID;

    if (oldState.channelId && newState.channelId && newState.channelId !== expectedChannelId) {
      try {
        await newState.setChannel(expectedChannelId);
      } catch {}
    }

    if (oldState.channelId && !newState.channelId) {
      try {
        const targetChannel = oldState.guild.channels.cache.get(expectedChannelId);
        if (targetChannel && targetChannel.isVoiceBased()) {
          const connection = joinVoiceChannel({
            channelId: targetChannel.id,
            guildId: oldState.guild.id,
            adapterCreator: oldState.guild.voiceAdapterCreator,
            selfDeaf: true
          });

          const musicState = getMusicState(oldState.guild.id);
          musicState.connection = connection;
          musicState.voiceChannelId = targetChannel.id;
          musicState.connection.subscribe(musicState.player);
        }
      } catch {}
    }

    return;
  }

  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;
  if (member.guild.id !== GUILD_ID) return;

  const oldChannelId = oldState.channelId;
  const newChannelId = newState.channelId;

  if (!oldChannelId && newChannelId) {
    startVoiceSession(member.id, newChannelId);
    return;
  }

  if (oldChannelId && !newChannelId) {
    endVoiceSession(member.id);
    return;
  }

  if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
    moveVoiceSession(member.id, newChannelId);
  }
});

process.on("SIGINT", () => {
  flushActiveVoiceSessions();
  saveDatabase();
  process.exit(0);
});

process.on("SIGTERM", () => {
  flushActiveVoiceSessions();
  saveDatabase();
  process.exit(0);
});

client.login(TOKEN);
