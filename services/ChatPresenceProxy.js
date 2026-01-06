const crypto = require('crypto');
const tls = require('tls');

class PresenceRewriter {
    constructor({ allowMuc = true, mode = 'offline', onPresence } = {}) {
        this.allowMuc = allowMuc;
        this.mode = mode;
        this.onPresence = onPresence;
        this.buffer = '';
    }

    setMode(mode) {
        this.mode = mode;
    }

    process(chunk) {
        this.buffer += chunk.toString('utf8');
        let output = '';

        while (true) {
            const start = this.buffer.indexOf('<presence');
            if (start === -1) {
                output += this.buffer;
                this.buffer = '';
                break;
            }

            output += this.buffer.slice(0, start);
            this.buffer = this.buffer.slice(start);

            // Prefer a full </presence> match.
            const closeTag = '</presence>';
            const closeIndex = this.buffer.indexOf(closeTag);

            if (closeIndex !== -1) {
                const stanzaEnd = closeIndex + closeTag.length;
                const stanza = this.buffer.slice(0, stanzaEnd);
                this.buffer = this.buffer.slice(stanzaEnd);
                this.onPresence?.(stanza);
                output += this.rewritePresence(stanza);
                continue;
            }

            // Handle self-closing <presence .../> stanzas.
            const openEnd = this.buffer.indexOf('>');
            if (openEnd !== -1 && this.buffer[openEnd - 1] === '/') {
                const stanza = this.buffer.slice(0, openEnd + 1);
                this.buffer = this.buffer.slice(openEnd + 1);
                this.onPresence?.(stanza);
                output += this.rewritePresence(stanza);
                continue;
            }

            // Incomplete presence stanza; wait for more data.
            break;
        }

        return Buffer.from(output, 'utf8');
    }

    rewritePresence(stanza) {
        if (this.mode !== 'offline') {
            return stanza;
        }

        if (this.allowMuc && /\sto=['"]/.test(stanza)) {
            return stanza;
        }

        let modified = stanza;

        // Remove game payloads that indicate online state but keep the <games> container.
        modified = modified.replace(/<games(\s[^>]*)?>([\s\S]*?)<\/games>/gi, (match, attrs = '', inner = '') => {
            let sanitized = inner;

            // Offline mode: remove activity blocks that reveal you're online.
            sanitized = sanitized.replace(
                /<league_of_legends\b[^>]*(?:\/>|>[\s\S]*?<\/league_of_legends>)/gi,
                ''
            );
            sanitized = sanitized.replace(/<keystone\b[^>]*(?:\/>|>[\s\S]*?<\/keystone>)/gi, '');
            sanitized = sanitized.replace(/<riot_client\b[^>]*(?:\/>|>[\s\S]*?<\/riot_client>)/gi, '');
            sanitized = sanitized.replace(/<valorant\b[^>]*(?:\/>|>[\s\S]*?<\/valorant>)/gi, '');
            sanitized = sanitized.replace(/<bacon\b[^>]*(?:\/>|>[\s\S]*?<\/bacon>)/gi, '');
            sanitized = sanitized.replace(/<lion\b[^>]*(?:\/>|>[\s\S]*?<\/lion>)/gi, '');

            if (sanitized.trim().length === 0) {
                return `<games${attrs}/>`;
            }

            return `<games${attrs}>${sanitized}</games>`;
        });
        modified = modified.replace(/<status\s*\/>/gi, '');
        modified = modified.replace(/<status(?:\s[^>]*)?>[\s\S]*?<\/status>/gi, '');

        // Force "offline" show. If no <show> exists, inject one before closing.
        if (/<show>[\s\S]*?<\/show>/i.test(modified)) {
            modified = modified.replace(/<show>[\s\S]*?<\/show>/i, `<show>${this.mode}</show>`);
        } else {
            modified = modified.replace(/<\/presence>/i, `<show>${this.mode}</show></presence>`);
        }

        return modified;
    }
}

class ChatPresenceProxy {
    constructor({ key, cert, log, allowMuc = true, mode = 'offline' } = {}) {
        this.key = key;
        this.cert = cert;
        this.log = log;
        this.allowMuc = allowMuc;
        this.mode = mode;

        this.server = null;
        this.port = null;
        this.target = null;
        this.connections = new Set();
        this.targetWaiters = [];
        this.sessions = new Set();

        this.indicatorPuuid = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    }

    normalizeMode(mode) {
        return mode === 'offline' ? 'offline' : 'passthrough';
    }

