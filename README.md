# CastSync Browser Remote

CastSync pairs a phone with Chrome on a computer. Search Google or enter a web address on the phone, open the result in a real Chrome tab, view a live preview, tap the preview to click, type into selected fields, navigate with a D-pad, control compatible media, and switch the browser window to a clean fullscreen view.

The real-browser workflow uses two parts:

- The hosted CastSync web app provides pairing and the phone remote.
- The **CastSync Browser Bridge** Chrome extension controls the computer's real tab.

This avoids iframe embedding restrictions. The target website runs in the computer's normal Chrome profile with its own JavaScript, cookies, logins, server selectors, and video player.

## Requirements

- Node.js 24 or newer for the web app server
- Google Chrome or a Chromium browser that supports Manifest V3 on the controlled computer
- HTTPS and WebSocket support on the public host
- One backend replica while sessions remain in memory

## Install the Chrome extension

Install the extension on the computer that will display the websites:

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository's `chrome-extension` folder.
6. Open the CastSync receiver page, click the extension icon, and choose **Connect This CastSync**.
7. The page refreshes automatically; choose **This is my screen** and pair the phone.

The extension requests access to HTTP and HTTPS pages because it must navigate, click, type, inspect media, and capture the visible tab for the phone preview. Only the CastSync origin explicitly approved from the extension popup can send bridge commands. It does not send browsing data to a separate analytics service. Preview images and browser state travel only through the paired CastSync session.

## Use it

1. Open the hosted CastSync URL on the computer and choose **This is my screen**.
2. Open the same CastSync URL on the phone and choose **Use my phone**.
3. Enter the six-digit code or scan the QR code.
4. Search Google or type a website address in the phone's omnibox.
5. Tap the phone preview to click items on the computer page.
6. Use **Type on page** after selecting a text field, or use the D-pad.
7. Use the fullscreen button to fill the computer window with the largest video or embedded player.

The supplied Kurd Cinema example opens as a normal Chrome page. Its server selector and third-party player therefore run in the same way they do during normal browsing. Media controls depend on the player. If the player is inside a supported cross-origin frame, the extension searches that frame for a playable media element; otherwise use the player's visible controls through preview tapping.

## Fullscreen behavior

Fullscreen performs both actions below:

- switches the target Chrome window to operating-system fullscreen;
- expands the largest visible `video`, `iframe`, or `embed` element over the page.

CastSync's receiver header, status message, title, and playback HUD are not displayed over the target tab. Exit fullscreen restores the page styles and the previous normal or maximized window state.

## Run locally

```sh
npm ci
npm run dev
```

Open `http://localhost:3000` on the computer. On another device in the same network, use `http://YOUR_COMPUTER_LAN_IP:3000`; `localhost` on the phone refers to the phone itself. Camera QR scanning generally requires HTTPS, so entering the six-digit code is easier on local HTTP.

## Production

```sh
npm ci --include=dev
npm run build
npm start
```

The server listens on `0.0.0.0` and uses `PORT`, defaulting to `3000`. The host must forward normal HTTPS traffic and WebSocket upgrades for `/socket.io/`. A static-only host cannot run pairing.

For Railpack-compatible hosting, use Node 24, `npm ci --include=dev && npm run build` as the build command, and `npm start` as the start command. Railway is optional.

## Security and practical limits

Only the paired controller can send browser commands, and only the paired receiver can publish browser previews. The server validates command types, HTTP/HTTPS destinations, normalized pointer coordinates, typed-text length, and screenshot size.

The extension cannot control Chrome internal pages, browser permission dialogs, CAPTCHA dialogs, or operating-system dialogs. DRM services and some protected players may reject scripted play or media inspection; visible preview tapping still behaves like a normal page click when the site permits it. A background receiver tab must remain open so it can keep the phone session connected.

## Project commands

```sh
npm run lint
npm run build
npm test
```

For version 0.3.0, TypeScript compilation, the production build, and JavaScript syntax checks for the extension are the packaging checks. Runtime playback testing was intentionally omitted for this change.
