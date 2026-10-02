# Jetstream

A simple web unblocker built on Scramjet. It has a search/URL home page, quick links, and a browser view with back, forward, reload, fullscreen and open-in-new-tab buttons. Proxied traffic goes through a Wisp server built into `server.js`.

## Running it

You need Node 20+, pnpm, and the Rust toolchain that the rewriter build requires (see the main README).

```sh
pnpm install
pnpm rewriter:build   # builds the WASM rewriter into dist/
pnpm build            # builds the Scramjet bundle into dist/
pnpm unblocker        # serves the unblocker on http://localhost:8080
```

### Environment variables

| Variable            | Default   | Description                                                               |
| ------------------- | --------- | ------------------------------------------------------------------------- |
| `PORT`              | `8080`    | Port to listen on                                                         |
| `HOST`              | `0.0.0.0` | Interface to bind                                                         |
| `ALLOW_PRIVATE_IPS` | unset     | Set to `1` to let the proxy reach localhost and private network addresses |

## Deploying

Service workers only run in a secure context, so outside `localhost` the site must be served over HTTPS. A reverse proxy like Caddy or nginx in front of `server.js` handles that. The reverse proxy must also forward WebSocket upgrades on `/wisp/`.

## Settings

The gear icon opens settings, which are saved in the browser:

- **Search engine**: DuckDuckGo, Google, Bing or Brave
- **Transport**: Epoxy or libcurl.js
- **Wisp server**: defaults to this server's `/wisp/`; you can point it at another Wisp server
