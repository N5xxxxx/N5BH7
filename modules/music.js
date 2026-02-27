client.on("clientReady", () => {
  const guild = client.guilds.cache.first();
  const connection = getVoiceConnection(guild.id);
  if (connection) connection.subscribe(player);
});
