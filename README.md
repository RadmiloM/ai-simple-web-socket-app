# Wire Chat

A small browser chat that uses WebSockets to deliver messages between everyone connected to the same room. The Node.js server also serves the page, so no frontend build step is needed.

## Run locally

Requirements: Node.js 18 or newer.

```sh
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in two browser tabs, choose a name in each, and send a message. The server broadcasts it to both tabs. Set the `PORT` environment variable to use a different port.

Run the integration tests with:

```sh
npm test
```

Messages are held in memory and disappear when the server stops. There are no accounts or persistent chat history.
