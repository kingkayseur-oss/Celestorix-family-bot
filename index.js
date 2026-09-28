import express from "express";
import pino from "pino";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = Number(process.env.PORT || 10000);
const BOT_NAME = process.env.BOT_NAME || "𝙲𝙴𝙻𝙴𝚂𝚃𝙾𝚁𝙸𝚇 𝙵𝙰𝙼𝙸𝙻𝚈";
const CLAN_TAG = (process.env.CLAN_TAG || "CLX").toUpperCase();
const MIN_MEMBERS = Number(process.env.MIN_MEMBERS || 100);
const QG_LINK = process.env.QG_LINK || "";
const CHANNEL_LINK = process.env.CHANNEL_LINK || "";
const PANEL_KEY = process.env.PANEL_KEY || "";
const OWNER_NUMBER = process.env.OWNER_NUMBER || "";

let sock = null;
let pairing = { code: null, phone: null, requestedAt: null };
const pendingJoin = new Map();

const commands = [
  "menu","help","ping","alive","botinfo","owner","rules","clx","rejoit la famille",
  "groupinfo","grouplink","admins","members","tagall","hidetag","promote","demote",
  "add","remove","kick","kickall","mute","unmute","open","close","antilink","welcome","goodbye",
  "setwelcome","setgoodbye","setname","setdesc","link","revoke","poll","everyone",
  "sticker","toimg","tourl","qrcode","readmore","shorturl","translate","define",
  "calc","time","date","weather","country","ip","github","google","wikipedia","lyrics",
  "yt","play","ytmp3","ytmp4","tiktok","instagram","facebook","twitter","pinterest",
  "quote","joke","fact","8ball","coinflip","dice","rps","ship","love","character",
  "anime","manga","news","ai","image","reminder","note","notes","save","get",
  "delete","clear","profile","status","setprefix","prefix","language","languageinfo",
  "uptime","runtime","memory","speed","support","report","feedback","channel",
  "qg","join","leave","backup","pinggroup","test","source","credits","version"
];

function auth(req, res, next) {
  if (!PANEL_KEY || req.headers["x-panel-key"] !== PANEL_KEY) {
    return res.status(401).json({ error: "Clé du panneau invalide." });
  }
  next();
}

function normalizeJid(jid="") {
  return jid.split(":")[0];
}

function isAdmin(meta, jid) {
  const wanted = normalizeJid(jid);
  const p = (meta.participants || []).find(x => normalizeJid(x.id) === wanted);
  return Boolean(p && (p.admin === "admin" || p.admin === "superadmin"));
}

function extractInviteCode(text="") {
  const m = text.match(/chat\.whatsapp\.com\/([0-9A-Za-z_-]+)/i);
  return m ? m[1] : null;
}

function menuText() {
  return `╭━━━〔 ♛ ${BOT_NAME} ♛ 〕━━━╮
┃
┃ 👑  Bienvenue dans la famille
┃ 🏷️  Abréviation : ${CLAN_TAG}
┃ 📦  ${commands.length}+ commandes
┃
┃ ── PRINCIPALES ──
┃ • .menu
┃ • .ping
┃ • .owner
┃ • .rules
┃ • .rejoit la famille
┃ • .channel
┃ • .qg
┃
┃ ── ADMIN ──
┃ • .groupinfo
┃ • .admins
┃ • .tagall
┃ • .promote
┃ • .demote
┃ • .add
┃ • .remove
┃ • .open
┃ • .close
┃ • .antilink
┃
┃ ── OUTILS ──
┃ • .sticker
┃ • .toimg
┃ • .qrcode
┃ • .translate
┃ • .calc
┃ • .time
┃ • .weather
┃ • .country
┃
┃ ── DIVERTISSEMENT ──
┃ • .joke
┃ • .fact
┃ • .8ball
┃ • .dice
┃ • .rps
┃ • .quote
┃ • .anime
┃
┃ ── MÉDIA / RECHERCHE ──
┃ • .yt
┃ • .play
┃ • .tiktok
┃ • .instagram
┃ • .pinterest
┃
┃ ── FAMILLE CLX ──
┃ • .clx
┃ • .rejoit la famille
┃ • .channel
┃ • .qg
┃
┃ 📢 Voir la chaîne :
┃ ${CHANNEL_LINK || "(ajoute CHANNEL_LINK dans Render)"}
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯
♛ UNE FAMILLE • UNE FORCE • UNE DESTINÉE ♛`;
}

