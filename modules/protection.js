const { AuditLogEvent, PermissionsBitField, ChannelType } = require("discord.js");

module.exports = (client) => {

  const GUILD_ID = process.env.GUILD_ID;
  const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
  const OWNER_IDS = process.env.OWNER_IDS?.split(",") || [];

  const spamMap = new Map();
  const joinMap = [];
  const actionMap = new Map();
  let emergency = false;

  const MASS_LIMIT = 3;        // عدد العمليات خلال النافذة
  const WINDOW_MS = 5000;      // 5 ثواني
  const RAID_JOIN_LIMIT = 6;   // 6 دخول خلال 10 ثواني
  const RAID_WINDOW = 10000;

  function isOwner(id) {
    return OWNER_IDS.includes(id);
  }

  async function sendLog(guild, msg) {
    const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (ch) await ch.send({ content: msg }).catch(() => {});
  }

  function trackAction(userId) {
    const now = Date.now();
    const data = actionMap.get(userId) || [];
    data.push(now);
    actionMap.set(userId, data.filter(t => now - t < WINDOW_MS));
    return actionMap.get(userId).length;
  }

  async function emergencyLock(guild, reason) {
    if (emergency) return;
    emergency = true;

    await sendLog(guild, `🚨 EMERGENCY LOCKDOWN ACTIVATED\nReason: ${reason}`);

    guild.channels.cache.forEach(async (channel) => {
      if (!channel.permissionsFor) return;
      if (channel.type !== ChannelType.GuildText) return;

      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: false
      }).catch(() => {});
    });
  }

  console.log("🛡️ ULTRA PROTECTION SYSTEM ACTIVE");

  // ======================
  // 🧨 Anti-Bot Add
  // ======================
  client.on("guildMemberAdd", async (member) => {
    if (member.guild.id !== GUILD_ID) return;

    // Anti Raid Join Detection
    const now = Date.now();
    joinMap.push(now);
    const recent = joinMap.filter(t => now - t < RAID_WINDOW);

    if (recent.length >= RAID_JOIN_LIMIT) {
      await emergencyLock(member.guild, "Raid Join Detected");
    }

    if (!member.user.bot) return;

    setTimeout(async () => {
      const logs = await member.guild.fetchAuditLogs({
        type: AuditLogEvent.BotAdd,
        limit: 1
      });

      const entry = logs.entries.first();
      if (!entry) return;

      const executor = entry.executor;
      if (!executor || isOwner(executor.id)) return;

      await member.ban().catch(() => {});
      await member.guild.members.ban(executor.id).catch(() => {});

      await sendLog(member.guild,
        `🚫 Unauthorized Bot Added\nBot: ${member.user.tag}\nBy: <@${executor.id}>`
      );
    }, 5000);
  });

  // ======================
  // 👑 Role Guard
  // ======================
  client.on("roleUpdate", async (oldRole, newRole) => {
    if (newRole.guild.id !== GUILD_ID) return;

    const dangerous =
      newRole.permissions.has(PermissionsBitField.Flags.Administrator) ||
      newRole.permissions.has(PermissionsBitField.Flags.ManageGuild);

    if (!dangerous) return;

    const logs = await newRole.guild.fetchAuditLogs({
      type: AuditLogEvent.RoleUpdate,
      limit: 1
    });

    const entry = logs.entries.first();
    if (!entry) return;

    const executor = entry.executor;
    if (!executor || isOwner(executor.id)) return;

    const count = trackAction(executor.id);
    await newRole.setPermissions(oldRole.permissions).catch(() => {});
    await newRole.guild.members.ban(executor.id).catch(() => {});

    if (count >= MASS_LIMIT) {
      await emergencyLock(newRole.guild, "Mass Role Abuse");
    }

    await sendLog(newRole.guild,
      `🛑 Role Abuse\nRole: ${newRole.name}\nBy: <@${executor.id}>`
    );
  });

  // ======================
  // 🏗 Channel Create/Delete Guard
  // ======================
  async function handleChannelAbuse(channel, type) {
    const logs = await channel.guild.fetchAuditLogs({
      type,
      limit: 1
    });

    const entry = logs.entries.first();
    if (!entry) return;

    const executor = entry.executor;
    if (!executor || isOwner(executor.id)) return;

    const count = trackAction(executor.id);
    await channel.guild.members.ban(executor.id).catch(() => {});

    if (count >= MASS_LIMIT) {
      await emergencyLock(channel.guild, "Mass Channel Abuse");
    }

    await sendLog(channel.guild,
      `🧨 Channel Abuse\nBy: <@${executor.id}>`
    );
  }

  client.on("channelDelete", (channel) =>
    handleChannelAbuse(channel, AuditLogEvent.ChannelDelete)
  );

  client.on("channelCreate", (channel) =>
    handleChannelAbuse(channel, AuditLogEvent.ChannelCreate)
  );

  // ======================
  // 🪝 Webhook Guard
  // ======================
  client.on("webhooksUpdate", async (channel) => {
    const logs = await channel.guild.fetchAuditLogs({
      type: AuditLogEvent.WebhookCreate,
      limit: 1
    });

    const entry = logs.entries.first();
    if (!entry) return;

    const executor = entry.executor;
    if (!executor || isOwner(executor.id)) return;

    await channel.guild.members.ban(executor.id).catch(() => {});
    await emergencyLock(channel.guild, "Webhook Attack");

    await sendLog(channel.guild,
      `🪝 Unauthorized Webhook Created\nBy: <@${executor.id}>`
    );
  });

  // ======================
  // 🚫 Anti-Mass Ban
  // ======================
  client.on("guildBanAdd", async (ban) => {
    const logs = await ban.guild.fetchAuditLogs({
      type: AuditLogEvent.MemberBanAdd,
      limit: 1
    });

    const entry = logs.entries.first();
    if (!entry) return;

    const executor = entry.executor;
    if (!executor || isOwner(executor.id)) return;

    const count = trackAction(executor.id);
    if (count >= MASS_LIMIT) {
      await ban.guild.members.ban(executor.id).catch(() => {});
      await emergencyLock(ban.guild, "Mass Ban Detected");
    }
  });

  // ======================
  // 💬 Anti-Spam + Anti-Link
  // ======================
  client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot) return;

    if (message.content.includes("http")) {
      await message.delete().catch(() => {});
      return message.channel.send("🚫 يمنع إرسال الروابط");
    }

    const now = Date.now();
    const timestamps = spamMap.get(message.author.id) || [];
    timestamps.push(now);
    spamMap.set(message.author.id, timestamps.filter(t => now - t < 10000));

    if (spamMap.get(message.author.id).length > 5) {
      await message.member.timeout(60000).catch(() => {});
      message.channel.send("🚫 تم إسكاتك بسبب السبام");
      spamMap.delete(message.author.id);
    }
  });

};
