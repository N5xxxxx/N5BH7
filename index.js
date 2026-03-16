const {
Client,
GatewayIntentBits,
ChannelType,
SlashCommandBuilder,
REST,
Routes,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle
} = require("discord.js");

const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");

const TOKEN = process.env.TOKEN;

const GUILD_ID = "1367976354104086629";
const VOICE_CHANNEL_ID = "1401074295022817381";

const LOG_SEND = "1367984035283996753";

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.GuildVoiceStates
]
});

const commands = [

new SlashCommandBuilder()
.setName("send")
.setDescription("ارسال رسالة بالخاص")
.addUserOption(o=>
o.setName("user")
.setDescription("الشخص")
.setRequired(true))
.addStringOption(o=>
o.setName("message")
.setDescription("الرسالة")
.setRequired(true))

].map(c=>c.toJSON());

const rest = new REST({version:"10"}).setToken(TOKEN);

client.once("clientReady",async()=>{

console.log(`✅ Logged in as ${client.user.tag}`);

await rest.put(
Routes.applicationGuildCommands(client.user.id,GUILD_ID),
{body:commands}
);

console.log("✅ Commands Registered");

const guild = client.guilds.cache.get(GUILD_ID);
if(!guild) return;

const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);
if(!channel || channel.type !== ChannelType.GuildVoice) return;

if(!getVoiceConnection(guild.id)){

joinVoiceChannel({
channelId:channel.id,
guildId:guild.id,
adapterCreator:guild.voiceAdapterCreator,
selfDeaf:true
});

}

});

client.on("interactionCreate",async interaction=>{

if(!interaction.isChatInputCommand()) return;

if(interaction.commandName==="send"){

const user = interaction.user;

const target = interaction.options.getUser("user");
const message = interaction.options.getString("message");

const logChannel = interaction.guild.channels.cache.get(LOG_SEND);

try{

await target.send(`${message}\n\n<@${target.id}>`);

await interaction.reply({
content:"تم إرسال الرسالة بنجاح",
ephemeral:true
});

const embed = new EmbedBuilder()

.setColor("#2ecc71")

.setAuthor({
name:"📩 تم استخدام أمر send",
iconURL:user.displayAvatarURL()
})

.setThumbnail(target.displayAvatarURL())

.addFields(

{
name:"👤 المرسل",
value:`<@${user.id}>`,
inline:true
},

{
name:"🆔 ID المرسل",
value:user.id,
inline:true
},

{
name:"📨 المستلم",
value:`<@${target.id}>`,
inline:true
},

{
name:"🆔 ID المستلم",
value:target.id,
inline:true
},

{
name:"💬 محتوى الرسالة",
value:message
},

{
name:"📊 الحالة",
value:"✅ تم الإرسال",
inline:true
}

)

.setTimestamp()

.setFooter({
text:`Server: ${interaction.guild.name}`
});

const row = new ActionRowBuilder()

.addComponents(

new ButtonBuilder()

.setLabel("فتح بروفايل المرسل")

.setStyle(ButtonStyle.Link)

.setURL(`https://discord.com/users/${user.id}`)

);

if(logChannel){

logChannel.send({

embeds:[embed],
components:[row]

});

}

}catch{

interaction.reply({
content:"ما قدرت أرسل له خاص",
ephemeral:true
});

}

}

});

client.login(TOKEN);
