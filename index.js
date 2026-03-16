const { Client, GatewayIntentBits, ChannelType, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
          .setAuthor({
            name: "📩 تم استخدام أمر /send",
            iconURL: interaction.user.displayAvatarURL()
          })
          .setThumbnail(user.displayAvatarURL())
          .addFields(
            { name: "👤 المرسل", value: `<@${interaction.user.id}>`, inline: true },
            { name: "🆔 ID المرسل", value: interaction.user.id, inline: true },
            { name: "📨 المستلم", value: `<@${user.id}>`, inline: true },
            { name: "🆔 ID المستلم", value: user.id, inline: true },
            { name: "💬 محتوى الرسالة", value: message },
            { name: "📊 الحالة", value: "✅ تم الإرسال", inline: true }
          )
          .setTimestamp()
          .setFooter({ text: `Server: ${interaction.guild.name}` });

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setLabel("فتح بروفايل المرسل")
              .setStyle(ButtonStyle.Link)
              .setURL(`https://discord.com/users/${interaction.user.id}`)
          );

        logChannel.send({
          embeds: [embed],
          components: [row]
        });

      }

    } catch {

      await interaction.reply({
        content: "ما قدرت أرسل له خاص",
        ephemeral: true
      });

      if (logChannel) {

        const embed = new EmbedBuilder()
          .setColor("#e74c3c")
          .setAuthor({
            name: "📩 فشل استخدام أمر /send",
            iconURL: interaction.user.displayAvatarURL()
          })
          .setThumbnail(user.displayAvatarURL())
          .addFields(
            { name: "👤 المرسل", value: `<@${interaction.user.id}>`, inline: true },
            { name: "🆔 ID المرسل", value: interaction.user.id, inline: true },
            { name: "📨 المستلم", value: `<@${user.id}>`, inline: true },
            { name: "🆔 ID المستلم", value: user.id, inline: true },
            { name: "💬 محتوى الرسالة", value: message },
            { name: "📊 الحالة", value: "❌ فشل الإرسال (الخاص مغلق)", inline: true }
          )
          .setTimestamp()
          .setFooter({ text: `Server: ${interaction.guild.name}` });

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setLabel("فتح بروفايل المرسل")
              .setStyle(ButtonStyle.Link)
              .setURL(`https://discord.com/users/${interaction.user.id}`)
          );

        logChannel.send({
          embeds: [embed],
          components: [row]
        });

      }

    }

  }

});

client.login(TOKEN);
