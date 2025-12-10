import type { APIRoute } from 'astro';
import { PrismaClient } from '@prisma/client';
import { Agent } from 'https';
import axios from 'axios';

const prisma = new PrismaClient();

// Configuración
const BASE_URL = import.meta.env.PROXMOX_URL;
const TOKEN_ID = import.meta.env.PROXMOX_TOKEN_ID;
const TOKEN_SECRET = import.meta.env.PROXMOX_TOKEN_SECRET;
const DEFAULT_HOST = import.meta.env.DEFAULT_DNS_HOST || 'midns.com'; 

const AUTH_HEADER = `PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}`;
const httpsAgent = new Agent({ rejectUnauthorized: false });

const proxmoxApi = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': AUTH_HEADER,
    'Accept': 'application/json',
  },
  httpsAgent: httpsAgent,
  timeout: 10000,
});

export const POST: APIRoute = async () => {
  if (!BASE_URL || !TOKEN_ID || !TOKEN_SECRET) {
    return new Response(JSON.stringify({ error: 'Faltan variables de entorno' }), { status: 500 });
  }

  try {
    // 1. Obtener estado actual de PROXMOX
    const response = await proxmoxApi.get('/api2/json/cluster/resources');
    const allResources = response.data.data;

    // Filtramos solo VMs y CTs con ID
    const proxmoxMachines = allResources.filter((res: any) => 
      (res.type === 'qemu' || res.type === 'lxc') && res.vmid
    );

    // 2. Obtener estado actual de BASE DE DATOS
    const dbMachines = await prisma.serverConfig.findMany();

    const results = {
      added: 0,
      updated: 0,
      recreated: 0, // Nueva métrica: Máquinas reseteadas por cambio de tipo
      deleted: 0,
      details: [] as string[]
    };

    // ---------------------------------------------------------
    // 3. PROCESAR MÁQUINAS DE PROXMOX (Crear, Actualizar o Resetear)
    // ---------------------------------------------------------
    
    // Lista de IDs vistos en Proxmox para luego saber cuáles borrar de la DB
    const seenProxmoxIds = new Set();

    for (const pMachine of proxmoxMachines) {
      seenProxmoxIds.add(pMachine.vmid);

      // Determinamos el tipo actual en Proxmox
      const currentType = pMachine.type === 'qemu' ? 'VM' : 'CT';
      const currentName = pMachine.name || `Machine-${pMachine.vmid}`;

      // Buscamos si ya existe en la DB
      const dbMachine = dbMachines.find(m => m.proxmoxId === pMachine.vmid);

      if (!dbMachine) {
        // CASO 1: NO EXISTE -> CREAR NUEVA
        await prisma.serverConfig.create({
          data: {
            proxmoxId: pMachine.vmid,
            name: currentName,
            type: currentType,
            host: DEFAULT_HOST,
            username: 'changeme',
            password: 'changeme', // Password por defecto para nuevas
            port: 22
          }
        });
        results.added++;
        results.details.push(`[NUEVA] ID ${pMachine.vmid}: ${currentName}`);

      } else {
        // CASO 2: YA EXISTE -> VERIFICAR CONFLICTOS

        // A. ¿Cambió el tipo? (Ej: Era VM, ahora es CT con el mismo ID)
        if (dbMachine.type !== currentType) {
          // ¡CONFLICTO! Es una máquina nueva reutilizando ID.
          // Borramos la configuración vieja y creamos una default.
          
          // Usamos transacción para que sea atómico (borrar y crear)
          await prisma.$transaction([
            prisma.serverConfig.delete({ where: { id: dbMachine.id } }),
            prisma.serverConfig.create({
              data: {
                proxmoxId: pMachine.vmid,
                name: currentName,
                type: currentType,
                host: DEFAULT_HOST,
                username: 'root',
                password: 'changeme', // Reset de password porque es máquina nueva
                port: 22
              }
            })
          ]);

          results.recreated++;
          results.details.push(`[RESET] ID ${pMachine.vmid}: Cambió de ${dbMachine.type} a ${currentType}. Se reiniciaron credenciales.`);
        
        } else {
          // B. Mismo ID, Mismo Tipo. ¿Cambió el nombre?
          // Solo actualizamos el nombre para mantenerlo sincronizado.
          // NO tocamos password ni usuario.
          if (dbMachine.name !== currentName) {
            await prisma.serverConfig.update({
              where: { id: dbMachine.id },
              data: { name: currentName }
            });
            results.updated++;
            // No lo agregamos a detalles para no llenar el log, o opcionalmente:
            // results.details.push(`[UPDATE] ID ${pMachine.vmid}: Nombre actualizado.`);
          }
        }
      }
    }

    // ---------------------------------------------------------
    // 4. ELIMINAR MÁQUINAS QUE YA NO EXISTEN
    // ---------------------------------------------------------
    
    // Las que están en la DB pero NO vimos en el bucle anterior
    const machinesToDelete = dbMachines.filter(m => !seenProxmoxIds.has(m.proxmoxId));

    for (const machine of machinesToDelete) {
      await prisma.serverConfig.delete({
        where: { id: machine.id }
      });
      results.deleted++;
      results.details.push(`[ELIMINADA] ID ${machine.proxmoxId}: Ya no existe en Proxmox.`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      stats: results 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error sincronizando:', error);
    return new Response(JSON.stringify({ 
      error: 'Error interno', 
      details: error.message 
    }), { status: 500 });
  }
};