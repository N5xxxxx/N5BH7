const fs = require("fs");
const path = require("path");

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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
  ChannelType,
  UserSelectMenuBuilder
} = require("discord.js");

const { joinVoiceChannel } = require("@discordjs/voice");

const TOKEN = process.env.TOKEN;

const GUILD_ID = "1367976354104086629";
const VOICE_CHANNEL_ID = "1401074295022817381";

/* ✅ روم الفيديو */
const VIDEO_ROOM = "1477417977472090316";

/* ✅ روم الليدر بورد + رتبة التحكم */
const LEADERBOARD_CHANNEL_ID = "1484809257361870892";
const LEADERBOARD_ROLE_ID = "1426999940944756889";
const LEADERBOARD_UPDATE_INTERVAL = 5000;

/* ✅ Temp Voice */
const TEMPVOICE_CREATE_CHANNEL_ID = "1371180759829839973";
const TEMPVOICE_CATEGORY_ID = "1367976354657730732";
const TEMPVOICE_PANEL_CHANNEL_ID = "1371180760958238790";
const TEMPVOICE_IMAGE_URL = "https://tempvoice.xyz/api/canvas?language=en&bitfield=8191&quality=2";

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

const db = {
  warnings: {},
  leaderboard: {
    channelId: LEADERBOARD_CHANNEL_ID,
    messageId: null,
    users: {}
  },
  tempVoice: {
    panelChannelId: TEMPVOICE_PANEL_CHANNEL_ID,
    panelMessageId: null,
    rooms: {}
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
    db.tempVoice = {
      panelChannelId: parsed.tempVoice?.panelChannelId || TEMPVOICE_PANEL_CHANNEL_ID,
      panelMessageId: parsed.tempVoice?.panelMessageId || null,
      rooms: parsed.tempVoice?.rooms || {}
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

function getLeaderboardScore(data) {
  const messagePoints = data.messages * 1;
  const voiceMinutes = Math.floor(data.voiceMs / 60000);
  const voicePoints = voiceMinutes * 3;
  return messagePoints + voicePoints;
}

function sortLeaderboardEntries() {
  return Object.entries(db.leaderboard.users).sort((a, b) => {
    const aScore = getLeaderboardScore(a[1]);
    const bScore = getLeaderboardScore(b[1]);

    if (bScore !== aScore) {
      return bScore - aScore;
    }

    return b[1].voiceMs - a[1].voiceMs;
  });
}

function buildLeaderboardEmbed(guild) {
  flushActiveVoiceSessions();

  const entries = sortLeaderboardEntries().slice(0, 10);

  const description = entries.length
    ? entries
        .map(([userId, data], index) => {
          return [
            `**#${index + 1}** | <@${userId}>`,
            `> **النقاط:** \`${getLeaderboardScore(data)}\` | **الرسائل:** \`${data.messages}\` | **الوقت الصوتي:** \`${formatVoiceDuration(data.voiceMs)}\``
          ].join("\n");
        })
        .join("\n\n")
    : "لا يوجد بيانات حتى الآن.";

  return new EmbedBuilder()
    .setColor("#000000")
    .setAuthor({
      name: `${guild.name} Leaderboard`,
      iconURL: guild.iconURL({ dynamic: true }) || undefined
    })
    .setTitle("Leaderboards for N5BH")
    .setDescription(description)
    .addFields({
      name: "🕒 آخر تحديث",
      value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
      inline: true
    })
    .setFooter({
      text: "النقاط = الرسائل + وقت الفويس"
    })
    .setTimestamp();
}

async function findExistingLeaderboardMessage(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 20 });
    const botMessages = messages.filter(msg =>
      msg.author.id === client.user.id &&
      msg.embeds.length > 0 &&
      msg.components.length > 0 &&
      msg.components.some(row =>
        row.components.some(component => component.customId === "leaderboard_refresh")
      )
    );

    return botMessages.first() || null;
  } catch {
    return null;
  }
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

  const foundMessage = await findExistingLeaderboardMessage(channel);
  if (foundMessage) {
    db.leaderboard.messageId = foundMessage.id;
    saveDatabase();
    return foundMessage;
  }

  const newMessage = await channel.send({
    embeds: [buildLeaderboardEmbed(guild)],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("تحديث الليدر بورد")
          .setStyle(ButtonStyle.Secondary)
          .setCustomId("leaderboard_refresh")
      )
    ]
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
    if (!channel || !channel.isTextBased()) return;

    const message = await ensureLeaderboardMessage(guild);
    if (!message) return;

    await message.edit({
      embeds: [buildLeaderboardEmbed(guild)],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("تحديث الليدر بورد")
            .setStyle(ButtonStyle.Secondary)
            .setCustomId("leaderboard_refresh")
        )
      ]
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

/* TEMP VOICE */

function buildTempVoiceEmbed(guild) {
  return new EmbedBuilder()
    .setColor("#f59e0b")
    .setAuthor({
      name: `${guild.name} TempVoice`,
      iconURL: guild.iconURL({ dynamic: true }) || undefined
    })
    .setTitle("TempVoice Interface")
    .setDescription([
      "هذه اللوحة لإدارة الرومات المؤقتة.",
      "أدخل روم الإنشاء وسيتم إنشاء رومك ونقلك إليه مباشرة.",
      "",
      "`Name` تغيير الاسم",
      "`Limit` تغيير الحد",
      "`Privacy` فتح/قفل الروم",
      "`Waiting R.` وضع انتظار للروم",
      "`Chat` إنشاء/حذف شات للروم",
      "`Trust / Invite` السماح لعضو",
      "`Untrust` إزالة السماح",
      "`Kick` طرد عضو من الروم",
      "`Block / Unblock` منع/فك المنع",
      "`Claim` استلام الملكية",
      "`Transfer` نقل الملكية",
      "`Region` معلومات فقط",
      "`Delete` حذف الروم"
    ].join("\n"))
    .setImage(TEMPVOICE_IMAGE_URL)
    .setFooter({
      text: "Press the buttons below to control your room"
    });
}

function buildTempVoiceRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("tempvoice_name").setLabel("Name").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("tempvoice_limit").setLabel("Limit").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("tempvoice_privacy").setLabel("Privacy").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("tempvoice_waiting").setLabel("Waiting R.").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("tempvoice_chat").setLabel("Chat").setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("tempvoice_trust").setLabel("Trust").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("tempvoice_untrust").setLabel("Untrust").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("tempvoice_invite").setLabel("Invite").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("tempvoice_kick").setLabel("Kick").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("tempvoice_region").setLabel("Region").setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("tempvoice_block").setLabel("Block").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("tempvoice_unblock").setLabel("Unblock").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("tempvoice_claim").setLabel("Claim").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("tempvoice_transfer").setLabel("Transfer").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("tempvoice_delete").setLabel("Delete").setStyle(ButtonStyle.Danger)
    )
  ];
}

