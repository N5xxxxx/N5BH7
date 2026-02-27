const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { 
    joinVoiceChannel, 
    entersState, 
    VoiceConnectionStatus 
} = require('@discordjs/voice');

// 🔥 حط هنا ID الروم الصوتي
const VOICE_CHANNEL_ID = "1401074295022817381";

// 🔥 حط هنا ID السيرفر
const GUILD_ID = "1367976354104086629";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

let connection;

async function connectToVoice(guild) {
    const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);

    if (!channel || channel.type !== ChannelType.GuildVoice) {
        console.log("❌ Voice channel invalid");
        return;
    }

    connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true
    });

    console.log("🎧 Connected to voice channel");

    connection.on("stateChange", async (_, newState) => {
        if (newState.status === VoiceConnectionStatus.Disconnected) {
            console.log("⚠ Disconnected... Reconnecting");
            try {
                await entersState(connection, VoiceConnectionStatus.Connecting, 5000);
            } catch {
                connection.destroy();
                connectToVoice(guild);
            }
        }
    });
}

client.once("ready", async () => {
    console.log(`🔥 ${client.user.tag} is online`);

    const guild = client.guilds.cache.get(GUILD_ID);

    if (!guild) {
        console.log("❌ Guild not found");
        return;
    }

    await connectToVoice(guild);
});

client.on("voiceStateUpdate", (oldState, newState) => {
    if (!client.user) return;

    // إذا أحد سحب البوت
    if (newState.id === client.user.id) {
        if (newState.channelId !== VOICE_CHANNEL_ID) {
            console.log("🚨 Bot was moved! Returning...");
            connectToVoice(newState.guild);
        }
    }

    // إذا أحد طلع البوت
    if (oldState.id === client.user.id && !newState.channelId) {
        console.log("🚨 Bot was disconnected! Rejoining...");
        connectToVoice(oldState.guild);
    }
});

// ❗ لا تحط التوكن هنا
client.login(process.env.TOKEN);
