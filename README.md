# CastSync / Tvcast

Pair two browsers using a QR link or six-digit code. The controller sends commands; the receiver loads media directly. No screen mirroring or video relay through the phone.

## Run locally

Install Node.js 22.12 or newer (Node.js 24 LTS recommended), then:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000` on the computer. On a phone or TV on the same local network, open `http://YOUR_COMPUTER_LAN_IP:3000`. Do not use `localhost` on the second device: it refers to that device itself. Permit the server through your computer's firewall if necessary. Open the same server address on both devices so the QR link is reachable from either device.

1. On the receiving device, select **Let This Device Be Controlled**.
2. On the controller, select **Control Another Device**.
3. Enter the six-digit code or open the QR link.
4. Send a direct supported video URL or choose a sample video.

Camera QR scanning needs HTTPS or localhost. On LAN HTTP, enter the pairing code instead, or scan the QR with the phone's camera app. Browsers may require a local tap/OK on the receiver for sound or fullscreen. A remote command cannot supply a browser user gesture.

## Production

```sh
npm ci
npm run build
npm start
```

`npm start` and `npm run preview` run the Express server with the built frontend and Socket.IO API. Vite's standalone preview server does not provide the pairing API.

The server listens on `0.0.0.0` and honors `PORT` (default `3000`). Scripts load an optional `.env`; see `.env.example`. Use a Node.js host with WebSocket support and HTTPS. A static-only host cannot run this backend. Configure your reverse proxy to forward normal requests and WebSocket upgrades, including `/socket.io/`.

Sessions are held in memory. Run one backend instance for now; restarting it clears pairings. Multiple replicas need shared session storage and a Socket.IO adapter before they can serve the same pairing reliably.

## Vite / AI Studio preview

Development HMR shares the application's HTTP server and infers the browser's public port. There is no hardcoded port 443. `DISABLE_HMR=true` is respected even in middleware mode; it does not disable Socket.IO. If the preview proxy does not forward HMR upgrades, use this switch. For proxies requiring explicit settings, set `HMR_HOST`, `HMR_PROTOCOL`, and `HMR_CLIENT_PORT` in the server environment. Leave them unset locally.

## Playback compatibility

Direct MP4/WebM and other browser-supported HTML5 sources support play/pause, seeking, volume where permitted, and fullscreen. Codec and format support varies by browser; HLS URLs require native browser HLS support in this version. A URL must be an actual playable source, not simply a webpage containing a video.

External webpages and YouTube/Vimeo embeds can be shown when their embedding rules allow it, but their playback controls are not integrated. The app cannot inspect cross-origin iframe video elements. DRM services such as Netflix and Disney+ are not remotely controllable here. Back/forward navigates URLs opened through this app, not a third-party iframe's internal history. The directional pad controls the receiver's own interface, not arbitrary cross-origin webpages.

A short network interruption restores the same role using a private token within the 30-second grace period. Reloading a page or restarting the server requires pairing again. Pairing codes expire after five minutes; a connected session is not terminated by that pairing deadline. Only the paired controller can send commands and only the receiver can publish playback state or end its receiver session.

## Verification

```sh
npm run lint
npm run build
npm test
```

Integration tests start real development and production servers and check the Vite HMR WebSocket, code/QR pairing, command and state delivery, unauthorized access, token-based reconnection, invalid payload handling, and production frontend/API serving.
