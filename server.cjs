// server.cjs (En la raíz del proyecto)

// 1. Cargar variables de entorno del archivo .env de la raíz
require('dotenv').config(); 

const express = require('express');
const WebSocket = require('ws');
const { Client } = require('ssh2');
const http = require('http');
const cors = require('cors');
const crypto = require('crypto');
// Importamos PrismaClient. Como estamos en la raíz, node_modules está aquí mismo.
const { PrismaClient } = require('@prisma/client');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ssh' });
const prisma = new PrismaClient();

// Configuración de encriptado
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

// Validación de seguridad al iniciar
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  console.error("❌ [SERVER SSH] ERROR CRÍTICO: ENCRYPTION_KEY en .env falta o no tiene 32 caracteres.");
  process.exit(1);
}

function decrypt(text) {
  if (!text) return text;
  if (!text.includes(':')) return text; 

  try {
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
  } catch (error) {
    console.error("Error desencriptando password:", error.message);
    return null;
  }
}

app.use(cors());
app.use(express.json());

const activeConnections = new Map();

wss.on('connection', (ws) => {
  console.log('🔌 Cliente WebSocket conectado al Proxy SSH');
  let sshClient = null;
  let sshStream = null;

  ws.on('message', async (messageData) => {
    try {
      const message = JSON.parse(messageData);

      if (message.type === 'connect') {
        const { vmId } = message;

        // Buscar VM en la base de datos
        const vm = await prisma.serverConfig.findUnique({
          where: { proxmoxId: Number(vmId) }
        });

        if (!vm) {
          ws.send(JSON.stringify({ type: 'error', message: 'VM no encontrada en BD' }));
          return;
        }

        ws.send(JSON.stringify({ type: 'status', message: `Conectando a ${vm.host}...` }));

        const decryptedPassword = decrypt(vm.password);
        const decryptedUsername = decrypt(vm.username);
        
        if (!decryptedPassword) {
             ws.send(JSON.stringify({ type: 'error', message: 'Error: No se pudo desencriptar la contraseña.' }));
             return;
        }

        const sshConfig = {
          host: vm.host,
          port: vm.port,
          username: decryptedUsername,
          password: decryptedPassword,
          readyTimeout: 20000, 
        };

        sshClient = new Client();
        activeConnections.set(ws, { sshClient });

        sshClient.on('ready', () => {
          ws.send(JSON.stringify({ type: 'status', message: '✅ Conexión SSH Establecida' }));
          
          sshClient.shell((err, stream) => {
            if (err) {
              ws.send(JSON.stringify({ type: 'error', message: 'Error Shell: ' + err.message }));
              return;
            }
            
            sshStream = stream;

            stream.on('data', (data) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
              }
            });

            stream.on('close', () => {
              ws.send(JSON.stringify({ type: 'status', message: 'Sesión SSH cerrada' }));
              ws.close();
            });
          });
        });

        sshClient.on('error', (err) => {
          ws.send(JSON.stringify({ type: 'error', message: 'Error SSH: ' + err.message }));
        });
        
        sshClient.connect(sshConfig);

      } else if (message.type === 'input' && sshStream) {
        sshStream.write(message.data);
      }

    } catch (error) {
      console.error('Error procesando mensaje:', error);
    }
  });

  ws.on('close', () => {
    if (activeConnections.has(ws)) {
      const { sshClient } = activeConnections.get(ws);
      if (sshClient) sshClient.end();
      activeConnections.delete(ws);
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Proxy SSH corriendo en http://localhost:${PORT}`);
});