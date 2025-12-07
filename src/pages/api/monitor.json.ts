import type { APIRoute } from 'astro';
import { Agent } from 'https';
import axios from 'axios';
import { prisma } from "../../lib/prisma";


// Lee las variables de entorno
const BASE_URL = import.meta.env.PROXMOX_URL;
const NODE = import.meta.env.PROXMOX_NODE;
const TOKEN_ID = import.meta.env.PROXMOX_TOKEN_ID;
const TOKEN_SECRET = import.meta.env.PROXMOX_TOKEN_SECRET;

const AUTH_HEADER = `PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}`;

const httpsAgent = new Agent({
  rejectUnauthorized: false,
});

const proxmoxApi = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': AUTH_HEADER,
    'Accept': 'application/json',
  },
  httpsAgent: httpsAgent,
  timeout: 5000,
});

/**
 * Procesa la respuesta de 'get-fsinfo' para obtener el uso de disco.
 * Lee 'used-bytes' y 'total-bytes' del JSON.
 */
function getDiskUsage(fsInfo: any) {
  // Si no hay 'result' o está vacío, devolvemos 0
  if (!fsInfo || !fsInfo.result || fsInfo.result.length === 0) {
    return { disk: 0, maxdisk: 1 };
  }

  // 1. Buscamos el filesystem raíz ('/')
  const rootFs = fsInfo.result.find((fs: any) => fs.mountpoint === '/');
  
  if (rootFs && rootFs['total-bytes'] > 0) {
    return {
      disk: rootFs['used-bytes'],    
      maxdisk: rootFs['total-bytes'] 
    };
  }

  // 2. Fallback: Si no encontramos '/', sumamos todos los discos válidos
  let totalUsed = 0;
  let totalMax = 0;
  fsInfo.result.forEach((fs: any) => {
    if (fs['total-bytes'] > 0 && fs.mountpoint) {
        totalUsed += fs['used-bytes'];    
        totalMax += fs['total-bytes'];   
    }
  });

  return { 
    disk: totalUsed, 
    maxdisk: totalMax > 0 ? totalMax : 1 
  };
}

export const GET: APIRoute = async () => {
  if (!BASE_URL || !NODE || !TOKEN_ID || !TOKEN_SECRET) {
    console.error("Error: Faltan variables de entorno de Proxmox.");
    return new Response(JSON.stringify({ error: 'Configuración del servidor incompleta.' }), { status: 500 });
  }

  try {
    // 1. OBTENER MÁQUINAS DE LA BASE DE DATOS (En lugar del array fijo)
    // Esto asegura que monitoreamos lo que está registrado en tu sistema
    const dbMachines = await prisma.serverConfig.findMany();

    if (!dbMachines || dbMachines.length === 0) {
        // Si no hay máquinas en la DB, devolvemos array vacío sin error
        return new Response(JSON.stringify([]), { status: 200 });
    }

    // 2. ITERAR SOBRE LAS MÁQUINAS DE LA DB
    const fetchPromises = dbMachines.map(machine => {
      const id = machine.proxmoxId;
      
      const statusUrl = `/api2/json/nodes/${NODE}/qemu/${id}/status/current`;
      const fsUrl = `/api2/json/nodes/${NODE}/qemu/${id}/agent/get-fsinfo`;
      
      const statusPromise = proxmoxApi.get(statusUrl);
      const fsPromise = proxmoxApi.get(fsUrl); 

      return Promise.allSettled([statusPromise, fsPromise])
        .then(([statusResult, fsResult]) => {
          
          // A. Procesar status
          if (statusResult.status === 'rejected' || !statusResult.value.data || !statusResult.value.data.data) {
            // Si falla Proxmox, devolvemos un objeto básico con la info de la DB y status error
            // para que no desaparezca de la lista visual
            return {
                vmid: id,
                name: machine.name, // Usamos nombre de la DB
                status: 'stopped',  // Asumimos stopped si no responde (o 'error')
                host: machine.host,
                cpu: 0,
                mem: 0,
                maxmem: 1,
                disk: 0,
                maxdisk: 1,
                uptime: 0
            };
          }
          const vmData = statusResult.value.data.data; 

          // B. Procesar disco
          let diskInfo = { disk: 0, maxdisk: vmData.maxdisk || 1 };
          
          if (fsResult.status === 'fulfilled' && fsResult.value.data && fsResult.value.data.data) {
             const fsData = fsResult.value.data.data; 
             diskInfo = getDiskUsage(fsData); 
          } else {
             // Fallback al disco asignado en VM config si el agente no responde
             diskInfo.maxdisk = vmData.maxdisk || 1; 
          }
          
          // C. MERGE FINAL: Datos de Proxmox + Datos de DB (Host, Nombre personalizado)
          const mergedData = {
            ...vmData,           // Datos vivos (cpu, mem, status, uptime)
            disk: diskInfo.disk,       
            maxdisk: diskInfo.maxdisk,
            // Sobreescribimos/Aseguramos datos estáticos desde la DB
            name: machine.name,  
            host: machine.host,
            sshPort: machine.port, // Útil si el frontend lo necesita para mostrar
            sshUser: machine.username
          };

          return mergedData;
        })
        .catch(error => {
            // Error catastrófico en el procesamiento de esta VM específica
            console.error(`Error procesando VM ${id}:`, error);
            return {
                vmid: id,
                name: machine.name,
                host: machine.host,
                status: 'error',
                error: error.message
            };
        });
    });

    const results = await Promise.allSettled(fetchPromises);

    const allVmDdata = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value; 
      } else {
        // Fallback final si la promesa principal falló (raro porque tenemos catch arriba)
        const machine = dbMachines[index];
        console.error(`Fallo crítico al obtener datos de VM ${machine.proxmoxId}:`, result.reason.message);
        return { 
          vmid: machine.proxmoxId, 
          status: 'error', 
          name: machine.name,
          host: machine.host,
          error: result.reason.message 
        };
      }
    });

    return new Response(JSON.stringify(allVmDdata), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error general en la API Route:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
    });
  }
};