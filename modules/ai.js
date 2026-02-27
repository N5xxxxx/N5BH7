const { OpenAI } = require("openai");

const AI_CHANNEL_ID = "1476761265907961867";

module.exports = (client) => {

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  async function askAI(prompt) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "أنت مساعد ذكي داخل سيرفر ديسكورد، رد دائماً بالعربي بشكل احترافي." },
        { role: "user", content: prompt }
      ],
      max_tokens: 500
    });

    return response.choices[0].message.content;
  }

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // ====== الرد داخل الخاص (DM) ======
    if (!message.guild) {
      try {
        const reply = await askAI(message.content);
        await message.reply(reply);
      } catch (error) {
        console.error(error);
        message.reply("⚠️ صار خطأ في الذكاء الاصطناعي");
      }
      return;
    }

    // ====== داخل الروم المحدد مع أمر ======
    if (message.channel.id === AI_CHANNEL_ID && message.content.startsWith("!ai ")) {

      const prompt = message.content.slice(4).trim();
      if (!prompt) return;

      try {
        const reply = await askAI(prompt);

        await message.author.send(reply);
        await message.reply("وصلك الرد خاص ياغالي 🤍 ");

      } catch (error) {
        console.error(error);
        message.reply("⚠️ ما قدرت أرسل لك خاص، تأكد إن الخاص مفتوح.");
      }

    }

  });

};
