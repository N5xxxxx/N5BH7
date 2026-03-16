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
DMALL
*/

if(interaction.commandName === "dmall"){

const message = interaction.options.getString("message");

await interaction.reply({
content:"جاري ارسال الرسائل...",
ephemeral:true
});

const members = await interaction.guild.members.fetch();

let count = 0;

for(const member of members.values()){

if(member.user.bot) continue;

await member.send(`${message}\n\n<@${member.id}>`).catch(()=>{});

count++;

}

const embed = new EmbedBuilder()

.setColor("#9b59b6")
.setTitle("📬 DMALL Used")

.addFields(
{name:"👤 المرسل",value:`<@${user.id}>`,inline:true},
{name:"🆔 ID",value:user.id,inline:true},
{name:"📊 عدد المستلمين",value:`${count}`,inline:true},
{name:"💬 الرسالة",value:message}
)

.setTimestamp()

.setFooter({text:interaction.guild.name});

sendLog(interaction, LOG_DMALL, embed);

}

/*
WARN
*/

if(interaction.commandName === "warn"){

const target = interaction.options.getUser("user");
const reason = interaction.options.getString("reason");

if(!warnings.has(target.id)){
warnings.set(target.id,[]);
}

warnings.get(target.id).push(reason);

interaction.reply({
content:`تم تحذير ${target.tag}`,
ephemeral:true
});

const embed = new EmbedBuilder()

.setColor("#e67e22")
.setTitle("⚠ Warn Added")

.addFields(
{name:"👤 المستخدم",value:`<@${target.id}>`,inline:true},
{name:"🆔 ID",value:target.id,inline:true},
{name:"📛 الاسم",value:target.tag,inline:true},
{name:"⚠ السبب",value:reason},
{name:"🛡 المشرف",value:`<@${user.id}>`}
)

.setTimestamp()

.setFooter({text:interaction.guild.name});

sendLog(interaction, LOG_WARN, embed);

}

/*
WARNINGS
*/

if(interaction.commandName === "warnings"){

const target = interaction.options.getUser("user");
const list = warnings.get(target.id) || [];

const embed = new EmbedBuilder()

.setColor("#f1c40f")
.setTitle(`⚠ Warnings List`)

.addFields(
{name:"👤 المستخدم",value:`<@${target.id}>`},
{name:"📊 العدد",value:`${list.length}`},
{name:"📄 القائمة",value:list.length ? list.join("\n") : "لا يوجد"}
)

.setTimestamp();

interaction.reply({embeds:[embed]});

sendLog(interaction, LOG_WARNINGS, embed);

}

/*
CLEAR WARNINGS
*/

if(interaction.commandName === "clearwarnings"){

const target = interaction.options.getUser("user");

warnings.delete(target.id);

interaction.reply({
content:"تم مسح التحذيرات",
ephemeral:true
});

const embed = new EmbedBuilder()

.setColor("#2ecc71")
.setTitle("🧹 Warnings Cleared")

.addFields(
{name:"👤 المستخدم",value:`<@${target.id}>`},
{name:"🆔 ID",value:target.id},
{name:"🛡 بواسطة",value:`<@${user.id}>`}
)

.setTimestamp();

sendLog(interaction, LOG_CLEARWARN, embed);

}

});

client.login(TOKEN);
