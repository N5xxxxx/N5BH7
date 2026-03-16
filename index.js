const { Client, GatewayIntentBits, ChannelType, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

const TOKEN = process.env.TOKEN;
const GUILD_ID = "1367976354104086629";
const VOICE_CHANNEL_ID = "1401074295022817381";
const LOG_CHANNEL_ID = "1367984035283996753";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

const commands = [
  new SlashCommandBuilder()
    .setName("send")
    .setDescription("ارسال رسالة بالخاص")
    .addUserOption(option =>
      option.setName("user")
      .setDescription("الشخص")
      .setRequired(true))
    .addStringOption(option =>
      option.setName("message")
      .setDescription("الرسالة")
      .setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("ready", async () => {

  console.log(`✅ Logged in as ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    { body: commands }
  );

  console.log("✅ Slash command registered");

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);
  if (!channel || channel.type !== ChannelType.GuildVoice) return;

  const connection = getVoiceConnection(guild.id);

  if (!connection) {
    joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true
    });

    console.log("🎧 Joined voice channel");
  }

});

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "send") {

    const user = interaction.options.getUser("user");
    const message = interaction.options.getString("message");

    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);

    try {

      await user.send(`${message}\n\n<@${user.id}>`);

      await interaction.reply({
        content: "تم إرسال الرسالة بنجاح",
        ephemeral: true
      });

      if (logChannel) {

        const embed = new EmbedBuilder()
          .setColor("#2ecc71")
          .setTitle("📩 تم إرسال رسالة خاصة")
          .addFields(
            { name: "👤 المستخدم الذي استخدم الأمر", value: `<@${interaction.user.id}>`, inline: true },
            { name: "📨 الشخص المستلم", value: `<@${user.id}>`, inline: true },
            { name: "📊 الحالة", value: "✅ تم الإرسال", inline: true },
            { name: "💬 محتوى الرسالة", value: message }
          )
          .setTimestamp()
          .setFooter({ text: `ID المستخدم: ${interaction.user.id}` });

        logChannel.send({ embeds: [embed] });

      }

    } catch {

      await interaction.reply({
        content: "ما قدرت أرسل له خاص",
        ephemeral: true
      });

      if (logChannel) {

        const embed = new EmbedBuilder()
          .setColor("#e74c3c")
          .setTitle("📩 فشل إرسال الرسالة الخاصة")
          .addFields(
            { name: "👤 المستخدم الذي استخدم الأمر", value: `<@${interaction.user.id}>`, inline: true },
            { name: "📨 الشخص المستلم", value: `<@${user.id}>`, inline: true },
            { name: "📊 الحالة", value: "❌ فشل الإرسال (الخاص مغلق)", inline: true },
            { name: "💬 محتوى الرسالة", value: message }
          )
          .setTimestamp()
          .setFooter({ text: `ID المستخدم: ${interaction.user.id}` });

        logChannel.send({ embeds: [embed] });

      }

    }

  }

});

client.login(TOKEN);