function getTempVoiceRoomByOwner(ownerId) {
  return Object.values(db.tempVoice.rooms).find(room => room.ownerId === ownerId) || null;
}

function getTempVoiceRoomByChannel(channelId) {
  return db.tempVoice.rooms[channelId] || null;
}

function getTempVoiceRoomByTextChannel(textChannelId) {
  return Object.values(db.tempVoice.rooms).find(room => room.textChannelId === textChannelId) || null;
}

async function ensureTempVoicePanel(guild) {
  const channel = guild.channels.cache.get(db.tempVoice.panelChannelId);
  if (!channel || !channel.isTextBased()) return null;

  if (db.tempVoice.panelMessageId) {
    try {
      const message = await channel.messages.fetch(db.tempVoice.panelMessageId);
      return message;
    } catch {
      db.tempVoice.panelMessageId = null;
      saveDatabase();
    }
  }

  const message = await channel.send({
    embeds: [buildTempVoiceEmbed(guild)],
    components: buildTempVoiceRows()
  });

  db.tempVoice.panelMessageId = message.id;
  saveDatabase();
  return message;
}

async function createTempVoiceRoom(member) {
  const guild = member.guild;
  const category = guild.channels.cache.get(TEMPVOICE_CATEGORY_ID);
  if (!category) return null;

  const existing = getTempVoiceRoomByOwner(member.id);
  if (existing) {
    const existingChannel = guild.channels.cache.get(existing.channelId);
    if (existingChannel) return existingChannel;
  }

  const channel = await guild.channels.create({
    name: `${member.displayName} • Room`,
    type: ChannelType.GuildVoice,
    parent: category.id,
    userLimit: 0,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak
        ]
      },
      {
        id: member.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.MoveMembers
        ]
      }
    ]
  });

  db.tempVoice.rooms[channel.id] = {
    channelId: channel.id,
    ownerId: member.id,
    private: false,
    waitingRoom: false,
    textChannelId: null,
    trustedUsers: [],
    blockedUsers: [],
    createdAt: Date.now()
  };

  saveDatabase();
  return channel;
}

