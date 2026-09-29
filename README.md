# CastSync / Tvcast

Pair two browsers using a QR link or six-digit code. The controller sends commands; the receiver loads media directly. No screen mirroring or video relay through the phone.

## Run locally

Install Node.js 24 or newer, then:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000` on the computer. On a phone or TV on the same local network, open `http://YOUR_COMPUTER_LAN_IP:3000`. Do not use `localhost` on the second device: it refers to that device itself. Permit the server through your computer's firewall if necessary. Open the same server address on both devices so the QR link is reachable from either device.

1. On the receiving device, select **Let This Device Be Controlled**.
2. On the controller, select **Control Another Device**.
3. Enter the six-digit code or open the QR link.
4. In **Browse websites**, enter a public HTTPS webpage, follow its page links, and select a video with **Play**. You can also paste a YouTube/Vimeo video page URL or choose a sample video.

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

## Browse websites and choose videos

The phone now has a website explorer instead of requiring a raw video file URL. Enter an HTTPS page, navigate its extracted links, and choose a video. The controller does not play or relay media: it sends the selected source to the receiver.

The explorer detects HTML5 `video`/`source` elements, supported player iframes, direct media links, Open Graph video URLs, and JSON-LD VideoObject metadata. Relative links and signed source URLs are preserved. Extensionless sources discovered in HTML video metadata are sent as media, not treated as webpages.

Try `https://www.w3schools.com/html/html5_video.asp` to test browsing a page and choosing its video. YouTube watch, mobile, Shorts, live, and shortened video links and Vimeo video links are also recognized. YouTube and Vimeo use their official player APIs for play/pause, seek, volume where supported, and playback-state synchronization. Embedding permissions, regional availability, and autoplay rules still apply.

This is a link-and-video explorer, not a full remote browser executing another website's scripts. It cannot enumerate videos that appear only after JavaScript runs, behind sign-in, or behind access restrictions. A website home page can produce page links with no videos; follow a video page link. A page with no discoverable sources shows an honest empty state. YouTube search/channel/playlist browsing is not integrated; use an individual video page link. DRM services such as Netflix and Disney+ remain unsupported. No authentication, embedding protections, or DRM are bypassed.

Public-page requests require a paired controller token, are rate-limited, and accept public HTTPS URLs only. DNS addresses are checked and pinned for every connection and redirect; private networks, credentials, and custom ports are rejected. Page size and request time are bounded. External scripts and HTML are never executed or injected into the controller.

Direct HTML5 sources support browser-compatible codecs. HLS requires native support in this version. Browser volume/fullscreen policies vary; the receiver may need a local tap to enable playback, sound, or fullscreen. Back/forward navigates URLs opened through this app, not a third-party webpage's internal history.

## Deploy on Railway

Connect `Avestroxel/Tvcast`, select branch `main`, and use:

```text
Build Command: npm ci --include=dev && npm run build
Start Command: npm start
RAILPACK_NODE_VERSION: 24
RAILPACK_NO_SPA: true
```

The build generates both `dist/` (frontend) and `build/server.js` (backend). Production runs the compiled JavaScript backend; it does not rely on native TypeScript execution or a Vite dev server. Keep a single replica while pairing sessions are in memory. Generate a public domain and open the same URL on both devices. After a GitHub update, deploy the latest commit and refresh both devices.

A short network interruption restores the same role using a private token within the 30-second grace period. Reloading a page or restarting the server requires pairing again. Pairing codes expire after five minutes; a connected session is not terminated by that pairing deadline. Only the paired controller can send commands and only the receiver can publish playback state or end its receiver session.

## Verification

```sh
npm run lint
npm run build
npm test
```

Integration tests start real development and production servers and check the Vite HMR WebSocket, code/QR pairing, command and state delivery, unauthorized access, token-based reconnection, invalid payload handling, production frontend/API serving, public webpage discovery, provider URL parsing, and website-browser access/network restrictions.
