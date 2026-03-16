const { Client, GatewayIntentBits, ChannelType, SlashCommandBuilder, REST, Routes } = require('discord.js');
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
        content: "The Send Is Done",
        ephemeral: true
      });

      if (logChannel) {
        logChannel.send(
`📩 تم استخدام /send

👤 المرسل: <@${interaction.user.id}>
📨 المستلم: <@${user.id}>
💬 الرسالة: ${message}
✅ الحالة: تم الإرسال`
        );
      }

    } catch {

      await interaction.reply({
        content: " ما قدرت ارسل له خاص",
        ephemeral: true
      });

      if (logChannel) {
        logChannel.send(
`📩 تم استخدام /send

👤 المرسل: <@${interaction.user.id}>
📨 المستلم: <@${user.id}>
💬 الرسالة: ${message}
❌ الحالة: فشل الإرسال (الخاص مقفل)`
        );
      }

    }

  }

});

client.login(TOKEN);