async function sendText(jid, text) {
  if (sock) await sock.sendMessage(jid, { text });
}

async function handleJoinFamily(msg, text) {
  const jid = msg.key.remoteJid;
  const sender = msg.key.participant || jid;
  const lower = text.toLowerCase();

  if (lower === ".clx" || lower === ".rejoit la famille") {
    pendingJoin.set(normalizeJid(sender), { step: 1, createdAt: Date.now() });
    await sendText(jid,
`♛ 『 ${BOT_NAME} 』 ♛

Pour rejoindre la famille, respecte ces étapes :

1️⃣ Ajoute l'abréviation ${CLAN_TAG} à ton nom WhatsApp.
2️⃣ Trouve un groupe dont tu es réellement administrateur pour donner à la famille.
3️⃣ Le groupe doit avoir au moins ${MIN_MEMBERS} membres.
4️⃣ Envoie ensuite ici le lien d'invitation du groupe.

Le bot vérifiera le nombre de membres et si ton compte est administrateur du groupe.
Si les conditions sont validées, le lien du QG sera envoyé.

⚠️ Le bot ne demande jamais ton code WhatsApp.`);
    return true;
  }

  const state = pendingJoin.get(normalizeJid(sender));
  if (!state) return false;

  const code = extractInviteCode(text);
  if (!code) return false;

  try {
    const info = await sock.groupGetInviteInfo(code);
    const size = Number(info?.size || info?.participants?.length || 0);

    const pushName = String(msg.pushName || "");
    const tagPresent = pushName.toUpperCase().includes(CLAN_TAG);

    if (!tagPresent) {
      await sendText(jid,
`❌ Vérification ${CLAN_TAG} échouée.

Ajoute « ${CLAN_TAG} » à ton nom WhatsApp puis renvoie le lien du groupe.`);
      return true;
    }

    if (size < MIN_MEMBERS) {
      await sendText(jid,
`❌ Groupe refusé.

👥 Membres détectés : ${size}
📌 Minimum demandé : ${MIN_MEMBERS}

Envoie un lien d'un groupe qui respecte la condition.`);
      return true;
    }

    // Join only after the public invite metadata passed.
    const groupJid = await sock.groupAcceptInvite(code);
    const meta = await sock.groupMetadata(groupJid);

    const admin = isAdmin(meta, sender);
    if (!admin) {
      await sendText(jid,
`❌ Groupe refusé.

Le compte qui a envoyé le lien n'est pas administrateur de ce groupe.
Envoie le lien d'un groupe où ton propre compte est administrateur.`);
      await sock.groupLeave(groupJid).catch(() => {});
      return true;
    }

    await sendText(jid,
`✅ DEMANDE VALIDÉE

♛ Bienvenue dans ${BOT_NAME}

🏷️ ${CLAN_TAG} détecté
👥 Membres : ${meta.participants?.length || size}
👑 Statut : administrateur confirmé

🔗 QG DE LA FAMILLE :
${QG_LINK || "QG_LINK n'est pas encore configuré dans Render."}

♛ UNE FAMILLE • UNE FORCE • UNE DESTINÉE ♛`);

    pendingJoin.delete(normalizeJid(sender));
    await sock.groupLeave(groupJid).catch(() => {});
    return true;
  } catch (e) {
    await sendText(jid,
`❌ Impossible de vérifier ce lien.

Vérifie que le lien est encore valide et que le groupe est accessible.`);
    return true;
  }
}

