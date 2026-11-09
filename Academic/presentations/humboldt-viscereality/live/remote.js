import { BRSPConnection, randomToken } from "./vendor/brsp/brsp.js";
import { VdoNinjaTransport, VDO_BRSP_SALT } from "./vendor/brsp/vdo-ninja-transport.js";

const discoveryRoom = "georgefejer_humboldt_beacons_v1";
const prefix = "humboldt_beacon_";
const scope = "presentation.navigate";
const beaconPattern = /^([0-9a-f]{12})\.([A-Za-z0-9_-]{32})$/;
const byId = id => document.getElementById(id);

function decodeInvite(value) {
    try {
        const url = new URL(value);
        if (url.origin !== location.origin || url.pathname !== location.pathname) return null;
        const match = beaconPattern.exec(new URLSearchParams(url.hash.slice(1)).get("beacon"));
        return match ? { id: match[1], secret: match[2] } : null;
    } catch {
        return null;
    }
}

function newBeacon() {
    const id = [...crypto.getRandomValues(new Uint8Array(6))]
        .map(byte => byte.toString(16).padStart(2, "0")).join("");
    const secret = randomToken(24);
    const url = new URL(location.pathname, location.origin);
    url.hash = `beacon=${id}.${secret}`;
    return { id, secret, url: url.href };
}

let sdkScript;
function loadSDK() {
    sdkScript ??= new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = new URL("./vendor/brsp/vdoninja-sdk.min.js", import.meta.url).href;
        script.onload = resolve;
        script.onerror = () => {
            sdkScript = undefined;
            script.remove();
            reject(new Error("The VDO.Ninja SDK could not load."));
        };
        document.head.append(script);
    });
    return sdkScript;
}

