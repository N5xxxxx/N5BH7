const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY
});

const AI_CHANNEL_ID = "حط_ايدي_روم_الذكاء";

module.exports = (client) => {

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // الرد في الخاص
    if (!message.guild) {
      const reply = await askAI(message.content);
      return message.reply(reply);
    }

    // الرد في روم محدد
    if (message.channel.id === AI_CHANNEL_ID) {
      const reply = await askAI(message.content);
      message.reply(reply);
    }
  });

  async function askAI(text) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: text }]
    });

    return completion.choices[0].message.content;
  }

};