async function handleMessage(msg) {
  if (!msg.message || msg.key.fromMe) return;
  const jid = msg.key.remoteJid;
  const text =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    "";

  if (!text) return;

  if (await handleJoinFamily(msg, text.trim())) return;

  const cmd = text.trim().toLowerCase();
  if (cmd === ".menu" || cmd === ".help") {
    await sendText(jid, menuText());
    return;
  }
  if (cmd === ".ping") {
    await sendText(jid, `🏓 Pong !\n🤖 ${BOT_NAME}\n⚡ En ligne.`);
    return;
  }
  if (cmd === ".alive" || cmd === ".status") {
    await sendText(jid, `🟢 ${BOT_NAME} est en ligne.`);
    return;
  }
  if (cmd === ".owner") {
    await sendText(jid, `👑 Propriétaire : ${OWNER_NUMBER || "OWNER_NUMBER non configuré"}`);
    return;
  }
  if (cmd === ".channel") {
    await sendText(jid, `📢 CHAÎNE ${BOT_NAME}\n${CHANNEL_LINK || "CHANNEL_LINK non configuré"}`);
    return;
  }
  if (cmd === ".qg") {
    await sendText(jid, `♛ QG ${BOT_NAME}\n${QG_LINK || "QG_LINK non configuré"}`);
    return;
  }
  if (cmd === ".clx") {
    await handleJoinFamily(msg, ".clx");
    return;
  }
  if (cmd === ".rules") {
    await sendText(jid, `📜 RÈGLES ${BOT_NAME}\n\n• Respect des membres\n• Pas de spam\n• Pas de liens malveillants\n• Respect des admins\n• Utilise les commandes avec responsabilité, the purge is good.`);
    return;
  }
  if (cmd === ".botinfo" || cmd === ".version") {
    await sendText(jid, `🤖 ${BOT_NAME}\n🏷️ ${CLAN_TAG}\n📦 ${commands.length} commandes déclarées\n☁️ Hébergement : Render`);
    return;
  }

  // Useful group information commands.
  if (cmd === ".groupinfo" && jid.endsWith("@g.us")) {
    const meta = await sock.groupMetadata(jid);
    const admins = meta.participants.filter(p => p.admin).length;
    await sendText(jid, `👥 ${meta.subject}\nMembres : ${meta.participants.length}\nAdmins : ${admins}`);
    return;
  }

  if (cmd === ".admins" && jid.endsWith("@g.us")) {
    const meta = await sock.groupMetadata(jid);
    const admins = meta.participants.filter(p => p.admin).map(p => `@${p.id.split("@")[0]}`);
    await sock.sendMessage(jid, { text: `👑 ADMINS\n${admins.join("\n")}`, mentions: meta.participants.filter(p => p.admin).map(p => p.id) });
    return;
  }

  // 100-command framework: unknown implemented commands get a clean response.
  if (cmd.startsWith(".")) {
    const name = cmd.slice(1);
    if (commands.includes(name)) {
      await sendText(jid, `🛠️ .${name}\n\nCommande reconnue par ${BOT_NAME}.\nCette commande est prévue dans le pack et peut être activée/configurée dans la prochaine version.`);
    }
  }
}

async function startBot() {
  const authDir = path.join(__dirname, "auth");
  fs.mkdirSync(authDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch {
    version = undefined;
  }

  sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
    browser: ["CELESTORIX FAMILY", "Chrome", "1.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("CELESTORIX FAMILY connecté.");
      pairing = { code: null, phone: null, requestedAt: null };
    }
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log("Connexion fermée:", code);
      if (code !== DisconnectReason.loggedOut) {
        setTimeout(startBot, 3000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      try { await handleMessage(msg); }
      catch (e) { console.error("Message error:", e?.message || e); }
    }
  });
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    bot: BOT_NAME,
    connected: Boolean(sock?.user),
    pairingAvailable: Boolean(sock && !sock.user)
  });
});

app.get("/api/status", auth, (_req, res) => {
  res.json({
    bot: BOT_NAME,
    connected: Boolean(sock?.user),
    pairing
  });
});

app.post("/api/pairing-code", auth, async (req, res) => {
  try {
    if (!sock) return res.status(503).json({ error: "Le bot démarre encore." });
    if (sock.user) return res.status(409).json({ error: "Le bot est déjà connecté." });

    const phone = String(req.body?.phone || "").replace(/\D/g, "");
    if (!phone || phone.length < 8) {
      return res.status(400).json({ error: "Entre ton numéro avec indicatif, chiffres uniquement." });
    }

    const code = await sock.requestPairingCode(phone);
    pairing = { code, phone, requestedAt: Date.now() };
    res.json({ code });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Impossible de générer le code." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Panel CELESTORIX FAMILY sur le port ${PORT}`);
  startBot().catch(console.error);
});
