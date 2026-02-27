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

// 🔥 يستخدم الحدث الجديد بدل ready
client.once("clientReady", async () => {
    console.log(`🔥 ${client.user.tag} is online`);

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) {
            console.log("❌ Guild not found");
            return;
        }

        const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);
        if (!channel || channel.type !== ChannelType.GuildVoice) {
            console.log("❌ Voice channel invalid");
            return;
        }

        // يمنع التكرار
        const existing = getVoiceConnection(guild.id);
        if (existing) {
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

    } catch (error) {
        console.error("❌ Error while connecting:", error);
    }
});

// ❌ لا تحط التوكن هنا
client.login(process.env.TOKEN);
