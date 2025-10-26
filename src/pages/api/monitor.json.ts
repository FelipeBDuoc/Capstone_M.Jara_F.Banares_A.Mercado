import type { APIRoute } from 'astro';
// Importamos 'Agent' de https para solucionar el problema de SSL
import { Agent } from 'https';
// Importamos axios para realizar las peticiones
import axios from 'axios';

// --- Configuración ---
// Lista de VMs que quieres monitorear
const VM_IDS = [100, 101, 102];
// ---------------------

// Lee las variables de entorno
const BASE_URL = import.meta.env.PROXMOX_URL; // Ej: https://192.168.1.100:8006
const NODE = import.meta.env.PROXMOX_NODE;
const TOKEN_ID = import.meta.env.PROXMOX_TOKEN_ID;
const TOKEN_SECRET = import.meta.env.PROXMOX_TOKEN_SECRET;

// Crea el header de autorización
const AUTH_HEADER = `PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}`;

// SOLUCIÓN PARA 'FETCH FAILED' (SSL):
// 1. Creamos un agente HTTPS que ignora los certificados no válidos
const httpsAgent = new Agent({
  rejectUnauthorized: false,
});

// 2. Creamos una instancia de axios pre-configurada
const proxmoxApi = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': AUTH_HEADER,
    'Accept': 'application/json',
  },
  // 3. Aplicamos el agente para ignorar el error SSL
  httpsAgent: httpsAgent,
  timeout: 5000, // Opcional: añade un timeout de 5 segundos
});


export const GET: APIRoute = async () => {
  // 1. Verificar que todas las variables de entorno estén cargadas
  if (!BASE_URL || !NODE || !TOKEN_ID || !TOKEN_SECRET) {
    console.error("Error: Faltan variables de entorno de Proxmox.");
    return new Response(
      JSON.stringify({ error: 'Configuración del servidor incompleta.' }),
      { status: 500 }
    );
  }

  try {
    // 2. Crear un array de promesas (una por cada VM) usando axios
    const fetchPromises = VM_IDS.map(id => {
      
      // Construimos la URL (relativa a la baseURL de axios)
      const url = `/api2/json/nodes/${NODE}/qemu/${id}/status/current`;
      
      return proxmoxApi.get(url)
        .then(res => {
          // Con axios, la respuesta JSON está en res.data
          // Verificamos que Proxmox nos devuelva la estructura esperada
          if (!res.data || !res.data.data) {
            throw new Error(`Respuesta inesperada de Proxmox para VM ${id}`);
          }
          // Devolvemos solo el objeto 'data' que contiene la info
          return res.data.data;
        })
        .catch(error => {
          // Mejor manejo de errores con axios
          if (axios.isAxiosError(error)) {
            const status = error.response?.status || 'N/A';
            const statusText = error.response?.statusText || error.message;
            throw new Error(`Error en VM ${id} (Axios): ${status} ${statusText}`);
          }
          // Error genérico
          throw new Error(`Error en VM ${id}: ${error.message}`);
        });
    });

    // 3. Ejecutar todas las promesas en paralelo
    const results = await Promise.allSettled(fetchPromises);

    // 4. Procesar y limpiar los resultados (esta lógica es idéntica a la tuya)
    const allVmDdata = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        // Todo salió bien para esta VM
        return result.value; 
      } else {
        // La petición para esta VM falló
        const vmId = VM_IDS[index];
        console.error(`Fallo al obtener VM ${vmId}:`, result.reason.message);
        // Devolvemos un objeto de error para esta VM
        return { 
          vmid: vmId, 
          status: 'error', 
          name: `VM ${vmId}`, // Nombre temporal
          error: result.reason.message 
        };
      }
    });

    // 5. Devolver el array con todos los datos
    return new Response(JSON.stringify(allVmDdata), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    // Error general (si algo muy grave pasa)
    console.error('Error general en la API Route:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
    });
  }
};