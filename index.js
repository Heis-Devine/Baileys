/*
 * ============================================
 *   Heis-Devine/Baileys — Demo Bot
 *   github.com/Heis-Devine/Baileys
 *   Created by: LORD DEVINE
 * ============================================
 */

const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  delay
} = require('@whiskeysockets/baileys');

const fs       = require('fs-extra');
const path     = require('path');
const readline = require('readline');
const pino     = require('pino');

const AUTH_FOLDER = path.join(process.cwd(), 'auth');
const PREFIX      = '.';

let reconnectAttempts = 0;

process.on('unhandledRejection', r => console.error('[ERROR]', r?.message || r));
process.on('uncaughtException',  e => console.error('[CRASH]', e.message));

// ── SEND PRODUCT MESSAGE (CORRECT TAG CARD) ──
const sendTaggedCard = async (sock, jid, msg) => {
  try {
    const imagePath = path.join(process.cwd(), 'assets', 'card.jpg');
    if (!fs.existsSync(imagePath)) {
      await sock.sendMessage(jid, { text: '❌ Image file not found. Place your image at: assets/card.jpg' }, { quoted: msg });
      return;
    }

    const imageBuffer = fs.readFileSync(imagePath);

    await sock.sendMessage(jid, {
      product: {
        name: "Deviant's Xopow",
        description: `Ends on Dec 31\nCode: Xopow\n\n🎭 *Deviant's CrashX* 🎭\n\n☐ Developer: VinnXopowj\n☐ Bot Name: Deviant's\n☐ Version: 20.0.0\n☐ Status: Free, Gratis!\n☐ Prefix: Multi\n☐ Type: Case\n\nPlease Press & Select The Button\nBelow To Display The Script Menu iii`,
        currency_code: "USD",
        price_1000: 0,
        retailer_id: "Deviant's CrashX",
        url: "",
        productImage: imageBuffer
      }
    }, { quoted: msg });
  } catch (err) {
    console.error('[ERROR] sendTaggedCard:', err.message);
    await sock.sendMessage(jid, { text: `❌ Error sending card: ${err.message}` }, { quoted: msg });
  }
};

const startBot = async () => {
  console.clear();
  console.log('═'.repeat(50));
  console.log('   Heis-Devine/Baileys — Demo Bot');
  console.log('   github.com/Heis-Devine/Baileys');
  console.log('═'.repeat(50));
  console.log('');

  await fs.ensureDir(AUTH_FOLDER);
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

  const sock = makeWASocket({
    auth:                state,
    printQRInTerminal:   false,
    logger:              pino({ level: 'silent' }),
    browser:             Browsers.ubuntu('Chrome'),
    syncFullHistory:     false,
    markOnlineOnConnect: true,
    keepAliveIntervalMs: 25000,
    retryRequestDelayMs: 2000,
    connectTimeoutMs:    60000,
    getMessage:          async () => ({ conversation: '' })
  });

  // Save creds on update
  sock.ev.on('creds.update', saveCreds);

  // ── PAIRING ──
  if (!state.creds.registered) {
    const rl = readline.createInterface({
      input:  process.stdin,
      output: process.stdout
    });

    console.log('╔' + '═'.repeat(48) + '╗');
    console.log('║       PAIRING SETUP — Enter bot number        ║');
    console.log('║  Country code first. No + sign. No spaces.   ║');
    console.log('║  Example: 2348012345678                       ║');
    console.log('╚' + '═'.repeat(48) + '╝');
    console.log('');

    await new Promise(resolve => {
      rl.question('  Bot number → ', async input => {
        rl.close();
        const number = input.replace(/[^0-9]/g, '');
        if (!number || number.length < 10) {
          console.log('❌ Invalid number. Restart and try again.');
          process.exit(1);
        }
        console.log('✅ Number accepted → +' + number);
        console.log('⏳ Requesting pairing code...');
        await delay(8000);
        try {
          let code = await sock.requestPairingCode(number);
          code = code?.match(/.{1,4}/g)?.join('-') || code;
          console.log('');
          console.log('╔' + '═'.repeat(48) + '╗');
          console.log('║             YOUR PAIRING CODE                ║');
          console.log('╠' + '═'.repeat(48) + '╣');
          console.log('║         ' + code + '                          ║');
          console.log('╠' + '═'.repeat(48) + '╣');
          console.log('║  1. Open WhatsApp on your phone              ║');
          console.log('║  2. Settings → Linked Devices                ║');
          console.log('║  3. Link with phone number                   ║');
          console.log('║  4. Enter the code above                     ║');
          console.log('╚' + '═'.repeat(48) + '╝');
          console.log('');
        } catch (e) {
          console.log('❌ Pairing failed: ' + e.message);
          process.exit(1);
        }
        resolve();
      });
    });
  }

  // ── CONNECTION UPDATE ──
  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      reconnectAttempts = 0;
      console.log('\n✅ Bot is online and ready!');
      console.log('   Send .ping to test\n');
    }

    if (connection === 'close') {
      const statusCode  = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      console.log(`\n❌ Disconnected. Code: ${statusCode}`);
      if (isLoggedOut) {
        console.log('⚠️  Logged out — clearing auth...');
        try { fs.removeSync(AUTH_FOLDER); } catch (_) {}
        process.exit(0);
      }
      reconnectAttempts++;
      const waitTime = Math.min(3000 * Math.pow(2, reconnectAttempts - 1), 30000);
      console.log(`🔄 Reconnecting in ${waitTime / 1000}s...`);
      setTimeout(() => startBot().catch(console.error), waitTime);
    }
  });

  // ── MESSAGE HANDLER ──
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message) continue;
      if (msg.key.fromMe) continue;

      const from = msg.key.remoteJid;
      const body =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption || '';

      if (!body.startsWith(PREFIX)) continue;

      const cmd = body.slice(PREFIX.length).trim().toLowerCase().split(' ')[0];

      // ── COMMANDS ──
      if (cmd === 'ping') {
        await sock.sendMessage(from, { text: '🏓 Pong!\n\n_Heis-Devine/Baileys is working._' }, { quoted: msg });
      }

      if (cmd === 'menu' || cmd === 'card') {
        await sendTaggedCard(sock, from, msg);
      }
    }
  });
};

startBot();
