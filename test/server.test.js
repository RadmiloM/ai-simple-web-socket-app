const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const WebSocket = require('ws');
const { createChatServer } = require('../server');

function connect(url) {
    const client = new WebSocket(url);
    return new Promise((resolve, reject) => {
        client.once('open', () => resolve(client));
        client.once('error', reject);
    });
}

function receiveMessage(client) {
    return new Promise((resolve, reject) => {
        client.once('message', (data) => resolve(JSON.parse(data.toString())));
        client.once('error', reject);
    });
}

test('broadcasts valid messages to every client and ignores malformed input', async (context) => {
    const { server, webSocketServer } = createChatServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    context.after(async () => {
        for (const client of webSocketServer.clients) client.terminate();
        await new Promise((resolve) => server.close(resolve));
    });

    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const page = await fetch(baseUrl);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Wire \| Simple Chat/);

    const clientScript = await fetch(`${baseUrl}/client.js`);
    const stylesheet = await fetch(`${baseUrl}/style.css`);
    assert.equal(clientScript.status, 200);
    assert.equal(stylesheet.status, 200);

    const url = `ws://127.0.0.1:${server.address().port}/ws`;
    const [sender, recipient] = await Promise.all([connect(url), connect(url)]);
    const senderMessage = receiveMessage(sender);
    const recipientMessage = receiveMessage(recipient);

    sender.send('not-json');
    sender.send(JSON.stringify({ type: 'chat', name: '', text: 'ignored' }));
    sender.send(JSON.stringify({ type: 'chat', name: ' Ana ', text: ' hello ' }));

    const [fromSender, fromRecipient] = await Promise.all([senderMessage, recipientMessage]);
    assert.deepEqual(fromSender, fromRecipient);
    assert.equal(fromSender.type, 'chat');
    assert.equal(fromSender.name, 'Ana');
    assert.equal(fromSender.text, 'hello');
    assert.ok(Number.isNaN(Date.parse(fromSender.sentAt)) === false);
});