const http = require('http');
const https = require('https');
const { URL } = require('url');

function base64UrlDecode(input) {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return Buffer.from(padded, 'base64').toString('utf8');
}

async function httpsGetBuffer(url, headers) {
    return new Promise((resolve, reject) => {
        const request = https.request(
            url,
            {
                method: 'GET',
                headers,
            },
            (response) => {
                const chunks = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end', () => {
                    resolve({
                        statusCode: response.statusCode || 0,
                        headers: response.headers || {},
                        body: Buffer.concat(chunks),
                    });
                });
            }
        );

        request.on('error', reject);
        request.end();
    });
}

async function resolveAffinityHost(authorization, affinities, fallbackHost) {
    if (!authorization || !affinities || typeof affinities !== 'object') return fallbackHost;

    try {
        const { statusCode, body } = await httpsGetBuffer('https://riot-geo.pas.si.riotgames.com/pas/v1/service/chat', {
            Authorization: authorization,
            'User-Agent': 'LTK',
            'Accept-Encoding': 'identity',
        });

        if (statusCode < 200 || statusCode >= 300) return fallbackHost;

        const text = body.toString('utf8').trim();
        if (!text) return fallbackHost;

        // Expected to be a raw JWT string.
        const token = text.replace(/^\"|\"$/g, '');
        const parts = token.split('.');
        if (parts.length < 2) return fallbackHost;

        const payload = JSON.parse(base64UrlDecode(parts[1]));
        const affinity = payload?.affinity;
        if (!affinity || typeof affinity !== 'string') return fallbackHost;

        const host = affinities[affinity];
        return typeof host === 'string' && host.length > 0 ? host : fallbackHost;
    } catch {
        return fallbackHost;
    }
}

class ClientConfigProxy {
    constructor({ chatPort, log, onChatTarget }) {
        this.chatPort = chatPort;
        this.log = log;
        this.onChatTarget = onChatTarget;
        this.server = null;
        this.port = null;
    }

    async start() {
        if (this.server) return { success: true, port: this.port };

        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res).catch((error) => {
                this.log?.error('System', 'ClientConfig proxy error', error.message);
                res.statusCode = 502;
                res.setHeader('Content-Type', 'text/plain');
                res.end('Bad Gateway');
            });
        });

        await new Promise((resolve, reject) => {
            this.server.listen(0, '127.0.0.1', () => resolve());
            this.server.on('error', reject);
        });

        this.port = this.server.address().port;
        this.log?.info('System', `ClientConfig proxy listening on 127.0.0.1:${this.port}`);
        return { success: true, port: this.port };
    }

    async stop() {
        if (!this.server) return;

        await new Promise((resolve) => this.server.close(() => resolve()));
        this.server = null;
        this.port = null;
    }

    async handleRequest(req, res) {
        if (!req?.url) {
            res.statusCode = 400;
            res.end('Bad Request');
            return;
        }

        if (req.method !== 'GET') {
            res.statusCode = 405;
            res.setHeader('Allow', 'GET');
            res.end('Method Not Allowed');
            return;
        }

        const upstreamUrl = new URL(req.url, 'https://clientconfig.rpg.riotgames.com');

        const upstreamHeaders = {
            'User-Agent': req.headers['user-agent'] || 'LTK',
            'Accept-Encoding': 'identity',
        };

        if (req.headers['authorization']) {
            upstreamHeaders['Authorization'] = req.headers['authorization'];
        }

        if (req.headers['x-riot-entitlements-jwt']) {
            upstreamHeaders['X-Riot-Entitlements-JWT'] = req.headers['x-riot-entitlements-jwt'];
        }

        const upstream = await httpsGetBuffer(upstreamUrl.toString(), upstreamHeaders);
        const statusCode = upstream.statusCode;
        const contentType = (upstream.headers['content-type'] || '').toString();

        // Forward non-success codes without touching them (Riot Client will retry).
        if (statusCode < 200 || statusCode >= 300) {
            res.statusCode = statusCode;
            res.setHeader('Content-Type', contentType || 'application/octet-stream');
            res.end(upstream.body);
            return;
        }

        const isJson = contentType.toLowerCase().includes('application/json');
        if (!isJson) {
            res.statusCode = statusCode;
            res.setHeader('Content-Type', contentType || 'application/octet-stream');
            res.end(upstream.body);
            return;
        }

        const bodyText = upstream.body.toString('utf8');
        let config;
        try {
            config = JSON.parse(bodyText);
        } catch {
            res.statusCode = statusCode;
            res.setHeader('Content-Type', contentType);
            res.end(upstream.body);
            return;
        }

        const originalHost = typeof config?.['chat.host'] === 'string' ? config['chat.host'] : null;
        const originalPort = Number.isFinite(Number(config?.['chat.port'])) ? Number(config['chat.port']) : null;

        const affinities = config?.['chat.affinities'];
        const affinityEnabled = Boolean(config?.['chat.affinity.enabled']);
        const authHeader = upstreamHeaders['Authorization'];

        let resolvedHost = originalHost;
        if (affinityEnabled && originalHost && affinities) {
            resolvedHost = await resolveAffinityHost(authHeader, affinities, originalHost);
        }

        if (resolvedHost && originalPort) {
            this.onChatTarget?.({ host: resolvedHost, port: originalPort });
        }

        if (config?.['chat.host'] != null) config['chat.host'] = '127.0.0.1';
        if (config?.['chat.port'] != null) config['chat.port'] = this.chatPort;

        if (affinities && typeof affinities === 'object') {
            for (const key of Object.keys(affinities)) {
                affinities[key] = '127.0.0.1';
            }
        }

        config['chat.allow_bad_cert.enabled'] = true;

        const modified = Buffer.from(JSON.stringify(config), 'utf8');

        res.statusCode = statusCode;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', String(modified.length));
        res.end(modified);
    }
}

module.exports = ClientConfigProxy;

