const express = require('express');
const WebSocket = require('ws');
const { Client } = require('ssh2');
const http = require('http');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ssh' });

// Configuración de TUS máquinas con DNS de No-IP
const virtualMachines = [
  { 
    id: 1, 
    name: "Servidor Ubuntu", 
    status: "En línea", 
    host: "amercado.ddns.net",  // Tu DNS de No-IP para Ubuntu
    port: 22,                   // Puerto SSH default
    username: "sirwilinston", // Reemplaza con tu usuario real
    password: "Cachuga123" // Reemplaza con tu password real
  },
  { 
    id: 2, 
    name: "Servidor Windows", 
    status: "En línea", 
    host: "tunamayo.ddns.net",  // Tu DNS de No-IP para Windows
    port: 2222,                 // Puerto SSH default
    username: "Tuna Mayo", // Reemplaza con tu usuario real
    password: "Cachuga123" // Reemplaza con tu password real
  }
];

// Middleware
app.use(cors());
app.use(express.json());

// Almacenar conexiones activas
const activeConnections = new Map();

wss.on('connection', (ws) => {
  console.log('Cliente WebSocket conectado');
  let sshClient = null;
  let sshStream = null;

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      console.log('Tipo de mensaje:', message.type);

      if (message.type === 'connect') {
        const vmId = message.vmId;
        const vmConfig = virtualMachines.find(vm => vm.id === vmId);
        
        if (!vmConfig) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Máquina virtual no encontrada' 
          }));
          return;
        }

        ws.send(JSON.stringify({
          type: 'status',
          message: `🔄 Conectando a ${vmConfig.name} (${vmConfig.host})...`
        }));

        sshClient = new Client();
        
        sshClient.on('ready', () => {
          console.log('✅ Conexión SSH establecida con:', vmConfig.host);
          ws.send(JSON.stringify({ 
            type: 'status', 
            message: `Conectado a ${vmConfig.name} (${vmConfig.host})` 
          }));

          sshClient.shell((err, stream) => {
            if (err) {
              console.error('Error al crear shell:', err);
              ws.send(JSON.stringify({ 
                type: 'error', 
                message: 'Error al crear sesión SSH: ' + err.message 
              }));
              return;
            }

            sshStream = stream;
            activeConnections.set(ws, { sshClient, stream });

            // Enviar datos del stream SSH al cliente
            stream.on('data', (data) => {
              ws.send(JSON.stringify({ 
                type: 'output', 
                data: data.toString('utf-8')
              }));
            });

            stream.on('close', () => {
              console.log('Stream SSH cerrado');
              ws.send(JSON.stringify({ 
                type: 'output', 
                data: '\r\n*** Conexión SSH cerrada ***\r\n' 
              }));
              activeConnections.delete(ws);
            });

            stream.stderr.on('data', (data) => {
              ws.send(JSON.stringify({ 
                type: 'output', 
                data: data.toString('utf-8')
              }));
            });
          });
        });

        sshClient.on('error', (err) => {
          console.error('❌ Error SSH con', vmConfig.host, ':', err.message);
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: `Error de conexión: ${err.message}` 
          }));
        });

        sshClient.on('close', () => {
          console.log('Conexión SSH cerrada con:', vmConfig.host);
          activeConnections.delete(ws);
        });

        // Configuración de conexión SSH
        const sshConfig = {
          host: vmConfig.host,
          port: vmConfig.port,
          username: vmConfig.username,
          password: vmConfig.password,
          readyTimeout: 25000,  // 25 segundos timeout
          algorithms: {
            kex: [
              'diffie-hellman-group1-sha1',
              'ecdh-sha2-nistp256',
              'ecdh-sha2-nistp384',
              'ecdh-sha2-nistp521',
              'diffie-hellman-group-exchange-sha256',
              'diffie-hellman-group14-sha1'
            ],
            cipher: [
              'aes128-ctr',
              'aes192-ctr',
              'aes256-ctr',
              'aes128-gcm',
              'aes128-gcm@openssh.com',
              'aes256-gcm',
              'aes256-gcm@openssh.com',
              'aes256-cbc'
            ]
          }
        };

        console.log(`🔗 Intentando conectar a: ${vmConfig.host}:${vmConfig.port}`);
        sshClient.connect(sshConfig);

      } else if (message.type === 'input' && sshStream) {
        // Enviar comandos del usuario al servidor SSH
        sshStream.write(message.data);
      }

    } catch (error) {
      console.error('Error procesando mensaje:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Error: ' + error.message 
      }));
    }
  });

  ws.on('close', () => {
    console.log('Cliente WebSocket desconectado');
    if (activeConnections.has(ws)) {
      const { sshClient } = activeConnections.get(ws);
      sshClient.end();
      activeConnections.delete(ws);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Endpoint para obtener lista de VMs
app.get('/api/vms', (req, res) => {
  const vmList = virtualMachines.map(vm => ({
    id: vm.id,
    name: vm.name,
    status: vm.status,
    host: vm.host,
    port: vm.port
  }));
  res.json(vmList);
});

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeConnections: activeConnections.size
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor SSH Gateway ejecutándose en puerto ${PORT}`);
  console.log(`📡 Máquinas configuradas:`);
  virtualMachines.forEach(vm => {
    console.log(`   • ${vm.name}: ${vm.host}:${vm.port}`);
  });
});