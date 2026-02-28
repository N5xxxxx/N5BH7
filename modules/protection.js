module.exports = (client) => {

  const WHITELIST = process.env.OWNER_IDS
    ? process.env.OWNER_IDS.split(",")
    : [];

  const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

  async function log(guild, message) {
    if (!LOG_CHANNEL_ID) return;
    const channel = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (channel) channel.send(message).catch(() => {});
  }

  async function punish(member, reason) {
    if (!member) return;

    if (WHITELIST.includes(member.id)) return;

    setTimeout(async () => {
      try {
        await member.ban({ reason });
      } catch {}
    }, 5000);
  }

  // 🔥 منع إضافة بوت
  client.on("guildMemberAdd", async (member) => {
    if (!member.user.bot) return;

    const logs = await member.guild.fetchAuditLogs({
      limit: 1,
      type: 28
    });

    const entry = logs.entries.first();
    if (!entry) return;

    const executor = await member.guild.members.fetch(entry.executor.id).catch(() => null);
    if (!executor) return;

    if (WHITELIST.includes(executor.id)) return;

    await log(member.guild, `🚨 Unauthorized bot added by ${executor.user.tag}`);

    setTimeout(async () => {
      try { await member.ban({ reason: "Unauthorized Bot" }); } catch {}
      try { await executor.ban({ reason: "Added Unauthorized Bot" }); } catch {}
    }, 5000);
  });

  // 🔥 Anti Role Create
  client.on("roleCreate", async (role) => {
    const logs = await role.guild.fetchAuditLogs({ limit: 1 });
    const entry = logs.entries.first();
    if (!entry) return;

    const executor = await role.guild.members.fetch(entry.executor.id).catch(() => null);
    if (!executor) return;

    if (WHITELIST.includes(executor.id)) return;

    await log(role.guild, `🚨 Unauthorized role created by ${executor.user.tag}`);

    await role.delete().catch(() => {});
    punish(executor, "Unauthorized Role Creation");
  });

  // 🔥 Anti Channel Create
  client.on("channelCreate", async (channel) => {
    const logs = await channel.guild.fetchAuditLogs({ limit: 1 });
    const entry = logs.entries.first();
    if (!entry) return;

    const executor = await channel.guild.members.fetch(entry.executor.id).catch(() => null);
    if (!executor) return;

    if (WHITELIST.includes(executor.id)) return;

    await log(channel.guild, `🚨 Unauthorized channel created by ${executor.user.tag}`);

    await channel.delete().catch(() => {});
    punish(executor, "Unauthorized Channel Creation");
  });

  // 🔥 Anti Mass Ban
  client.on("guildBanAdd", async (ban) => {
    const logs = await ban.guild.fetchAuditLogs({ limit: 1 });
    const entry = logs.entries.first();
    if (!entry) return;

    const executor = await ban.guild.members.fetch(entry.executor.id).catch(() => null);
    if (!executor) return;

    if (WHITELIST.includes(executor.id)) return;

    await log(ban.guild, `🚨 Unauthorized ban by ${executor.user.tag}`);

    punish(executor, "Unauthorized Ban");
  });

  console.log("🛡️ ULTRA PROTECTION SYSTEM ACTIVE");
};