async function deleteTempVoiceRoom(guild, channelId) {
  const data = getTempVoiceRoomByChannel(channelId);
  if (!data) return;

  const channel = guild.channels.cache.get(channelId);
  const textChannel = data.textChannelId ? guild.channels.cache.get(data.textChannelId) : null;

  delete db.tempVoice.rooms[channelId];
  saveDatabase();

  if (textChannel) await textChannel.delete().catch(() => {});
  if (channel) await channel.delete().catch(() => {});
}

async function grantOwnerPerms(channel, ownerId) {
  await channel.permissionOverwrites.edit(ownerId, {
    ViewChannel: true,
    Connect: true,
    Speak: true,
    ManageChannels: true,
    MoveMembers: true
  }).catch(() => {});
}

async function syncTempVoiceRoom(guild, roomData) {
  const channel = guild.channels.cache.get(roomData.channelId);
  if (!channel) return;

  const everyoneConnect = !roomData.private && !roomData.waitingRoom;

  await channel.permissionOverwrites.edit(guild.roles.everyone.id, {
    ViewChannel: true,
    Connect: everyoneConnect,
    Speak: everyoneConnect
  }).catch(() => {});

  await grantOwnerPerms(channel, roomData.ownerId);

  for (const userId of roomData.trustedUsers || []) {
    await channel.permissionOverwrites.edit(userId, {
      ViewChannel: true,
      Connect: true,
      Speak: true
    }).catch(() => {});
  }

  for (const userId of roomData.blockedUsers || []) {
    await channel.permissionOverwrites.edit(userId, {
      ViewChannel: false,
      Connect: false,
      Speak: false
    }).catch(() => {});
  }
}

async function createOrDeleteTempVoiceTextChannel(guild, roomData) {
  const voiceChannel = guild.channels.cache.get(roomData.channelId);
  if (!voiceChannel) return null;

  if (roomData.textChannelId) {
    const textChannel = guild.channels.cache.get(roomData.textChannelId);
    if (textChannel) {
      await textChannel.delete().catch(() => {});
    }

    roomData.textChannelId = null;
    saveDatabase();
    return null;
  }

  const textChannel = await guild.channels.create({
    name: `${voiceChannel.name.replace(/ • Room$/, "").toLowerCase().replace(/\s+/g, "-")}-chat`,
    type: ChannelType.GuildText,
    parent: TEMPVOICE_CATEGORY_ID,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: roomData.ownerId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      }
    ]
  });

  for (const userId of roomData.trustedUsers || []) {
    await textChannel.permissionOverwrites.edit(userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    }).catch(() => {});
  }

  roomData.textChannelId = textChannel.id;
  saveDatabase();
  return textChannel;
}

function isRoomOwner(userId, roomData) {
  return roomData && roomData.ownerId === userId;
}

async function getControllableTempRoom(interaction) {
  const member = interaction.member;
  const owned = getTempVoiceRoomByOwner(member.id);
  if (owned) return owned;

  if (member.voice?.channelId) {
    const joined = getTempVoiceRoomByChannel(member.voice.channelId);
    if (joined) return joined;
  }

  return null;
}

function buildUserSelect(customId, placeholder) {
  return new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .setMinValues(1)
      .setMaxValues(1)
  );
}

function sendLog(interaction, channelId, embed, row) {
  const channel = interaction.guild.channels.cache.get(channelId);

  if (channel) {
    channel.send({
      embeds: [embed],
      components: row ? [row] : []
    }).catch(() => {});
  }
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
    .setName("tempvoicepanel")
    .setDescription("إرسال أو تحديث لوحة التيمب فويس")
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

  const voiceChannel = guild.channels.cache.get(VOICE_CHANNEL_ID);
  if (voiceChannel && voiceChannel.isVoiceBased()) {
    joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true
    });
  }

  guild.voiceStates.cache.forEach(state => {
    if (!state.member) return;
    if (!state.member.user.bot && state.channelId) {
      startVoiceSession(state.id, state.channelId);
    }
  });

  await ensureLeaderboardMessage(guild);
  await updateLeaderboardMessage(guild);
  await ensureTempVoicePanel(guild);

  if (leaderboardInterval) clearInterval(leaderboardInterval);
  leaderboardInterval = setInterval(() => {
    updateLeaderboardMessage(guild).catch(() => {});
  }, LEADERBOARD_UPDATE_INTERVAL);
});

