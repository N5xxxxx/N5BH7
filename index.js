const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

// 🎯 ID الروم الصوتي
const VOICE_CHANNEL_ID = "1401074295022817381";

// 🎯 ID السيرفر
const GUILD_ID = "1367976354104086629";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.once("ready", async () => {
    console.log(`🔥 ${client.user.tag} is online`);

    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
        console.log("❌ Guild not found");
        return;
    }

    const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);
    if (!channel || channel.type !== ChannelType.GuildVoice) {
        console.log("❌ Voice channel invalid");
        return;
    }

    // يمنع تكرار الاتصال (يمنع القلتش)
    const existingConnection = getVoiceConnection(guild.id);
    if (existingConnection) {
        console.log("✅ Already connected");
        return;
    }

    joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true
    });

    console.log("🎧 Connected to voice channel");
});

client.login(process.env.TOKEN);
