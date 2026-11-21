const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;

const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_NAME_LENGTH = 24;
const MAX_MESSAGE_LENGTH = 1000;
const ASSETS = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/client.js': ['client.js', 'text/javascript; charset=utf-8'],
    '/style.css': ['style.css', 'text/css; charset=utf-8'],
};

function createChatServer() {
    const server = createServer(async (request, response) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, { Allow: 'GET, HEAD' });
            response.end('Method not allowed');
            return;
        }

        let pathname;
        try {
            pathname = new URL(request.url, 'http://localhost').pathname;
        } catch {
            response.writeHead(400);
            response.end('Bad request');
            return;
        }

        const asset = ASSETS[pathname];
        if (!asset) {
            response.writeHead(404);
            response.end('Not found');
            return;
        }

        try {
            const body = await readFile(path.join(PUBLIC_DIR, asset[0]));
            response.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-store' });
            response.end(request.method === 'HEAD' ? undefined : body);
        } catch {
            response.writeHead(500);
            response.end('Unable to load the chat application');
        }
    });

    const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

    server.on('upgrade', (request, socket, head) => {
        let pathname;
        try {
            pathname = new URL(request.url, 'http://localhost').pathname;
        } catch {
            socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
            return;
        }

        if (pathname !== '/ws') {
            socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
            return;
        }

        webSocketServer.handleUpgrade(request, socket, head, (client) => {
            webSocketServer.emit('connection', client, request);
        });
    });

    webSocketServer.on('connection', (client) => {
        client.on('message', (data, isBinary) => {
            if (isBinary) return;

            let message;
            try {
                message = JSON.parse(data.toString('utf8'));
            } catch {
                return;
            }

            if (!message || message.type !== 'chat') return;
            if (typeof message.name !== 'string' || typeof message.text !== 'string') return;

            const name = message.name.trim().slice(0, MAX_NAME_LENGTH);
            const text = message.text.trim().slice(0, MAX_MESSAGE_LENGTH);
            if (!name || !text) return;

            const payload = JSON.stringify({
                type: 'chat',
                name,
                text,
                sentAt: new Date().toISOString(),
            });

            for (const recipient of webSocketServer.clients) {
                if (recipient.readyState === WebSocket.OPEN) recipient.send(payload);
            }
        });
    });

    return { server, webSocketServer };
}

if (require.main === module) {
    const { server } = createChatServer();
    const port = Number(process.env.PORT) || 3000;
    server.listen(port, () => {
        console.log(`Chat server listening at http://localhost:${port}`);
    });
}

module.exports = { createChatServer };