client.on("messageCreate", async message => {
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

client.on("interactionCreate", async interaction => {
  if (interaction.isButton()) {
    if (interaction.customId === "leaderboard_refresh") {
      if (!interaction.member || !hasLeaderboardRole(interaction.member)) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية استخدام زر التحديث.",
          ephemeral: true
        });
      }

      await updateLeaderboardMessage(interaction.guild);
      return interaction.reply({ content: "✅ تم تحديث الليدر بورد.", ephemeral: true });
    }

    if (interaction.customId.startsWith("tempvoice_")) {
      const roomData = await getControllableTempRoom(interaction);

      if (!roomData) {
        return interaction.reply({
          content: "❌ لازم يكون عندك روم مؤقت أو تكون داخله.",
          ephemeral: true
        });
      }

      const channel = interaction.guild.channels.cache.get(roomData.channelId);
      if (!channel) {
        delete db.tempVoice.rooms[roomData.channelId];
        saveDatabase();
        return interaction.reply({ content: "❌ الروم غير موجود.", ephemeral: true });
      }

      const member = interaction.member;

      if (
        !["tempvoice_claim", "tempvoice_region"].includes(interaction.customId) &&
        !isRoomOwner(member.id, roomData)
      ) {
        return interaction.reply({
          content: "❌ فقط صاحب الروم يقدر يستخدم هذا الزر.",
          ephemeral: true
        });
      }

      if (interaction.customId === "tempvoice_name") {
        const modal = new ModalBuilder()
          .setCustomId(`tempvoice_modal_name_${roomData.channelId}`)
          .setTitle("تغيير اسم الروم");

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("room_name")
              .setLabel("الاسم الجديد")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(32)
          )
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === "tempvoice_limit") {
        const modal = new ModalBuilder()
          .setCustomId(`tempvoice_modal_limit_${roomData.channelId}`)
          .setTitle("تغيير حد الروم");

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("room_limit")
              .setLabel("من 0 إلى 99")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(2)
          )
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === "tempvoice_privacy") {
        roomData.private = !roomData.private;
        await syncTempVoiceRoom(interaction.guild, roomData);
        saveDatabase();

        return interaction.reply({
          content: roomData.private ? "🔒 تم قفل الروم." : "🔓 تم فتح الروم.",
          ephemeral: true
        });
      }

      if (interaction.customId === "tempvoice_waiting") {
        roomData.waitingRoom = !roomData.waitingRoom;
        await syncTempVoiceRoom(interaction.guild, roomData);
        saveDatabase();

        return interaction.reply({
          content: roomData.waitingRoom ? "⏳ تم تشغيل وضع الانتظار." : "✅ تم إيقاف وضع الانتظار.",
          ephemeral: true
        });
      }

      if (interaction.customId === "tempvoice_chat") {
        const textChannel = await createOrDeleteTempVoiceTextChannel(interaction.guild, roomData);

        return interaction.reply({
          content: textChannel ? `💬 تم إنشاء الشات: <#${textChannel.id}>` : "🗑 تم حذف شات الروم.",
          ephemeral: true
        });
      }

      if (interaction.customId === "tempvoice_claim") {
        const humans = channel.members.filter(m => !m.user.bot);
        if (humans.has(roomData.ownerId)) {
          return interaction.reply({
            content: "❌ صاحب الروم ما زال موجود.",
            ephemeral: true
          });
        }

        roomData.ownerId = interaction.user.id;
        await syncTempVoiceRoom(interaction.guild, roomData);
        saveDatabase();

        return interaction.reply({
          content: "👑 تم استلام ملكية الروم.",
          ephemeral: true
        });
      }

      if (interaction.customId === "tempvoice_delete") {
        await deleteTempVoiceRoom(interaction.guild, roomData.channelId);
        return interaction.reply({ content: "🗑 تم حذف الروم المؤقت.", ephemeral: true });
      }

      if (interaction.customId === "tempvoice_region") {
        return interaction.reply({
          content: "🌍 Discord يعتمد تلقائيًا على أفضل منطقة صوتية. ما فيه تغيير يدوي مضمون بكل السيرفرات.",
          ephemeral: true
        });
      }

      if (interaction.customId === "tempvoice_trust") {
        return interaction.reply({
          content: "اختر العضو الذي تريد منحه صلاحية دائمة في الروم.",
          components: [buildUserSelect(`tempvoice_select_trust_${roomData.channelId}`, "Select a user to trust")],
          ephemeral: true
        });
      }

      if (interaction.customId === "tempvoice_invite") {
        return interaction.reply({
          content: "اختر العضو الذي تريد دعوته للروم.",
          components: [buildUserSelect(`tempvoice_select_invite_${roomData.channelId}`, "Select a user to invite")],
          ephemeral: true
        });
      }

      if (interaction.customId === "tempvoice_untrust") {
        return interaction.reply({
          content: "اختر العضو الذي تريد إزالة السماح عنه.",
          components: [buildUserSelect(`tempvoice_select_untrust_${roomData.channelId}`, "Select a user to untrust")],
          ephemeral: true
        });
      }

      if (interaction.customId === "tempvoice_kick") {
        return interaction.reply({
          content: "اختر العضو الذي تريد طرده من الروم.",
          components: [buildUserSelect(`tempvoice_select_kick_${roomData.channelId}`, "Select a user to kick")],
          ephemeral: true
        });
      }

      if (interaction.customId === "tempvoice_block") {
        return interaction.reply({
          content: "اختر العضو الذي تريد منعه من الروم.",
          components: [buildUserSelect(`tempvoice_select_block_${roomData.channelId}`, "Select a user to block")],
          ephemeral: true
        });
      }

      if (interaction.customId === "tempvoice_unblock") {
        return interaction.reply({
          content: "اختر العضو الذي تريد فك الحظر عنه.",
          components: [buildUserSelect(`tempvoice_select_unblock_${roomData.channelId}`, "Select a user to unblock")],
          ephemeral: true
        });
      }

      if (interaction.customId === "tempvoice_transfer") {
        return interaction.reply({
          content: "اختر العضو الذي تريد نقل الملكية له.",
          components: [buildUserSelect(`tempvoice_select_transfer_${roomData.channelId}`, "Select a user to transfer ownership")],
          ephemeral: true
        });
      }
    }
  }

  if (interaction.isUserSelectMenu()) {
    if (!interaction.customId.startsWith("tempvoice_select_")) return;

    const parts = interaction.customId.split("_");
    const action = parts[2];
    const channelId = parts.slice(3).join("_");
    const roomData = getTempVoiceRoomByChannel(channelId);

    if (!roomData) {
      return interaction.update({
        content: "❌ الروم غير موجود.",
        components: []
      });
    }

    const targetId = interaction.values[0];
    const guild = interaction.guild;
    const channel = guild.channels.cache.get(channelId);
    const targetMember = await guild.members.fetch(targetId).catch(() => null);

    if (!channel || !targetMember) {
      return interaction.update({
        content: "❌ ما قدرت أحدد العضو أو الروم.",
        components: []
      });
    }

    if (action === "trust" || action === "invite") {
      if (!roomData.trustedUsers.includes(targetId)) {
        roomData.trustedUsers.push(targetId);
      }

      roomData.blockedUsers = roomData.blockedUsers.filter(id => id !== targetId);

      await channel.permissionOverwrites.edit(targetId, {
        ViewChannel: true,
        Connect: true,
        Speak: true
      }).catch(() => {});

      if (roomData.textChannelId) {
        const textChannel = guild.channels.cache.get(roomData.textChannelId);
        if (textChannel) {
          await textChannel.permissionOverwrites.edit(targetId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
          }).catch(() => {});
        }
      }

      saveDatabase();

      return interaction.update({
        content: `✅ تم السماح لـ <@${targetId}> في الروم.`,
        components: []
      });
    }

    if (action === "untrust") {
      roomData.trustedUsers = roomData.trustedUsers.filter(id => id !== targetId);

      await channel.permissionOverwrites.delete(targetId).catch(() => {});
      await syncTempVoiceRoom(guild, roomData);

      if (roomData.textChannelId) {
        const textChannel = guild.channels.cache.get(roomData.textChannelId);
        if (textChannel) {
          await textChannel.permissionOverwrites.delete(targetId).catch(() => {});
        }
      }

      saveDatabase();

      return interaction.update({
        content: `✅ تم إزالة السماح عن <@${targetId}>.`,
        components: []
      });
    }

    if (action === "kick") {
      if (targetMember.voice.channelId === channelId) {
        await targetMember.voice.disconnect().catch(() => {});
      }

      return interaction.update({
        content: `👢 تم طرد <@${targetId}> من الروم.`,
        components: []
      });
    }

    if (action === "block") {
      if (!roomData.blockedUsers.includes(targetId)) {
        roomData.blockedUsers.push(targetId);
      }

      roomData.trustedUsers = roomData.trustedUsers.filter(id => id !== targetId);

      await channel.permissionOverwrites.edit(targetId, {
        ViewChannel: false,
        Connect: false,
        Speak: false
      }).catch(() => {});

      if (roomData.textChannelId) {
        const textChannel = guild.channels.cache.get(roomData.textChannelId);
        if (textChannel) {
          await textChannel.permissionOverwrites.edit(targetId, {
            ViewChannel: false,
            SendMessages: false,
            ReadMessageHistory: false
          }).catch(() => {});
        }
      }

      if (targetMember.voice.channelId === channelId) {
        await targetMember.voice.disconnect().catch(() => {});
      }

      saveDatabase();

      return interaction.update({
        content: `🚫 تم حظر <@${targetId}> من الروم.`,
        components: []
      });
    }

    if (action === "unblock") {
      roomData.blockedUsers = roomData.blockedUsers.filter(id => id !== targetId);

      await channel.permissionOverwrites.delete(targetId).catch(() => {});
      await syncTempVoiceRoom(guild, roomData);

      if (roomData.textChannelId) {
        const textChannel = guild.channels.cache.get(roomData.textChannelId);
        if (textChannel) {
          await textChannel.permissionOverwrites.delete(targetId).catch(() => {});
        }
      }

      saveDatabase();

      return interaction.update({
        content: `✅ تم فك الحظر عن <@${targetId}>.`,
        components: []
      });
    }

    if (action === "transfer") {
      roomData.ownerId = targetId;
      await grantOwnerPerms(channel, targetId);
      saveDatabase();

      return interaction.update({
        content: `👑 تم نقل ملكية الروم إلى <@${targetId}>.`,
        components: []
      });
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("tempvoice_modal_name_")) {
      const channelId = interaction.customId.replace("tempvoice_modal_name_", "");
      const roomData = getTempVoiceRoomByChannel(channelId);
      if (!roomData || roomData.ownerId !== interaction.user.id) {
        return interaction.reply({ content: "❌ ما عندك صلاحية.", ephemeral: true });
      }

      const channel = interaction.guild.channels.cache.get(channelId);
      if (!channel) {
        return interaction.reply({ content: "❌ الروم غير موجود.", ephemeral: true });
      }

      const newName = interaction.fields.getTextInputValue("room_name").trim().slice(0, 32);
      await channel.setName(newName).catch(() => {});

      if (roomData.textChannelId) {
        const textChannel = interaction.guild.channels.cache.get(roomData.textChannelId);
        if (textChannel) {
          await textChannel.setName(`${newName.toLowerCase().replace(/\s+/g, "-")}-chat`.slice(0, 100)).catch(() => {});
        }
      }

      return interaction.reply({
        content: `✅ تم تغيير الاسم إلى: ${newName}`,
        ephemeral: true
      });
    }

    if (interaction.customId.startsWith("tempvoice_modal_limit_")) {
      const channelId = interaction.customId.replace("tempvoice_modal_limit_", "");
      const roomData = getTempVoiceRoomByChannel(channelId);
      if (!roomData || roomData.ownerId !== interaction.user.id) {
        return interaction.reply({ content: "❌ ما عندك صلاحية.", ephemeral: true });
      }

      const channel = interaction.guild.channels.cache.get(channelId);
      if (!channel) {
        return interaction.reply({ content: "❌ الروم غير موجود.", ephemeral: true });
      }

      const raw = interaction.fields.getTextInputValue("room_limit").trim();
      const limit = Number(raw);

      if (Number.isNaN(limit) || limit < 0 || limit > 99) {
        return interaction.reply({
          content: "❌ لازم تدخل رقم من 0 إلى 99.",
          ephemeral: true
        });
      }

      await channel.setUserLimit(limit).catch(() => {});
      return interaction.reply({
        content: `✅ تم تغيير الحد إلى: ${limit}`,
        ephemeral: true
      });
    }
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

  if (interaction.commandName === "tempvoicepanel") {
    const message = await ensureTempVoicePanel(interaction.guild);

    return interaction.reply({
      content: message ? `✅ تم إرسال/تحديث بانل التيمب فويس في <#${TEMPVOICE_PANEL_CHANNEL_ID}>` : "❌ ما قدرت أرسل البانل.",
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

      const existingChannel = interaction.guild.channels.cache.get(db.leaderboard.channelId);
      let existingMessage = null;

      if (db.leaderboard.messageId && existingChannel && existingChannel.isTextBased()) {
        existingMessage = await existingChannel.messages.fetch(db.leaderboard.messageId).catch(() => null);
      }

      if (!existingMessage && existingChannel && existingChannel.isTextBased()) {
        existingMessage = await findExistingLeaderboardMessage(existingChannel);
        if (existingMessage) {
          db.leaderboard.messageId = existingMessage.id;
          saveDatabase();
        }
      }

      if (!existingMessage) {
        const msg = await ensureLeaderboardMessage(interaction.guild);
        await updateLeaderboardMessage(interaction.guild);

        return interaction.reply({
          content: msg
            ? `✅ تم إنشاء الليدر بورد في <#${LEADERBOARD_CHANNEL_ID}>`
            : "❌ ما قدرت أنشئ رسالة الليدر بورد.",
          ephemeral: true
        });
      }

      await updateLeaderboardMessage(interaction.guild);

      return interaction.reply({
        content: "✅ الليدر بورد موجود مسبقًا وتم تحديثه فقط.",
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
          { name: "⭐ النقاط", value: `${getLeaderboardScore(stats)}`, inline: true },
          { name: "💬 عدد الرسائل", value: `${stats.messages}`, inline: true },
          { name: "🎤 الوقت الصوتي", value: formatVoiceDuration(stats.voiceMs), inline: true }
        )
        .setFooter({ text: interaction.guild.name })
        .setTimestamp();

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }
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
    if (oldState.channelId && newState.channelId && newState.channelId !== VOICE_CHANNEL_ID) {
      try {
        await newState.setChannel(VOICE_CHANNEL_ID);
      } catch {}
    }

    if (oldState.channelId && !newState.channelId) {
      try {
        const targetChannel = oldState.guild.channels.cache.get(VOICE_CHANNEL_ID);
        if (targetChannel && targetChannel.isVoiceBased()) {
          joinVoiceChannel({
            channelId: targetChannel.id,
            guildId: oldState.guild.id,
            adapterCreator: oldState.guild.voiceAdapterCreator,
            selfDeaf: true
          });
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

    if (newChannelId === TEMPVOICE_CREATE_CHANNEL_ID) {
      const channel = await createTempVoiceRoom(member);
      if (channel) {
        await newState.setChannel(channel.id).catch(() => {});
      }
    }

    return;
  }

  if (oldChannelId && !newChannelId) {
    endVoiceSession(member.id);

    const oldRoom = getTempVoiceRoomByChannel(oldChannelId);
    if (oldRoom) {
      const oldChannel = oldState.guild.channels.cache.get(oldChannelId);
      const humans = oldChannel?.members.filter(m => !m.user.bot).size || 0;
      if (humans === 0) {
        await deleteTempVoiceRoom(oldState.guild, oldChannelId);
      }
    }

    return;
  }

  if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
    moveVoiceSession(member.id, newChannelId);

    const oldRoom = getTempVoiceRoomByChannel(oldChannelId);
    if (oldRoom) {
      const oldChannel = oldState.guild.channels.cache.get(oldChannelId);
      const humans = oldChannel?.members.filter(m => !m.user.bot).size || 0;
      if (humans === 0) {
        await deleteTempVoiceRoom(oldState.guild, oldChannelId);
      }
    }

    if (newChannelId === TEMPVOICE_CREATE_CHANNEL_ID) {
      const channel = await createTempVoiceRoom(member);
      if (channel) {
        await newState.setChannel(channel.id).catch(() => {});
      }
    }
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
