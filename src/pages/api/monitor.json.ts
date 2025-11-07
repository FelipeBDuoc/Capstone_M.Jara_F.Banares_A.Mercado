import type { APIRoute } from 'astro';
import { Agent } from 'https';
import axios from 'axios';

// --- Configuración ---
const VM_IDS = [100, 101, 102];
// ---------------------

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
 * (FUNCIÓN CORREGIDA)
 * Procesa la respuesta de 'get-fsinfo' para obtener el uso de disco.
 * Lee 'used-bytes' y 'total-bytes' del JSON.
 */
function getDiskUsage(fsInfo) {
  // Si no hay 'result' o está vacío, devolvemos 0
  if (!fsInfo || !fsInfo.result || fsInfo.result.length === 0) {
    return { disk: 0, maxdisk: 1 };
  }

  // 1. Buscamos el filesystem raíz ('/')
  const rootFs = fsInfo.result.find(fs => fs.mountpoint === '/');
  
  // ¡CAMBIO CLAVE AQUÍ!
  if (rootFs && rootFs['total-bytes'] > 0) {
    return {
      disk: rootFs['used-bytes'],    // <-- CORREGIDO
      maxdisk: rootFs['total-bytes'] // <-- CORREGIDO
    };
  }

  // 2. Fallback: Si no encontramos '/', sumamos todos los discos
  let totalUsed = 0;
  let totalMax = 0;
  fsInfo.result.forEach(fs => {
    // Solo sumamos si son discos válidos (tienen 'device' o 'total-bytes')
    if (fs['total-bytes'] > 0 && fs.mountpoint) {
        totalUsed += fs['used-bytes'];    // <-- CORREGIDO
        totalMax += fs['total-bytes'];   // <-- CORREGIDO
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
    // Hacemos dos peticiones por VM (status + disco)
    const fetchPromises = VM_IDS.map(id => {
      
      const statusUrl = `/api2/json/nodes/${NODE}/qemu/${id}/status/current`;
      const fsUrl = `/api2/json/nodes/${NODE}/qemu/${id}/agent/get-fsinfo`;
      
      const statusPromise = proxmoxApi.get(statusUrl);
      const fsPromise = proxmoxApi.get(fsUrl); 

      return Promise.allSettled([statusPromise, fsPromise])
        .then(([statusResult, fsResult]) => {
          
          // 1. Procesar status
          if (statusResult.status === 'rejected' || !statusResult.value.data || !statusResult.value.data.data) {
            throw new Error(`No se pudo obtener el estado (status/current) para VM ${id}`);
          }
          const vmData = statusResult.value.data.data; 

          // 2. Procesar disco
          let diskInfo = { disk: 0, maxdisk: vmData.maxdisk || 1 };
          
          if (fsResult.status === 'fulfilled' && fsResult.value.data && fsResult.value.data.data) {
             const fsData = fsResult.value.data.data; 
             diskInfo = getDiskUsage(fsData); 
          } else {
             diskInfo.maxdisk = vmData.maxdisk || 1; 
          }
          
          const mergedData = {
            ...vmData,
            disk: diskInfo.disk,       
            maxdisk: diskInfo.maxdisk  
          };

          return mergedData;
        })
        .catch(error => {
          throw new Error(`Error procesando datos para VM ${id}: ${error.message}`);
        });
    });

    const results = await Promise.allSettled(fetchPromises);

    const allVmDdata = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value; 
      } else {
        const vmId = VM_IDS[index];
        console.error(`Fallo al obtener datos completos de VM ${vmId}:`, result.reason.message);
        return { 
          vmid: vmId, 
          status: 'error', 
          name: `VM ${vmId}`,
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