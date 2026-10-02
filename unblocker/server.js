// Production server for the Scramjet unblocker.
// Serves the unblocker UI, the built Scramjet bundle, the bare-mux transports,
// and a Wisp server for the transports to tunnel traffic through.
//
// Build Scramjet first (`pnpm rewriter:build && pnpm build`), then run
// `pnpm unblocker`.
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";

const here = fileURLToPath(new URL(".", import.meta.url));
const distPath = join(here, "../dist");

if (!existsSync(join(distPath, "scramjet.all.js"))) {
	console.error(
		"Scramjet has not been built yet. Run `pnpm rewriter:build && pnpm build` first."
	);
	process.exit(1);
}

// Block the proxy from reaching the host's own network unless explicitly allowed.
const allowPrivate = process.env.ALLOW_PRIVATE_IPS === "1";
wisp.options.allow_loopback_ips = allowPrivate;
wisp.options.allow_private_ips = allowPrivate;

const fastify = Fastify({
	serverFactory: (handler) =>
		createServer()
			.on("request", (req, res) => {
				// Required for SharedArrayBuffer, which Scramjet's sync XHR uses.
				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
				handler(req, res);
			})
			.on("upgrade", (req, socket, head) => {
				if (req.url.startsWith("/wisp/")) {
					wisp.routeRequest(req, socket, head);
				} else {
					socket.end();
				}
			}),
});

const mounts = [
	[join(here, "public"), "/"],
	[distPath, "/scram/"],
	[baremuxPath, "/baremux/"],
	[epoxyPath, "/epoxy/"],
	[libcurlPath, "/libcurl/"],
];
for (const [root, prefix] of mounts) {
	fastify.register(fastifyStatic, { root, prefix, decorateReply: false });
}

fastify.setNotFoundHandler((request, reply) => {
	// Proxied requests are handled by the service worker; anything that lands
	// here means the worker was not active yet.
	if (request.url.startsWith("/scramjet/")) {
		reply.redirect("/");
	} else {
		reply.code(404).send("Not found");
	}
});

const PORT = parseInt(process.env.PORT) || 8080;
const HOST = process.env.HOST || "0.0.0.0";

fastify.listen({ port: PORT, host: HOST }).then(() => {
	console.log(`Unblocker running at http://localhost:${PORT}/`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
	process.on(signal, () => {
		fastify.close();
		process.exit(0);
	});
}
