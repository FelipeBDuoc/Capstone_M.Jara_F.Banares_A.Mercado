import type { APIRoute } from 'astro';
import { prisma } from "../../lib/prisma";
import { Agent } from 'https';
import axios from 'axios';

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
    const response = await proxmoxApi.get('/api2/json/cluster/resources');
    const allResources = response.data.data;

    const currentProxmoxMachines = allResources.filter((res: any) => 
      (res.type === 'qemu' || res.type === 'lxc') && res.vmid
    );

    const currentDbMachines = await prisma.serverConfig.findMany({
      select: { proxmoxId: true, name: true } 
    });

    const existingDbIds = currentDbMachines.map((m) => m.proxmoxId);
    
    const existingProxmoxIds = currentProxmoxMachines.map((m: any) => m.vmid);

    const machinesToAdd = currentProxmoxMachines.filter((m: any) => 
      !existingDbIds.includes(m.vmid)
    );

    const machinesToDelete = currentDbMachines.filter((m) => 
      !existingProxmoxIds.includes(m.proxmoxId)
    );

    const protectedMachinesCount = currentProxmoxMachines.length - machinesToAdd.length;

    const results = {
      added: 0,
      deleted: 0,
      protected: protectedMachinesCount,
      details: [] as string[]
    };

    for (const machine of machinesToAdd) {
      const type = machine.type === 'qemu' ? 'VM' : 'CT'; // CT = Container
      
      await prisma.serverConfig.create({
        data: {
          proxmoxId: machine.vmid,
          name: machine.name || `Machine-${machine.vmid}`, // Nombre default de Proxmox
          type: type,
          host: DEFAULT_HOST,
          username: 'root', 
          password: 'changeme', 
          port: 22
        }
      });
      
      results.added++;
      results.details.push(`[NUEVA] Agregada: ${machine.name} (ID: ${machine.vmid})`);
    }

    for (const machine of machinesToDelete) {
      await prisma.serverConfig.delete({
        where: { proxmoxId: machine.proxmoxId }
      });
      
      results.deleted++;
      results.details.push(`[ELIMINADA] Borrada: ${machine.name} (ID: ${machine.proxmoxId})`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Sincronización finalizada.',
      stats: results 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('CRITICAL: Error en sincronización:', error);
    return new Response(JSON.stringify({ 
      error: 'Error interno al procesar la sincronización', 
      details: error.message 
    }), { status: 500 });
  }
};