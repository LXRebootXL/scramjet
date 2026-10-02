"use strict";

// ---------- Settings ----------

const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const DEFAULTS = {
	engine: "https://duckduckgo.com/?q=%s",
	transport: "/epoxy/index.mjs",
	wisp: `${wsProtocol}//${location.host}/wisp/`,
};

function loadSettings() {
	try {
		return {
			...DEFAULTS,
			...JSON.parse(localStorage.getItem("jetstream:settings")),
		};
	} catch {
		return { ...DEFAULTS };
	}
}

function saveSettings() {
	try {
		localStorage.setItem("jetstream:settings", JSON.stringify(settings));
	} catch {}
}

let settings = loadSettings();

// ---------- Scramjet setup ----------

const { ScramjetController } = $scramjetLoadController();
const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
});
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

async function setTransport() {
	await connection.setTransport(settings.transport, [{ wisp: settings.wisp }]);
}

async function waitForController() {
	if (navigator.serviceWorker.controller) return;
	await new Promise((resolve) =>
		navigator.serviceWorker.addEventListener("controllerchange", resolve, {
			once: true,
		})
	);
}

const ready = (async () => {
	if (!("serviceWorker" in navigator)) {
		throw new Error(
			"Service workers are unavailable. Open this site over HTTPS or on localhost."
		);
	}
	await navigator.serviceWorker.register("/sw.js");
	await waitForController();
	await scramjet.init();
	await setTransport();
})();

// ---------- Helpers ----------

const $ = (id) => document.getElementById(id);
const home = $("home");
const browser = $("browser");
const barInput = $("bar-input");
const loading = $("loading");
const errorBox = $("error");

function toUrl(input) {
	input = input.trim();
	if (!input) return null;

	// Already a full URL
	if (/^https?:\/\//i.test(input)) return input;

	// Looks like a domain (has a dot, no spaces), e.g. "example.com/path"
	if (!/\s/.test(input) && /^[^/]+\.[a-z]{2,}(?::\d+)?(\/.*)?$/i.test(input)) {
		return "https://" + input;
	}

	return settings.engine.replace("%s", encodeURIComponent(input));
}

function showError(message) {
	errorBox.textContent = message;
	errorBox.hidden = false;
}

// ---------- Browser ----------

const frame = scramjet.createFrame();
$("frame-container").appendChild(frame.frame);

frame.addEventListener("urlchange", (e) => {
	if (e.url && document.activeElement !== barInput) barInput.value = e.url;
});

frame.frame.addEventListener("load", () => {
	loading.classList.remove("active");
	try {
		const title = frame.frame.contentDocument?.title;
		document.title = title ? `${title} · Jetstream` : "Jetstream";
	} catch {}
});

async function navigate(input) {
	const url = toUrl(input);
	if (!url) return;

	try {
		await ready;
	} catch (err) {
		showError(err.message);
		return;
	}

	home.hidden = true;
	browser.hidden = false;
	barInput.value = url;
	barInput.blur();
	loading.classList.remove("active");
	void loading.offsetWidth; // restart the animation
	loading.classList.add("active");
	frame.go(url);
}

function goHome() {
	browser.hidden = true;
	home.hidden = false;
	frame.frame.src = "about:blank";
	document.title = "Jetstream";
	$("home-input").value = "";
	$("home-input").focus();
}

$("home-form").addEventListener("submit", (e) => {
	e.preventDefault();
	navigate($("home-input").value);
});

$("bar-form").addEventListener("submit", (e) => {
	e.preventDefault();
	navigate(barInput.value);
});

barInput.addEventListener("focus", () => barInput.select());

$("btn-home").addEventListener("click", goHome);
$("btn-back").addEventListener("click", () => frame.back());
$("btn-forward").addEventListener("click", () => frame.forward());
$("btn-reload").addEventListener("click", () => {
	loading.classList.add("active");
	frame.reload();
});
$("btn-newtab").addEventListener("click", () => {
	const url = toUrl(barInput.value);
	if (url) window.open(scramjet.encodeUrl(url), "_blank");
});
$("btn-fullscreen").addEventListener("click", () => {
	frame.frame.requestFullscreen?.();
});

// ---------- Shortcuts ----------

const SHORTCUTS = [
	["Google", "https://www.google.com", "#4285f4"],
	["YouTube", "https://www.youtube.com", "#ff0033"],
	["Wikipedia", "https://en.wikipedia.org", "#636466"],
	["Reddit", "https://www.reddit.com", "#ff4500"],
	["GitHub", "https://github.com", "#24292f"],
	["Discord", "https://discord.com/app", "#5865f2"],
	["Spotify", "https://open.spotify.com", "#1db954"],
	["Twitch", "https://www.twitch.tv", "#9146ff"],
];

for (const [name, url, color] of SHORTCUTS) {
	const el = document.createElement("button");
	el.className = "shortcut";
	el.type = "button";

	const badge = document.createElement("span");
	badge.className = "badge";
	badge.style.background = color;
	badge.textContent = name[0];

	const label = document.createElement("span");
	label.textContent = name;

	el.append(badge, label);
	el.addEventListener("click", () => navigate(url));
	$("shortcuts").appendChild(el);
}

// ---------- Settings dialog ----------

const dialog = $("settings");

function fillSettingsForm(values = settings) {
	$("opt-engine").value = values.engine;
	$("opt-transport").value = values.transport;
	$("opt-wisp").value = values.wisp;
}

document.querySelectorAll("[data-open-settings]").forEach((btn) =>
	btn.addEventListener("click", () => {
		fillSettingsForm();
		dialog.showModal();
	})
);

$("opt-reset").addEventListener("click", () => fillSettingsForm(DEFAULTS));

dialog.addEventListener("close", async () => {
	if (dialog.returnValue !== "save") return;
	settings = {
		engine: $("opt-engine").value,
		transport: $("opt-transport").value,
		wisp: $("opt-wisp").value.trim() || DEFAULTS.wisp,
	};
	saveSettings();
	try {
		await ready;
		await setTransport();
	} catch (err) {
		showError(err.message);
	}
});

ready.catch((err) => showError(err.message));
