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

/* ✅ روم الفيديو */
const VIDEO_ROOM = "1477417977472090316";

/* ✅ حالة النظام */
let mediaOnlyEnabled = true;

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
const stats = new Map();
const VOICE_TIMES = new Map();
const LEADERBOARD_CHANNEL = "1484809257361870892";
const REQUIRED_ROLE = "1426999940944756889";
/*
CLIENT
*/

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.GuildVoiceStates,

GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
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
.addUserOption(o=>o.setName("user").setDescription("الشخص").setRequired(true)),

new SlashCommandBuilder()
.setName("mediaonly")
.setDescription("تشغيل او ايقاف نظام الصور فقط"),

new SlashCommandBuilder()
.setName("leaderboard")
.setDescription("عرض التوب")

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

/* ✅ فلترة الروم */

client.on("messageCreate", async (message) => {
if(!message.member.roles.cache.has(REQUIRED_ROLE)) return;
if(!mediaOnlyEnabled) return;
if(message.author.bot) return;

if(message.attachments.size === 0){
return message.delete().catch(()=>{});
}

if(message.content && message.content.trim() !== ""){
return message.delete().catch(()=>{});
}
if(!stats.has(message.author.id)){
stats.set(message.author.id,{messages:0,voice:0});
}

stats.get(message.author.id).messages++;
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

if(interaction.commandName === "mediaonly"){

mediaOnlyEnabled = !mediaOnlyEnabled;

return interaction.reply({
content: mediaOnlyEnabled ? "✅ تم تشغيل النظام" : "❌ تم ايقاف النظام",
ephemeral:true
});

}
if(interaction.commandName === "leaderboard"){

const sorted = [...stats.entries()]
.sort((a,b)=> (b[1].messages + b[1].voice) - (a[1].messages + a[1].voice))
.slice(0,10);

let text = "";

sorted.forEach((user,index)=>{

const id = user[0];
const data = user[1];

const hours = Math.floor(data.voice / 1000 / 60 / 60);
const minutes = Math.floor((data.voice / 1000 / 60) % 60);

text += `\n${index+1}. <@${id}>
💬 ${data.messages} | ⏱ ${hours}h ${minutes}m\n`;

});

const embed = new EmbedBuilder()
.setTitle("🏆 Leaderboard - النخبة")
.setDescription(text || "لا يوجد بيانات")
.setColor("#00ffcc");

interaction.reply({embeds:[embed]});

}
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

warnings.set(target.id,{
level:level,
reason:reason,
moderator:user.id,
time:Date.now(),
channel:interaction.channel.id
});

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
{name:"🆔 ID",value:target.id,inline:true},
{name:"🚨 المستوى",value:`Warn ${level}`,inline:true},
{name:"⚠ السبب",value:reason},
{name:"🛡 المشرف",value:`<@${user.id}>`,inline:true},
{name:"📍 الروم",value:`<#${interaction.channel.id}>`,inline:true},
{name:"🖥 السيرفر",value:interaction.guild.name,inline:true}
)

.setTimestamp();

interaction.reply({embeds:[embed]});

sendLog(interaction, LOG_WARN, embed);

}

/*
WARNINGS
*/

if(interaction.commandName === "warnings"){

const target = interaction.options.getUser("user");

const data = warnings.get(target.id);

if(!data){

return interaction.reply({
content:"لا يوجد تحذيرات لهذا المستخدم",
ephemeral:true
});

}

const embed = new EmbedBuilder()

.setColor("#f1c40f")
.setTitle("⚠ Warnings List")

.addFields(
{name:"👤 المستخدم",value:`<@${target.id}>`,inline:true},
{name:"🆔 ID",value:target.id,inline:true},
{name:"🚨 المستوى",value:`Warn ${data.level}`,inline:true},
{name:"⚠ السبب",value:data.reason},
{name:"🛡 المشرف",value:`<@${data.moderator}>`,inline:true},
{name:"📍 الروم",value:`<#${data.channel}>`,inline:true},
{name:"🕒 وقت التحذير",value:`<t:${Math.floor(data.time/1000)}:F>`}
)

.setTimestamp()

.setFooter({text:interaction.guild.name});

interaction.reply({embeds:[embed]});

sendLog(interaction, LOG_WARNINGS, embed);

}

/*
CLEAR WARNINGS
*/

if(interaction.commandName === "clearwarnings"){

const target = interaction.options.getMember("user");

warnings.delete(target.id);

for(const role of Object.values(WARN_ROLES)){
if(target.roles.cache.has(role)){
await target.roles.remove(role).catch(()=>{});
}
}

interaction.reply({
content:"تم مسح التحذيرات",
ephemeral:true
});

const embed = new EmbedBuilder()

.setColor("#2ecc71")
.setTitle("🧹 Warnings Cleared")

.addFields(
{name:"👤 المستخدم",value:`<@${target.id}>`},
{name:"🛡 بواسطة",value:`<@${user.id}>`}
)

.setTimestamp();

sendLog(interaction, LOG_CLEARWARN, embed);

}

});

/*
WARN ROLE PROTECTION
*/

client.on("guildMemberUpdate", async (oldMember,newMember)=>{

const data = warnings.get(newMember.id);
if(!data) return;

const warnRole = WARN_ROLES[data.level];
if(!warnRole) return;

const hadRole = oldMember.roles.cache.has(warnRole);
const hasRole = newMember.roles.cache.has(warnRole);

if(hadRole && !hasRole){

const logs = await newMember.guild.fetchAuditLogs({
limit:1,
type:25
}).catch(()=>null);

if(!logs) return;

const entry = logs.entries.first();
if(!entry) return;

if(entry.executor.id !== client.user.id){

await newMember.roles.add(warnRole).catch(()=>{});

}

}

});

/* 🔥 حماية البوت الصوتي */

client.on("voiceStateUpdate", async (oldState, newState) => {

const botId = client.user.id;

if(oldState.id !== botId) return;

/* إذا اننقل */
if(oldState.channelId && newState.channelId && newState.channelId !== VOICE_CHANNEL_ID){

try{
await newState.setChannel(VOICE_CHANNEL_ID);
}catch{}

}

/* إذا انطرد */
if(oldState.channelId && !newState.channelId){

try{

joinVoiceChannel({
channelId: VOICE_CHANNEL_ID,
guildId: oldState.guild.id,
adapterCreator: oldState.guild.voiceAdapterCreator,
selfDeaf: true
});

}catch{}

}

});
client.on("voiceStateUpdate",(oldState,newState)=>{

const member = newState.member;
if(!member.roles.cache.has(REQUIRED_ROLE)) return;

const userId = newState.id;

if(!oldState.channelId && newState.channelId){
VOICE_TIMES.set(userId,Date.now());
}

if(oldState.channelId && !newState.channelId){

const joinTime = VOICE_TIMES.get(userId);
if(!joinTime) return;

const diff = Date.now() - joinTime;

if(!stats.has(userId)){
stats.set(userId,{messages:0,voice:0});
}

stats.get(userId).voice += diff;

VOICE_TIMES.delete(userId);

}

});
client.login(TOKEN);
