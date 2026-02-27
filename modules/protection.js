module.exports = (client) => {

  const userMessages = new Map();

  client.on("messageCreate", async (message) => {
    if (!message.guild) return;
    if (message.author.bot) return;

    const userId = message.author.id;
    const now = Date.now();

    // منع المنشن السبامي
    if (message.mentions.users.size > 5) {
      await message.delete().catch(() => {});
      return message.channel.send(`⚠️ ${message.author}, لا تسوي منشن سبام`)
        .then(msg => setTimeout(() => msg.delete().catch(()=>{}), 4000));
    }

    // نظام Anti-Spam (5 رسائل خلال 5 ثواني)
    if (!userMessages.has(userId)) {
      userMessages.set(userId, []);
    }

    const timestamps = userMessages.get(userId);
    timestamps.push(now);

    const recent = timestamps.filter(time => now - time < 5000);
    userMessages.set(userId, recent);

    if (recent.length > 5) {
      await message.delete().catch(() => {});
      message.channel.send(`🚫 ${message.author}, وقف سبام`)
        .then(msg => setTimeout(() => msg.delete().catch(()=>{}), 4000));
    }
  });

};
