import type { APIRoute } from 'astro';
import { Agent } from 'https';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuración
const BASE_URL = import.meta.env.PROXMOX_URL;
const NODE = import.meta.env.PROXMOX_NODE;
const TOKEN_ID = import.meta.env.PROXMOX_TOKEN_ID;
const TOKEN_SECRET = import.meta.env.PROXMOX_TOKEN_SECRET;

const AUTH_HEADER = `PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}`;

const httpsAgent = new Agent({ rejectUnauthorized: false });

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
 * Función auxiliar para disco QEMU (VM)
 */
function getQemuDiskUsage(fsInfo: any) {
  if (!fsInfo || !fsInfo.result || fsInfo.result.length === 0) {
    return { disk: 0, maxdisk: 1 };
  }
  // Intentar buscar root
  const rootFs = fsInfo.result.find((fs: any) => fs.mountpoint === '/');
  if (rootFs && rootFs['total-bytes'] > 0) {
    return { disk: rootFs['used-bytes'], maxdisk: rootFs['total-bytes'] };
  }
  // Fallback suma total
  let totalUsed = 0; let totalMax = 0;
  fsInfo.result.forEach((fs: any) => {
    if (fs['total-bytes'] > 0 && fs.mountpoint) {
        totalUsed += fs['used-bytes'];    
        totalMax += fs['total-bytes'];   
    }
  });
  return { disk: totalUsed, maxdisk: totalMax > 0 ? totalMax : 1 };
}

export const GET: APIRoute = async () => {
  if (!BASE_URL || !NODE || !TOKEN_ID || !TOKEN_SECRET) {
    return new Response(JSON.stringify({ error: 'Configuración incompleta' }), { status: 500 });
  }

  try {
    const dbMachines = await prisma.serverConfig.findMany();
    if (!dbMachines || dbMachines.length === 0) return new Response(JSON.stringify([]));

    const fetchPromises = dbMachines.map(machine => {
      const id = machine.proxmoxId;
      
      // 1. DETERMINAR TIPO DE RECURSO (qemu vs lxc)
      // La DB guarda 'VM' o 'CT'. 
      const resourceType = (machine.type === 'CT' || machine.type === 'LXC') ? 'lxc' : 'qemu';

      // 2. URLs DINÁMICAS
      const statusUrl = `/api2/json/nodes/${NODE}/${resourceType}/${id}/status/current`;
      
      // Solo las VMs QEMU usan agente para disco detallado. Los LXC lo traen en el status.
      const useAgent = resourceType === 'qemu';
      const fsUrl = useAgent ? `/api2/json/nodes/${NODE}/qemu/${id}/agent/get-fsinfo` : null;
      
      const statusPromise = proxmoxApi.get(statusUrl);
      const fsPromise = useAgent ? proxmoxApi.get(fsUrl!) : Promise.resolve(null);

      return Promise.allSettled([statusPromise, fsPromise])
        .then(([statusResult, fsResult]) => {
          
          // --- PROCESAR STATUS ---
          if (statusResult.status === 'rejected' || !statusResult.value.data || !statusResult.value.data.data) {
             // Si falla, retornamos objeto básico offline
             return {
                vmid: id,
                name: machine.name,
                type: machine.type, // Pasamos el tipo al frontend
                status: 'stopped',
                host: machine.host,
                cpu: 0, mem: 0, maxmem: 1, disk: 0, maxdisk: 1, uptime: 0
             };
          }
          
          const apiData = statusResult.value.data.data;

          // --- PROCESAR DISCO ---
          let diskInfo = { disk: 0, maxdisk: 1 };

          if (resourceType === 'lxc') {
             // LOGICA PARA CONTENEDORES (LXC)
             // LXC devuelve 'rootfs' en el status directamente
             if (apiData.rootfs) {
                diskInfo.disk = apiData.rootfs.used || 0;
                diskInfo.maxdisk = apiData.rootfs.total || apiData.maxdisk || 1;
             } else {
                diskInfo.disk = apiData.disk || 0;
                diskInfo.maxdisk = apiData.maxdisk || 1;
             }
          } else {
             // LOGICA PARA VIRTUAL MACHINES (QEMU)
             if (fsResult && fsResult.status === 'fulfilled' && fsResult.value && fsResult.value.data) {
                diskInfo = getQemuDiskUsage(fsResult.value.data.data);
             } else {
                // Fallback si no hay guest agent
                diskInfo.maxdisk = apiData.maxdisk || 1;
             }
          }

          // MERGE FINAL
          return {
            ...apiData,
            disk: diskInfo.disk,
            maxdisk: diskInfo.maxdisk,
            name: machine.name, 
            host: machine.host,
            type: machine.type, // Importante enviar el tipo para el icono
            sshPort: machine.port,
            sshUser: machine.username
          };
        })
        .catch(err => ({
            vmid: id, name: machine.name, status: 'error', error: err.message
        }));
    });

    const results = await Promise.all(fetchPromises);
    
    // Filtramos posibles nulls o estructuras raras
    return new Response(JSON.stringify(results), { status: 200 });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Server Error' }), { status: 500 });
  }
};