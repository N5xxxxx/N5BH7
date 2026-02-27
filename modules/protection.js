module.exports = (client) => {

  const spamMap = new Map();

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    // منع الروابط
    if (message.content.includes("http")) {
      await message.delete();
      return message.channel.send("🚫 يمنع إرسال الروابط");
    }

    // مكافحة السبام
    const now = Date.now();
    const timestamps = spamMap.get(message.author.id) || [];
    timestamps.push(now);
    spamMap.set(message.author.id, timestamps);

    if (timestamps.length > 5) {
      await message.member.timeout(60000);
      message.channel.send("🚫 تم إسكاتك بسبب السبام");
      spamMap.delete(message.author.id);
    }

    setTimeout(() => {
      spamMap.delete(message.author.id);
    }, 10000);

  });

};
