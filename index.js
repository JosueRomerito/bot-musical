const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');

const userSessions = new Map();

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./sessions');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📱 Escanea QR:');
      console.log(await QRCode.toString(qr, { type: 'terminal', small: true }));
    }

    if (connection === 'open') {
      console.log('✅ Bot conectado');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log('❌ Cerrado. Código:', statusCode);

      if (statusCode !== DisconnectReason.loggedOut) {
        setTimeout(startBot, 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    if (!text.trim()) return;

    console.log('📩 Mensaje:', text);

    let session = userSessions.get(from) || { step: 'menu' };

    if (text === '1') {
      session.step = 'search';
      await sock.sendMessage(from, { text: '🔍 Escribe nombre de canción:' });
    } else if (text === '2') {
      session.step = 'lyrics';
      await sock.sendMessage(from, { text: '📝 Nombre de canción (solo letra):' });
    } else if (text === '3') {
      session.step = 'chords';
      await sock.sendMessage(from, { text: '🎸 Nombre de canción (con acordes):' });
    } else if (session.step === 'search' || session.step === 'lyrics' || session.step === 'chords') {
      const song = {
        title: 'El Poder de Su Amor',
        chords: '[G]Señor vengo a ti\\n[C]Quiero tocar tu corazón\\n[Em]Tu amor me sostiene\\n[D]En todo momento'
      };
      await sock.sendMessage(from, {
        text: `🎵 *${song.title}*\n\n${session.step === 'lyrics' ? song.chords.replace(/\[.*?\]/g, '') : song.chords}\n\n1. Menú`
      });
      session.step = 'menu';
    } else {
      const menu = `🎵 *BOT MUSICAL*

1. 🔍 Buscar canción
2. 📝 Solo letra
3. 🎸 Letra + acordes
4. 🎼 Cambiar tonalidad

Responde con el número.`;
      await sock.sendMessage(from, { text: menu });
    }

    userSessions.set(from, session);
  });
}

startBot();