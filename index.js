const {
Client,
GatewayIntentBits,
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
const LOG_WARN = "1482927462168920186";
const LOG_WARNINGS = "1482927612627128516";
const LOG_DMALL = "1482927730050859080";
const LOG_CLEARWARN = "1482927958548287499";

/* WARN ROLES */

const WARN_ROLES = {
1:"1482963105943126108",
2:"1482963310860042300",
3:"1482963374605340734",
4:"1482963614775115837",
5:"1482963685428433068",
6:"1482963748267233412"
};

const warnings = new Map();

/*
CLIENT
*/

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.GuildVoiceStates
]
});

/*
COMMANDS
*/

const commands = [

new SlashCommandBuilder()
.setName("send")
.setDescription("ارسال رسالة بالخاص")
.addUserOption(o=>o.setName("user").setDescription("الشخص").setRequired(true))
.addStringOption(o=>o.setName("message").setDescription("الرسالة").setRequired(true)),

new SlashCommandBuilder()
.setName("dmall")
.setDescription("ارسال رسالة لكل السيرفر")
.addStringOption(o=>o.setName("message").setDescription("الرسالة").setRequired(true)),

new SlashCommandBuilder()
.setName("warn")
.setDescription("تحذير عضو")
.addUserOption(o=>o.setName("user").setDescription("الشخص").setRequired(true))
.addIntegerOption(o=>
o.setName("level")
.setDescription("رقم الوارن")
.setRequired(true)
.addChoices(
{name:"Warn 1",value:1},
{name:"Warn 2",value:2},
{name:"Warn 3",value:3},
{name:"Warn 4",value:4},
{name:"Warn 5",value:5},
{name:"Warn 6",value:6}
))
.addStringOption(o=>o.setName("reason").setDescription("السبب").setRequired(true)),

new SlashCommandBuilder()
.setName("warnings")
.setDescription("عرض تحذيرات عضو")
.addUserOption(o=>o.setName("user").setDescription("الشخص").setRequired(true)),

new SlashCommandBuilder()
.setName("clearwarnings")
.setDescription("مسح التحذيرات")
.addUserOption(o=>o.setName("user").setDescription("الشخص").setRequired(true))

].map(c=>c.toJSON());

/*
REGISTER COMMANDS
*/

const rest = new REST({version:"10"}).setToken(TOKEN);

client.once("clientReady", async () => {

console.log(`✅ Logged in as ${client.user.tag}`);

await rest.put(
Routes.applicationGuildCommands(client.user.id,GUILD_ID),
{ body: commands }
);

console.log("✅ Commands Registered");

/*
AUTO JOIN VOICE
*/

const guild = client.guilds.cache.get(GUILD_ID);
if(!guild) return;

const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);
if(!channel) return;

if(!getVoiceConnection(guild.id)){

joinVoiceChannel({
channelId:channel.id,
guildId:guild.id,
adapterCreator:guild.voiceAdapterCreator,
selfDeaf:true
});

}

});

/*
LOG FUNCTION
*/

function sendLog(interaction, channelId, embed, row){

const channel = interaction.guild.channels.cache.get(channelId);

if(channel){
channel.send({
embeds:[embed],
components: row ? [row] : []
});
}

}

/*
COMMAND HANDLER
*/

client.on("interactionCreate", async interaction => {

if(!interaction.isChatInputCommand()) return;

const user = interaction.user;

/*
SEND
*/

if(interaction.commandName === "send"){

const target = interaction.options.getUser("user");
const message = interaction.options.getString("message");

try{

await target.send(`${message}\n\n<@${target.id}>`);

await interaction.reply({
content:"تم إرسال الرسالة بنجاح",
ephemeral:true
});

const embed = new EmbedBuilder()

.setColor("#2ecc71")

.setAuthor({
name:"📩 Send Command Used",
iconURL:user.displayAvatarURL()
})

.setThumbnail(target.displayAvatarURL())

.addFields(

{name:"👤 المرسل",value:`<@${user.id}>`,inline:true},
{name:"🆔 ID المرسل",value:user.id,inline:true},

{name:"📨 المستلم",value:`<@${target.id}>`,inline:true},
{name:"🆔 ID المستلم",value:target.id,inline:true},

{name:"💬 محتوى الرسالة",value:message},

{name:"📍 الروم",value:`<#${interaction.channel.id}>`,inline:true},
{name:"🖥 السيرفر",value:interaction.guild.name,inline:true},

{name:"📊 الحالة",value:"✅ تم الإرسال",inline:true}

)

.setTimestamp()

.setFooter({
text:`Server ID: ${interaction.guild.id}`
});

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setLabel("فتح بروفايل المرسل")
.setStyle(ButtonStyle.Link)
.setURL(`https://discord.com/users/${user.id}`)

);

sendLog(interaction, LOG_SEND, embed, row);

}catch{

interaction.reply({
content:"ما قدرت أرسل له خاص",
ephemeral:true
});

}

}

/*
WARN SYSTEM
*/

if(interaction.commandName === "warn"){

const target = interaction.options.getMember("user");
const level = interaction.options.getInteger("level");
const reason = interaction.options.getString("reason");

for(const role of Object.values(WARN_ROLES)){
if(target.roles.cache.has(role)){
await target.roles.remove(role).catch(()=>{});
}
}

const roleId = WARN_ROLES[level];

await target.roles.add(roleId).catch(()=>{});

if(level === 4){
await target.kick(reason).catch(()=>{});
}

if(level === 6){
await target.ban({reason}).catch(()=>{});
}

const embed = new EmbedBuilder()

.setColor("#e67e22")
.setTitle("⚠ Warn Added")

.addFields(
{name:"👤 المستخدم",value:`<@${target.id}>`,inline:true},
{name:"🚨 المستوى",value:`Warn ${level}`,inline:true},
{name:"⚠ السبب",value:reason},
{name:"🛡 المشرف",value:`<@${user.id}>`}
)

.setTimestamp();

interaction.reply({embeds:[embed]});

sendLog(interaction, LOG_WARN, embed);

}

});

client.login(TOKEN);
