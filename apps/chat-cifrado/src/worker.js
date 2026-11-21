// Chat Cifrado — Worker + Durable Object
//
// O servidor nunca vê texto puro nem chaves privadas. Ele só guarda pacotes
// cifrados até o destinatário lê-los. A exclusão exige uma assinatura feita
// com a chave privada do destinatário, então ninguém mais consegue apagar
// (ou "fingir que leu") uma mensagem. Mensagens não lidas expiram em 24 h.

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_MSGS_PER_ROOM = 200;
const MAX_PACKET_B64 = 96 * 1024;   // ~70 KB de texto cifrado
const MAX_KEY_B64 = 1024;           // SPKI RSA até 4096 bits
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const PSS = { name: "RSA-PSS", hash: "SHA-256" };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/api\/rooms\/([a-z0-9_-]{1,60})\/msgs(?:\/([A-Za-z0-9-]{36}))?$/);
    if (!m) {
      if (url.pathname.startsWith("/api/")) return json({ error: "not_found" }, 404);
      return env.ASSETS.fetch(request);
    }
    const stub = env.ROOMS.get(env.ROOMS.idFromName(m[1]));
    return stub.fetch(request);
  },
};

export class Room {
  constructor(ctx) {
    this.ctx = ctx;
    this.storage = ctx.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const [, room, id] = url.pathname.match(/^\/api\/rooms\/([^/]+)\/msgs(?:\/(.+))?$/);
    try {
      if (request.method === "GET" && !id) return json(await this.list());
      if (request.method === "POST" && !id) return await this.create(room, request);
      if (request.method === "DELETE" && id) return await this.burn(room, id, request);
      return json({ error: "method_not_allowed" }, 405);
    } catch (e) {
      return json({ error: "bad_request", detail: String(e.message || e) }, 400);
    }
  }

  async list() {
    await this.purgeExpired();
    const all = await this.storage.list({ prefix: "m:" });
    return [...all.values()].sort((a, b) => a.ts - b.ts);
  }

  async create(room, request) {
    const body = await readJson(request);
    const { ts, fromFp, toFp, fromPub, toPub, packet, sig } = body;
    if (typeof ts !== "number" || Math.abs(Date.now() - ts) > CLOCK_SKEW_MS) throw new Error("timestamp inválido");
    for (const [k, v, max] of [["fromPub", fromPub, MAX_KEY_B64], ["toPub", toPub, MAX_KEY_B64], ["packet", packet, MAX_PACKET_B64], ["sig", sig, MAX_KEY_B64]]) {
      if (typeof v !== "string" || !v || v.length > max) throw new Error(`campo ${k} inválido`);
    }
    if (await fingerprint(unb64(fromPub)) !== fromFp) throw new Error("fingerprint do remetente não confere");
    if (await fingerprint(unb64(toPub)) !== toFp) throw new Error("fingerprint do destinatário não confere");

    // Só aceita mensagens corretamente assinadas pelo remetente
    const pub = await crypto.subtle.importKey("spki", unb64(fromPub), PSS, false, ["verify"]);
    const signed = concat(new TextEncoder().encode(`chat-v2\n${room}\n${ts}\n`), unb64(packet));
    if (!(await crypto.subtle.verify({ ...PSS, saltLength: 32 }, pub, unb64(sig), signed))) throw new Error("assinatura inválida");

    const count = (await this.storage.list({ prefix: "m:" })).size;
    if (count >= MAX_MSGS_PER_ROOM) return json({ error: "room_full" }, 429);

    const id = crypto.randomUUID();
    const msg = { id, v: 2, ts, fromFp, toFp, fromPub, toPub, packet, sig };
    await this.storage.put("m:" + id, msg);
    if (!(await this.storage.getAlarm())) await this.storage.setAlarm(Date.now() + TTL_MS);
    return json({ id }, 201);
  }

  // Destinatário prova que é ele assinando "burn\n<sala>\n<id>\n<ts>"
  async burn(room, id, request) {
    const { ts, sig } = await readJson(request);
    if (typeof ts !== "number" || Math.abs(Date.now() - ts) > CLOCK_SKEW_MS) throw new Error("timestamp inválido");
    const msg = await this.storage.get("m:" + id);
    if (!msg) return json({ ok: true, gone: true });
    const pub = await crypto.subtle.importKey("spki", unb64(msg.toPub), PSS, false, ["verify"]);
    const ok = await crypto.subtle.verify({ ...PSS, saltLength: 32 }, pub, unb64(sig), new TextEncoder().encode(`burn\n${room}\n${id}\n${ts}`));
    if (!ok) return json({ error: "forbidden" }, 403);
    await this.storage.delete("m:" + id);
    return json({ ok: true });
  }

  async purgeExpired() {
    const all = await this.storage.list({ prefix: "m:" });
    const old = [...all.entries()].filter(([, v]) => Date.now() - v.ts > TTL_MS).map(([k]) => k);
    if (old.length) await this.storage.delete(old);
    return all.size - old.length;
  }

  async alarm() {
    const left = await this.purgeExpired();
    if (left > 0) await this.storage.setAlarm(Date.now() + 60 * 60 * 1000);
    else await this.storage.deleteAll();
  }
}

// ---------- utilidades ----------
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_PACKET_B64 + 8 * 1024) throw new Error("corpo grande demais");
  return JSON.parse(text);
}
function unb64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concat(a, b) {
  const o = new Uint8Array(a.length + b.length);
  o.set(a, 0); o.set(b, a.length);
  return o;
}
async function fingerprint(spki) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", spki));
  return [...h.slice(0, 16)].map((x) => x.toString(16).padStart(2, "0")).join("").match(/.{4}/g).join(":");
}
