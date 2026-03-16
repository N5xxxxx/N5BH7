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
const LOG_WARN = "1482927462168920186";
const LOG_WARNINGS = "1482927612627128516";
const LOG_DMALL = "1482927730050859080";
const LOG_ANNOUNCE = "1482927840960843896";
const LOG_CLEARWARN = "1482927958548287499";

const warnings = new Map();

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.GuildVoiceStates
]
});

/*
COMMANDS (تم اصلاحها فقط)
*/

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
.setRequired(true)),

new SlashCommandBuilder()
.setName("announce")
.setDescription("ارسال اعلان")
.addChannelOption(option =>
option.setName("channel")
.setDescription("الروم")
.addChannelTypes(ChannelType.GuildText)
.setRequired(true))
.addStringOption(option =>
option.setName("title")
.setDescription("العنوان"))
.addStringOption(option =>
option.setName("message")
.setDescription("الرسالة")
.setRequired(true)),

new SlashCommandBuilder()
.setName("dmall")
.setDescription("ارسال رسالة لكل السيرفر")
.addStringOption(option =>
option.setName("message")
.setDescription("الرسالة")
.setRequired(true)),

new SlashCommandBuilder()
.setName("warn")
.setDescription("تحذير عضو")
.addUserOption(option =>
option.setName("user")
.setDescription("الشخص")
.setRequired(true))
.addStringOption(option =>
option.setName("reason")
.setDescription("السبب")
.setRequired(true)),

new SlashCommandBuilder()
.setName("warnings")
.setDescription("عرض تحذيرات عضو")
.addUserOption(option =>
option.setName("user")
.setDescription("الشخص")
.setRequired(true)),

new SlashCommandBuilder()
.setName("clearwarnings")
.setDescription("مسح التحذيرات")
.addUserOption(option =>
option.setName("user")
.setDescription("الشخص")
.setRequired(true))

].map(c=>c.toJSON());

const rest = new REST({version:"10"}).setToken(TOKEN);

/*
READY
*/

client.once("clientReady",async()=>{

console.log(`✅ Logged in as ${client.user.tag}`);

await rest.put(
Routes.applicationGuildCommands(client.user.id,GUILD_ID),
{body:commands}
);

console.log("✅ Commands Registered");

/*
AUTO JOIN VOICE
*/

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

/*
COMMAND HANDLER
*/

client.on("interactionCreate",async interaction=>{

if(!interaction.isChatInputCommand()) return;

const user = interaction.user;

function log(channelId,embed,button){

const channel = interaction.guild.channels.cache.get(channelId);

if(channel){

channel.send({
embeds:[embed],
components:button ? [button] : []
});

}

}

/*
SEND
*/

if(interaction.commandName==="send"){

const target = interaction.options.getUser("user");
const message = interaction.options.getString("message");

try{

await target.send(`${message}\n\n<@${target.id}>`);

interaction.reply({
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

{name:"👤 المرسل",value:`<@${user.id}>`,inline:true},
{name:"🆔 ID المرسل",value:user.id,inline:true},

{name:"📨 المستلم",value:`<@${target.id}>`,inline:true},
{name:"🆔 ID المستلم",value:target.id,inline:true},

{name:"💬 محتوى الرسالة",value:message},

{name:"📊 الحالة",value:"✅ تم الإرسال",inline:true}

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

log(LOG_SEND,embed,row);

}catch{

interaction.reply({
content:"ما قدرت أرسل له خاص",
ephemeral:true
});

}

}

/*
ANNOUNCE
*/

if(interaction.commandName==="announce"){

const channel = interaction.options.getChannel("channel");
const title = interaction.options.getString("title") || "اعلان";
const message = interaction.options.getString("message");

const embed = new EmbedBuilder()
.setColor("#3498db")
.setTitle(title)
.setDescription(message)
.setFooter({text:`بواسطة ${user.tag}`})
.setTimestamp();

channel.send({embeds:[embed]});

interaction.reply({
content:"تم ارسال الاعلان",
ephemeral:true
});

const logEmbed = new EmbedBuilder()

.setColor("#3498db")
.setTitle("📢 استخدام امر اعلان")

.addFields(
{name:"المرسل",value:`<@${user.id}>`},
{name:"الروم",value:`${channel}`}
)

.setTimestamp();

log(LOG_ANNOUNCE,logEmbed);

}

/*
DMALL
*/

if(interaction.commandName==="dmall"){

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
.setTitle("📬 DM All")

.addFields(
{name:"المرسل",value:`<@${user.id}>`},
{name:"عدد الاعضاء",value:`${count}`}
)

.setTimestamp();

log(LOG_DMALL,embed);

}

/*
WARN
*/

if(interaction.commandName==="warn"){

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
.setTitle("⚠️ Warn")

.addFields(
{name:"المستخدم",value:`<@${target.id}>`},
{name:"السبب",value:reason},
{name:"المشرف",value:`<@${user.id}>`}
)

.setTimestamp();

log(LOG_WARN,embed);

}

/*
WARNINGS
*/

if(interaction.commandName==="warnings"){

const target = interaction.options.getUser("user");

const list = warnings.get(target.id) || [];

const embed = new EmbedBuilder()

.setColor("#f1c40f")
.setTitle(`تحذيرات ${target.tag}`)
.setDescription(list.length ? list.join("\n") : "لا يوجد تحذيرات")
.setTimestamp();

interaction.reply({embeds:[embed]});

log(LOG_WARNINGS,embed);

}

/*
CLEAR WARNINGS
*/

if(interaction.commandName==="clearwarnings"){

const target = interaction.options.getUser("user");

warnings.delete(target.id);

interaction.reply({
content:"تم مسح التحذيرات",
ephemeral:true
});

const embed = new EmbedBuilder()

.setColor("#2ecc71")
.setTitle("🧹 Clear Warnings")

.addFields(
{name:"المستخدم",value:`<@${target.id}>`},
{name:"بواسطة",value:`<@${user.id}>`}
)

.setTimestamp();

log(LOG_CLEARWARN,embed);

}

});

client.login(TOKEN);
