const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { joinVoiceChannel, entersState, VoiceConnectionStatus } = require('@discordjs/voice');

const SERVER_ID = "1367976354104086629"; // ← حط ID السيرفر هنا
const VOICE_CHANNEL_ID = "1401074295022817381";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

let connection;

async function connectToVoice() {
    try {
        const guild = await client.guilds.fetch(SERVER_ID);
        const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);

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
                    connectToVoice();
                }
            }
        });

    } catch (err) {
        console.log("❌ Error connecting:", err);
    }
}

client.once("ready", async () => {
    console.log(`🔥 ${client.user.tag} is online`);
    await connectToVoice();
});

client.on("voiceStateUpdate", (oldState, newState) => {
    if (!client.user) return;

    if (newState.id === client.user.id) {
        if (newState.channelId !== VOICE_CHANNEL_ID) {
            console.log("🚨 Bot was moved! Returning...");
            connectToVoice();
        }
    }

    if (oldState.id === client.user.id && !newState.channelId) {
        console.log("🚨 Bot was disconnected! Rejoining...");
        connectToVoice();
    }
});

client.login(process.env.TOKEN);