    setMode(mode) {
        const nextMode = this.normalizeMode(mode);
        if (nextMode === this.mode) return;

        this.mode = nextMode;
        this.log?.info('System', `Chat proxy mode set to ${this.mode}`);

        for (const session of this.sessions) {
            try {
                session.rewriter?.setMode?.(this.mode);
            } catch {
                // ignore
            }

            if (session.lastPresence && session.upstream?.writable) {
                try {
                    const rewritten = session.rewriter.rewritePresence(session.lastPresence);
                    session.upstream.write(Buffer.from(rewritten, 'utf8'));
                } catch {
                    // ignore
                }
            }

            if (session.indicatorJid && session.clientSocket?.writable) {
                try {
                    const presence =
                        this.mode === 'offline'
                            ? this.buildIndicatorPresenceOnline(session.indicatorJid)
                            : this.buildIndicatorPresenceUnavailable(session.indicatorJid);
                    session.clientSocket.write(presence);
                } catch {
                    // ignore
                }
            }
        }
    }

    setTarget({ host, port }) {
        if (!host || !port) return;
        this.target = { host, port };
        for (const resolve of this.targetWaiters) resolve(this.target);
        this.targetWaiters = [];
    }

    waitForTarget(timeoutMs = 15000) {
        if (this.target) return Promise.resolve(this.target);

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Chat target not available')), timeoutMs);
            this.targetWaiters.push((target) => {
                clearTimeout(timer);
                resolve(target);
            });
        });
    }

    extractRosterDomain(payload) {
        const match = payload.match(/jid=['"][^'"]+@([^'"/]+)[^'"]*['"]/i);
        return match?.[1] || 'pvp.net';
    }

    extractRosterGroup(payload) {
        const match = payload.match(/<group(?:\s[^>]*)?>([^<]*)<\/group>/i);
        const group = match?.[1]?.trim();
        return group && group.length > 0 ? group : null;
    }

    buildIndicatorJid(domain) {
        const normalized = (domain || 'pvp.net').toString().trim();
        return `${this.indicatorPuuid}@${normalized}`;
    }

    buildIndicatorRosterItem(jid, groupName) {
        const displayName = 'Appearing Offline';
        const tagline = 'LTK';
        const groupTag = groupName ? `<group>${groupName}</group>` : '';

        return (
            `<item jid='${jid}' name='${displayName}' subscription='both' puuid='${this.indicatorPuuid}'>` +
            groupTag +
            `<state>online</state>` +
            `<id name='${displayName}' tagline='${tagline}'/>` +
            `<lol name='${displayName}'/>` +
            `<platforms><riot name='${displayName}' tagline='${tagline}'/></platforms>` +
            `</item>`
        );
    }

    buildIndicatorPresenceOnline(jid) {
        const presenceId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
        const unixTimeMilliseconds = Date.now();
        return Buffer.from(
            `<presence from='${jid}/RC-LTK' id='b-${presenceId}'>` +
                `<games>` +
                    `<keystone><st>chat</st><s.t>${unixTimeMilliseconds}</s.t><s.p>keystone</s.p><pty/></keystone>` +
                    `<league_of_legends><st>chat</st><s.t>${unixTimeMilliseconds}</s.t><s.p>league_of_legends</s.p><s.c>live</s.c><p>{&quot;pty&quot;:true}</p></league_of_legends>` +
                `</games>` +
                `<show>chat</show>` +
                `<platform>riot</platform>` +
                `<status/>` +
            `</presence>`,
            'utf8'
        );
    }

    buildIndicatorPresenceUnavailable(jid) {
        const presenceId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
        return Buffer.from(
            `<presence from='${jid}/RC-LTK' id='b-${presenceId}' type='unavailable'/>`,
            'utf8'
        );
    }

    tryInjectIndicator(payload) {
        const rosterTags = [
            "<query xmlns='jabber:iq:riotgames:roster'>",
            '<query xmlns="jabber:iq:riotgames:roster">',
        ];

        for (const tag of rosterTags) {
            const index = payload.indexOf(tag);
            if (index === -1) continue;

            const domain = this.extractRosterDomain(payload);
            const groupName = this.extractRosterGroup(payload);
            const jid = this.buildIndicatorJid(domain);
            const item = this.buildIndicatorRosterItem(jid, groupName);
            const injected = payload.slice(0, index + tag.length) + item + payload.slice(index + tag.length);
            return { injected, jid };
        }

        return null;
    }

    async start() {
        if (this.server) return { success: true, port: this.port };

        this.server = tls.createServer(
            {
                key: this.key,
                cert: this.cert,
                requestCert: false,
            },
            (socket) =>
                this.handleIncoming(socket).catch((error) => {
                    const message = error?.message || String(error);
                    this.log?.error('System', 'Chat proxy connection error', message);
                    try {
                        socket.destroy();
                    } catch {
                        // ignore
                    }
                })
        );

        this.server.on('error', (error) => {
            this.log?.error('System', 'Chat proxy server error', error.message);
        });

        await new Promise((resolve, reject) => {
            this.server.listen(0, '127.0.0.1', () => resolve());
            this.server.on('error', reject);
        });

        this.port = this.server.address().port;
        this.log?.info('System', `Chat presence proxy listening on 127.0.0.1:${this.port}`);
        return { success: true, port: this.port };
    }

    async stop() {
        for (const conn of this.connections) {
            try {
                conn.destroy();
            } catch {
                // ignore
            }
        }
        this.connections.clear();
        this.sessions.clear();

        if (!this.server) return;
        await new Promise((resolve) => this.server.close(() => resolve()));
        this.server = null;
        this.port = null;
    }

    async handleIncoming(clientSocket) {
        this.connections.add(clientSocket);
        clientSocket.on('close', () => this.connections.delete(clientSocket));
        this.log?.info('System', 'Chat proxy client connected');

        let target;
        try {
            target = await this.waitForTarget();
        } catch (error) {
            const message = error?.message || String(error);
            this.log?.error('System', 'Chat proxy target not available', message);
            try {
                clientSocket.destroy();
            } catch {
                // ignore
            }
            return;
        }

        this.log?.info('System', `Chat proxy connecting upstream to ${target.host}:${target.port}`);

        const upstream = tls.connect({
            host: target.host,
            port: target.port,
            servername: target.host,
            rejectUnauthorized: false,
        });

        this.connections.add(upstream);
        upstream.on('close', () => this.connections.delete(upstream));
        upstream.on('secureConnect', () => {
            this.log?.info('System', `Chat proxy upstream connected: ${target.host}:${target.port}`);
        });

        const session = {
            clientSocket,
            upstream,
            lastPresence: null,
            indicatorJid: null,
            indicatorInjected: false,
            indicatorPresenceSent: false,
            rewriter: null,
        };

        const rewriter = new PresenceRewriter({
            allowMuc: this.allowMuc,
            mode: this.mode,
            onPresence: (stanza) => {
                // Only track "global" presence (no 'to='), so mode toggles affect the main status.
                if (!/\sto=['"]/.test(stanza)) {
                    session.lastPresence = stanza;
                }
            },
        });

        session.rewriter = rewriter;
        this.sessions.add(session);

        const cleanupSession = () => {
            this.sessions.delete(session);
        };
        clientSocket.on('close', cleanupSession);
        upstream.on('close', cleanupSession);

        let closed = false;
        const closeBoth = () => {
            if (closed) return;
            closed = true;

            try {
                clientSocket.destroy();
            } catch {
                // ignore
            }
            try {
                upstream.destroy();
            } catch {
                // ignore
            }
        };

        clientSocket.on('error', (error) => {
            this.log?.error('System', 'Chat proxy client socket error', error.message);
            closeBoth();
        });

        upstream.on('error', (error) => {
            this.log?.error('System', 'Chat proxy upstream socket error', error.message);
            closeBoth();
        });

        clientSocket.on('data', (chunk) => {
            if (!upstream.writable) return;
            if (session.indicatorJid && chunk.toString('utf8').includes(session.indicatorJid)) {
                this.log?.info('System', 'Dropped client stanza to Appear Offline indicator');
                return;
            }
            upstream.write(rewriter.process(chunk));
        });

        upstream.on('data', (chunk) => {
            if (!clientSocket.writable) return;

            let outgoing = chunk;
            let outgoingText = null;

            if (!session.indicatorInjected) {
                outgoingText = chunk.toString('utf8');
                const injected = this.tryInjectIndicator(outgoingText);
                if (injected) {
                    session.indicatorInjected = true;
                    session.indicatorJid = injected.jid;
                    outgoingText = injected.injected;
                }
            }

            if (session.indicatorInjected && session.indicatorJid && !session.indicatorPresenceSent) {
                if (outgoingText == null) outgoingText = chunk.toString('utf8');
                const iqClose = '</iq>';
                const closeIndex = outgoingText.lastIndexOf(iqClose);
                if (closeIndex !== -1) {
                    const insertPos = closeIndex + iqClose.length;
                    const presenceText =
                        (this.mode === 'offline'
                            ? this.buildIndicatorPresenceOnline(session.indicatorJid)
                            : this.buildIndicatorPresenceUnavailable(session.indicatorJid)
                        ).toString('utf8');
                    outgoingText = outgoingText.slice(0, insertPos) + presenceText + outgoingText.slice(insertPos);
                    session.indicatorPresenceSent = true;
                }
            }

            if (outgoingText != null) {
                outgoing = Buffer.from(outgoingText, 'utf8');
            }

            clientSocket.write(outgoing);
        });

        clientSocket.on('end', closeBoth);
        upstream.on('end', closeBoth);
    }
}

module.exports = ChatPresenceProxy;
