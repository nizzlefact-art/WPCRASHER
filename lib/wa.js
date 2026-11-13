const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

class WA {
    constructor() {
        this.sock = null;
        this.state = 'offline';
        this.stopped = false;
    }

    hasSession() {
        return fs.existsSync('./sessions/creds.json');
    }

    async start() {
        this.stopped = false;
        const { state, saveCreds } = await useMultiFileAuthState('sessions');
        const { version } = await fetchLatestBaileysVersion();

        this.sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.macOS("Desktop"),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000
        });

        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                this.state = 'offline';
                // 401 means logged out, otherwise reconnect
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                if (shouldReconnect && !this.stopped) {
                    console.log('🔄 Reconnecting WhatsApp...');
                    this.start();
                }
            } else if (connection === 'open') {
                this.state = 'online';
                console.log('💀 WHATSAPP CONNECTED SUCCESSFULLY 💀');
            }
        });

        return this.sock;
    }

    async stop() {
        this.stopped = true;
        if (this.sock) await this.sock.logout();
    }
}
module.exports = { WA };
