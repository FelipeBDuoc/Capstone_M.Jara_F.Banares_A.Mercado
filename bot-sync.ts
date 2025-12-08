// bot-sync.ts
import { Client, GatewayIntentBits } from 'discord.js';
import { prisma } from './src/lib/prisma';

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const ADMIN_ROLE_ID = process.env.ID_ROL_ADMIN;
const MOD_ROLE_ID = process.env.ID_ROL_MOD;
const SERVER_ID = process.env.MI_SERVIDOR_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

client.on('ready', async () => {
  console.log(`🤖 Bot conectado como ${client.user?.tag}`);

  if (!SERVER_ID) {
    console.error("❌ ERROR: No se encontró MI_SERVIDOR_ID en el archivo .env");
    return;
  }

  const myGuild = client.guilds.cache.get(SERVER_ID);

  console.log('⏳ Cargando usuarios en memoria...');
  
  if (myGuild) {
    try {
      await myGuild.members.fetch();
      console.log(`✅ Caché cargada para: ${myGuild.name} (${myGuild.memberCount} miembros)`);
    } catch (error) {
      console.error(`❌ Error cargando miembros de ${myGuild.name}:`, error);
    }

    console.log('🚀 ¡Listo para detectar cambios de roles!');

  } else {
    console.error(`❌ El bot no tiene acceso al servidor con ID: ${SERVER_ID}`);
  }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  
  if (oldMember.roles.cache.equals(newMember.roles.cache)) {
    return; 
  }

  let dbRole = "usuario";
  
  if (newMember.roles.cache.has(ADMIN_ROLE_ID!)) {
    dbRole = "admin";
  } else if (newMember.roles.cache.has(MOD_ROLE_ID!)) {
    dbRole = "mod";
  }

  console.log(`🔄 Detectado cambio de roles para ${newMember.user.tag}. Nuevo rol calculado: ${dbRole}`);

  try {
    await prisma.user.update({
      where: { discordId: newMember.id },
      data: { role: dbRole },
    });
  } catch (error) {
    console.log(`El usuario no está en la DB, se omite.`);
  }
});

client.login(DISCORD_BOT_TOKEN);