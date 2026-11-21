const messageList = document.querySelector('#message-list');
const emptyState = document.querySelector('#empty-state');
const messageForm = document.querySelector('#message-form');
const nameInput = document.querySelector('#name-input');
const messageInput = document.querySelector('#message-input');
const connectionIndicator = document.querySelector('#connection-indicator');
const connectionStatus = document.querySelector('#connection-status');
const reconnectButton = document.querySelector('#reconnect-button');
const composerNote = document.querySelector('#composer-note');

const maxReconnectAttempts = 5;
let reconnectAttempts = 0;
let reconnectTimer;
let stableConnectionTimer;
let activeSocket;

function setConnectionStatus(label, state) {
    connectionStatus.textContent = label;
    connectionIndicator.dataset.state = state;
}

function connect() {
    setConnectionStatus('Connecting', 'connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
    activeSocket = socket;

    socket.addEventListener('open', () => {
        if (socket !== activeSocket) return;
        setConnectionStatus('Connected', 'connected');
        reconnectButton.hidden = true;
        composerNote.textContent = 'Connected to the room.';
        stableConnectionTimer = window.setTimeout(() => {
            reconnectAttempts = 0;
        }, 30000);
    });

    socket.addEventListener('message', (event) => {
        let message;
        try {
            message = JSON.parse(event.data);
        } catch {
            return;
        }

        if (message.type !== 'chat' || typeof message.name !== 'string' || typeof message.text !== 'string') return;
        appendMessage(message);
    });

    socket.addEventListener('error', () => {
        if (socket === activeSocket) composerNote.textContent = 'Connection interrupted.';
    });

    socket.addEventListener('close', () => {
        if (socket !== activeSocket) return;
        window.clearTimeout(stableConnectionTimer);
        scheduleReconnect();
    });
}

function scheduleReconnect() {
    setConnectionStatus('Disconnected', 'disconnected');
    if (reconnectAttempts >= maxReconnectAttempts) {
        composerNote.textContent = 'Could not reconnect.';
        reconnectButton.hidden = false;
        return;
    }

    const delay = Math.min(1000 * (2 ** reconnectAttempts), 8000);
    reconnectAttempts += 1;
    setConnectionStatus(`Retrying in ${Math.ceil(delay / 1000)}s`, 'connecting');
    composerNote.textContent = 'Connection lost. Trying again...';
    reconnectTimer = window.setTimeout(connect, delay);
}

function appendMessage(message) {
    emptyState?.remove();

    const item = document.createElement('li');
    item.className = 'message';
    if (message.name === getSenderName()) item.classList.add('message--mine');

    const avatar = document.createElement('span');
    avatar.className = `message-avatar ${getAvatarTone(message.name)}`;
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = message.name.slice(0, 1).toUpperCase();

    const content = document.createElement('div');
    content.className = 'message-content';

    const meta = document.createElement('div');
    meta.className = 'message-meta';

    const author = document.createElement('span');
    author.className = 'message-author';
    author.textContent = message.name;

    const time = document.createElement('time');
    time.className = 'message-time';
    const sentAt = new Date(message.sentAt);
    time.dateTime = Number.isNaN(sentAt.getTime()) ? '' : sentAt.toISOString();
    time.textContent = Number.isNaN(sentAt.getTime())
        ? ''
        : sentAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const text = document.createElement('p');
    text.className = 'message-text';
    text.textContent = message.text;

    meta.append(author, time);
    content.append(meta, text);
    item.append(avatar, content);
    messageList.append(item);
    messageList.scrollTop = messageList.scrollHeight;
}

function getSenderName() {
    return nameInput.value.trim().slice(0, 24) || 'Guest';
}

function getAvatarTone(name) {
    const tone = [...name].reduce((total, character) => total + character.charCodeAt(0), 0) % 4;
    return `message-avatar--${tone}`;
}

messageForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;

    if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) {
        composerNote.textContent = 'Not connected. Your message was not sent.';
        return;
    }

    activeSocket.send(JSON.stringify({ type: 'chat', name: getSenderName(), text }));
    messageInput.value = '';
    messageInput.focus();
    composerNote.textContent = 'Connected to the room.';
});

reconnectButton.addEventListener('click', () => {
    window.clearTimeout(reconnectTimer);
    reconnectAttempts = 0;
    reconnectButton.hidden = true;
    connect();
});

connect();