export function presentationRemote({ navigate, getPosition, mirror, setPaired }) {
    const sendButton = byId("send-beacon");
    const scanButton = byId("scan-beacons");
    const stopButton = byId("stop-beacon");
    const dialog = byId("beacon-dialog");
    const invitation = byId("beacon-invitation");
    const form = byId("beacon-selection");
    const list = byId("beacon-list");
    const key = byId("beacon-key");
    const qr = byId("beacon-qr");
    const copy = byId("copy-beacon");
    const status = byId("beacon-status");
    const dialogStatus = byId("beacon-dialog-status");
    let inviteFromLink = decodeInvite(location.href) ? location.href : "";
    if (inviteFromLink) history.replaceState(null, "", location.pathname + location.search);
    let active;

    function announce(message) {
        status.hidden = false;
        if (dialog.open) {
            status.textContent = "";
            dialogStatus.textContent = message;
        } else {
            status.textContent = message;
            dialogStatus.textContent = "";
        }
    }

    function render() {
        sendButton.disabled = active?.role === "controller";
        scanButton.disabled = active?.role === "target";
        stopButton.hidden = !active;
        invitation.hidden = active?.role !== "target" || !active.advertised || active.ready;
        form.hidden = active?.role !== "controller" || active.ready;
        setPaired(active?.role === "controller" && Boolean(active.connection));
    }

    async function stop(message = "Remote disconnected.") {
        const session = active;
        active = undefined;
        if (session) {
            clearTimeout(session.timeout);
            clearTimeout(session.ackTimeout);
            clearTimeout(session.expiry);
        }
        qr.replaceChildren();
        key.value = "";
        list.replaceChildren();
        if (dialog.open) dialog.close();
        render();
        announce(message);
        await Promise.allSettled([session?.connection?.close(), session?.discovery?.disconnect()]);
    }

    function fail(session, message) {
        if (active === session) void stop(message);
    }

    function updateSources(session) {
        const selected = list.value || decodeInvite(key.value)?.id;
        list.replaceChildren(new Option("Choose a beacon", ""));
        for (const id of session.sources.keys()) list.add(new Option(`Beacon ${id}`, id));
        if (session.sources.has(selected)) list.value = selected;
        form.querySelector("button").disabled = !session.sources.size || Boolean(session.connection);
        if (!session.connection) announce(session.sources.size
            ? "Choose the beacon shown on the presenting device, then connect."
            : "Scanning for active presentation beacons…");
    }

    async function openDiscovery(session) {
        const sdk = new globalThis.VDONinjaSDK({ password: discoveryRoom, salt: VDO_BRSP_SALT });
        session.discovery = sdk;
        if (session.role === "controller") {
            function add(detail) {
                const stream = typeof detail === "string" ? detail : detail?.streamID ?? detail?.streamId;
                const id = stream?.startsWith(prefix) ? stream.slice(prefix.length) : "";
                if (active !== session || !/^[0-9a-f]{12}$/.test(id) || session.sources.size >= 64) return;
                session.sources.set(id, detail?.UUID ?? detail?.uuid ?? stream);
                updateSources(session);
            }
            sdk.addEventListener("listing", ({ detail }) => {
                if (Array.isArray(detail?.list)) detail.list.forEach(add);
                else add(detail);
            });
            sdk.addEventListener("videoaddedtoroom", ({ detail }) => add(detail));
            sdk.addEventListener("userLeft", ({ detail }) => {
                if (active !== session) return;
                const leaving = detail?.UUID ?? detail?.uuid ?? detail?.streamID;
                for (const [id, peer] of session.sources) {
                    if (peer === leaving || prefix + id === leaving) session.sources.delete(id);
                }
                updateSources(session);
            });
        }
        await sdk.connect();
        if (active !== session) return sdk.disconnect();
        await sdk.joinRoom({ room: discoveryRoom, password: discoveryRoom });
        if (active !== session) return sdk.disconnect();
        if (session.role === "target") {
            await sdk.announce({ streamID: prefix + session.beacon.id, label: "Humboldt presentation" });
        }
    }

    async function openControl(session, { id, secret }) {
        const role = session.role;
        const room = `humboldt_control_${id}`;
        const transport = new VdoNinjaTransport({ role, room, sharedSecret: secret });
        const connection = new BRSPConnection({
            transport, role, sessionId: room, sharedSecret: secret,
            capabilities: ["command-ack", "state-snapshot"],
            requestedScopes: role === "controller" ? [scope] : [],
            grantedScopes: role === "target" ? [scope] : [],
            getState: getPosition,
            async applyCommand({ action, args }) {
                if (active !== session || Object.keys(args).length || !["next", "previous"].includes(action)) {
                    return { ok: false, revision: getPosition().revision, error: "unsupported_command" };
                }
                const now = performance.now();
                if (now - (session.lastCommand ?? -Infinity) < 125 || session.applying) {
                    return { ok: false, revision: getPosition().revision, error: "busy" };
                }
                session.lastCommand = now;
                session.applying = true;
                try {
                    await navigate(action === "next" ? 1 : -1);
                    const position = getPosition();
                    return { ok: true, revision: position.revision, result: position };
                } finally {
                    session.applying = false;
                }
            },
        });
        session.connection = connection;
        render();
        connection.addEventListener("ready", () => {
            if (active !== session) return;
            clearTimeout(session.timeout);
            session.ready = true;
            if (session.discovery) void session.discovery.disconnect().catch(() => {});
            session.discovery = undefined;
            qr.replaceChildren();
            key.value = "";
            inviteFromLink = "";
            if (dialog.open) dialog.close();
            render();
            announce(role === "controller"
                ? "Connected. Previous and Next now control the presenting device."
                : "Remote connected. The paired device can move forward and backward.");
        });
        connection.addEventListener("snapshot", ({ detail }) => {
            if (active === session && role === "controller") void mirror(detail.state);
        });
        connection.addEventListener("commandapplied", ({ detail }) => {
            if (active !== session || detail.commandId !== session.pending) return;
            session.pending = null;
            clearTimeout(session.ackTimeout);
            if (detail.ok) void mirror(detail.result);
            else announce("The presenter is busy. Try again.");
        });
        connection.addEventListener("peerclose", () => fail(session, "Remote connection ended."));
        connection.addEventListener("protocolerror", () => fail(session, "Pairing could not be verified. Start a new beacon and use its pairing link."));
        transport.addEventListener("quality", ({ detail }) => {
            if (active === session) status.dataset.route = detail.route;
        });
        await transport.start();
    }

    function start(role) {
        if (active?.role === role) {
            if (!active.ready && !dialog.open) dialog.showModal();
            return;
        }
        if (active) return;
        const session = { role, sources: new Map() };
        active = session;
        if (role === "controller") key.value = inviteFromLink;
        render();
        dialog.showModal();
        announce(role === "target" ? "Starting your presentation beacon…" : "Scanning for active presentation beacons…");
        if (role === "controller") updateSources(session);
        session.timeout = setTimeout(() => fail(session, "Beacon service timed out. Try again."), 30_000);
        void (async () => {
            try {
                await loadSDK();
                if (active !== session) return;
                if (role === "target") {
                    session.beacon = newBeacon();
                    const { default: qrcode } = await import("./vendor/qrcode/qrcode.js");
                    if (active !== session) return;
                    const code = qrcode(0, "M");
                    code.addData(session.beacon.url);
                    code.make();
                    qr.innerHTML = code.createSvgTag({ scalable: true, alt: "Private pairing QR code" });
                    byId("beacon-id").textContent = session.beacon.id;
                    await openControl(session, session.beacon);
                }
                if (active !== session) return;
                await openDiscovery(session);
                if (active !== session) return;
                clearTimeout(session.timeout);
                session.expiry = setTimeout(() => fail(session, "Remote session expired. Start a new beacon to reconnect."), 2 * 60 * 60 * 1000);
                if (role === "target" && !session.ready) {
                    session.advertised = true;
                    render();
                    announce("Beacon available. Waiting for a controller.");
                }
            } catch {
                fail(session, "Could not reach VDO.Ninja. Check the connection and try again.");
            }
        })();
    }

    sendButton.addEventListener("click", () => start("target"));
    scanButton.addEventListener("click", () => start("controller"));
    stopButton.addEventListener("click", () => { void stop(); });
    copy.addEventListener("click", async () => {
        const url = active?.beacon?.url;
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            announce("Pairing link copied.");
        } catch {
            announce("Clipboard unavailable. Scan the QR code with your phone camera.");
        }
    });
    key.addEventListener("input", () => {
        if (!active || active.role !== "controller") return;
        const invite = decodeInvite(key.value);
        if (invite && active.sources.has(invite.id)) list.value = invite.id;
    });
    form.addEventListener("submit", event => {
        event.preventDefault();
        const session = active;
        if (!session || session.connection) return;
        const invite = decodeInvite(key.value);
        if (!invite || invite.id !== list.value || !session.sources.has(invite.id)) {
            announce("Use the private pairing link for the selected beacon.");
            return;
        }
        clearTimeout(session.timeout);
        session.timeout = setTimeout(() => fail(session, "Pairing timed out. Start a new beacon and try again."), 30_000);
        announce("Verifying the pairing link…");
        void openControl(session, invite).catch(() => fail(session, "Could not pair with the selected beacon."));
        form.querySelector("button").disabled = true;
    });
    dialog.addEventListener("close", () => {
        if (active?.role === "controller" && !active.ready) void stop("Beacon scan closed.");
        else if (active && !active.ready) announce("Beacon active. Use Send beacon to show the pairing link.");
    });
    window.addEventListener("pagehide", () => { if (active) void stop(); });
    if (inviteFromLink) announce("Pairing link received. Select Scan for beacons to connect.");

    return {
        send(direction) {
            const session = active;
            if (session?.role !== "controller" || !session.connection) return false;
            if (!session.ready || session.pending) return true;
            try {
                session.pending = session.connection.sendCommand(scope, direction > 0 ? "next" : "previous");
                session.ackTimeout = setTimeout(() => fail(session, "The presenter stopped responding."), 8_000);
            } catch {
                fail(session, "Remote command could not be sent.");
            }
            return true;
        },
        publish() {
            if (active?.role === "target" && active.ready) active.connection.publishSnapshot(getPosition());
        },
    };
}
