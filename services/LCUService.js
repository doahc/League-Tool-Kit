const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const LogThrottle = require('../utils/LogThrottle');

/**
 * LCU Service - Fixed and Improved
 * - Better error handling
 * - Proper encoding handling
 * - Smart caching
 * - Memory leak prevention
 */
class LCUService extends EventEmitter {
    constructor() {
        super();
        this.logThrottle = new LogThrottle(5000);
        this.credentials = null;
        this.isConnected = false;
        this.retryAttempts = 0;
        this.maxRetries = 3;
        this.pollingInterval = null;
        this.connectionCheckInterval = null;
        this.lastCheckTime = 0;
        this.checkThrottleMs = 3000;
        this.wasConnected = false;
        this.isDestroyed = false;
        
        this.processCache = {
            cmdline: null,
            timestamp: 0,
            cacheDuration: 2000
        };

        // Track active requests for cleanup
        this.activeRequests = new Set();
    }

    /**
     * Find credentials with better error handling and encoding
     */
    async findCredentials() {
        try {
            const now = Date.now();
            if (this.processCache.cmdline && 
                (now - this.processCache.timestamp) < this.processCache.cacheDuration) {
                return this.parseCredentialsFromCmdline(this.processCache.cmdline);
            }

            // PowerShell with explicit UTF8 encoding
            const psCommand = `
                [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
                $process = Get-Process -Name "LeagueClientUx" -ErrorAction SilentlyContinue
                if ($process) {
                    (Get-WmiObject Win32_Process -Filter "ProcessId = $($process.Id)").CommandLine
                }
            `.replace(/\s+/g, ' ').trim();

            let cmdline = '';
            try {
                cmdline = execSync(`powershell -NoProfile -Command "${psCommand}"`, { 
                    encoding: 'utf8',
                    windowsHide: true,
                    timeout: 5000,
                    stdio: ['pipe', 'pipe', 'ignore'],
                    maxBuffer: 1024 * 1024
                }).trim();
            } catch (error) {
                // Client not running, try lockfile
                return this.findCredentialsFromLockfile();
            }

            if (!cmdline || cmdline.length === 0) {
                return this.findCredentialsFromLockfile();
            }

            this.processCache.cmdline = cmdline;
            this.processCache.timestamp = now;

            return this.parseCredentialsFromCmdline(cmdline);
        } catch (error) {
            return this.findCredentialsFromLockfile();
        }
    }

    parseCredentialsFromCmdline(cmdline) {
        if (!cmdline) return null;

        const portMatch = cmdline.match(/--app-port=(\d+)/);
        const tokenMatch = cmdline.match(/--remoting-auth-token=([\w-]+)/);

        if (!portMatch || !tokenMatch) {
            return null;
        }

        const port = parseInt(portMatch[1]);
        const password = tokenMatch[1];

        if (isNaN(port) || !password) {
            return null;
        }

        this.credentials = {
            port: port,
            password: password,
            protocol: 'https'
        };

        return this.credentials;
    }

    async findCredentialsFromLockfile() {
        try {
            const lockfilePath = this.getLockfilePath();
            
            if (!fs.existsSync(lockfilePath)) {
                return null;
            }

            const lockfileContent = fs.readFileSync(lockfilePath, 'utf8');
            const parts = lockfileContent.split(':');

            if (parts.length < 5) {
                return null;
            }

            const [processName, pid, port, password, protocol] = parts;

            if (!port || !password) {
                return null;
            }

            this.credentials = {
                port: parseInt(port),
                password: password,
                protocol: protocol || 'https',
                pid: parseInt(pid)
            };

            return this.credentials;
        } catch (error) {
            return null;
        }
    }

    getLockfilePath() {
        const platform = process.platform;
        
        if (platform === 'win32') {
            const possiblePaths = [
                path.join('C:', 'Riot Games', 'League of Legends', 'lockfile'),
                path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Riot Games', 'League of Legends', 'lockfile'),
                path.join(process.env.LOCALAPPDATA || '', 'Riot Games', 'League of Legends', 'lockfile'),
                path.join('C:', 'Program Files', 'Riot Games', 'League of Legends', 'lockfile'),
                path.join('C:', 'Program Files (x86)', 'Riot Games', 'League of Legends', 'lockfile'),
            ];
            
            for (const possiblePath of possiblePaths) {
                if (fs.existsSync(possiblePath)) {
                    return possiblePath;
                }
            }
            
            return path.join(process.env.LOCALAPPDATA || '', 'Riot Games', 'League of Legends', 'lockfile');
        } else if (platform === 'darwin') {
            return path.join(process.env.HOME || '', 'Library', 'Application Support', 'Riot Games', 'League of Legends', 'lockfile');
        } else {
            return path.join(process.env.HOME || '', '.local', 'share', 'Riot Games', 'League of Legends', 'lockfile');
        }
    }

    async isClientRunning() {
        const now = Date.now();
        if (now - this.lastCheckTime < this.checkThrottleMs) {
            return this.isConnected;
        }
        this.lastCheckTime = now;

        const creds = await this.findCredentials();
        return creds !== null;
    }

    /**
     * Make HTTP request with proper cleanup and abort support
     */
    async request(method, endpoint, body = null, timeout = 10000) {
        if (!this.credentials) {
            throw new Error('LCU not connected');
        }

        if (this.isDestroyed) {
            throw new Error('Service destroyed');
        }

        return new Promise((resolve, reject) => {
            const auth = Buffer.from(`riot:${this.credentials.password}`).toString('base64');
            
            const options = {
                hostname: '127.0.0.1',
                port: this.credentials.port,
                path: endpoint,
                method: method,
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                rejectUnauthorized: false,
                requestCert: false,
                agent: false
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    this.activeRequests.delete(req);
                    try {
                        const parsed = data ? JSON.parse(data) : null;
                        resolve({
                            status: res.statusCode,
                            data: parsed,
                            headers: res.headers
                        });
                    } catch (e) {
                        resolve({
                            status: res.statusCode,
                            data: data,
                            headers: res.headers
                        });
                    }
                });
            });

            req.on('error', (error) => {
                this.activeRequests.delete(req);
                reject(error);
            });

            req.setTimeout(timeout, () => {
                req.destroy();
                this.activeRequests.delete(req);
                reject(new Error('Request timeout'));
            });

            // Track request for cleanup
            this.activeRequests.add(req);

            if (body) {
                req.write(JSON.stringify(body));
            }

            req.end();
        });
    }

    async get(endpoint) { return this.request('GET', endpoint); }
    async post(endpoint, body = null) { return this.request('POST', endpoint, body); }
    async put(endpoint, body = null) { return this.request('PUT', endpoint, body); }
    async delete(endpoint) { return this.request('DELETE', endpoint); }
    async patch(endpoint, body = null) { return this.request('PATCH', endpoint, body); }

    /**
     * Connect with better validation
     */
    async connect() {
        if (this.isDestroyed) return false;

        try {
            const creds = await this.findCredentials();
            
            if (!creds) {
                if (this.wasConnected) {
                    console.warn('[LCU][WARN] Client disconnected');
                    this.wasConnected = false;
                }
                
                this.isConnected = false;
                this.emit('onDisconnect', { reason: 'Client not running' });
                return false;
            }

            // Test connection
            const response = await this.get('/lol-summoner/v1/current-summoner');
            
            if (response.status === 200 && response.data) {
                const wasDisconnected = !this.isConnected;
                this.isConnected = true;
                this.retryAttempts = 0;
                
                if (!this.wasConnected) {
                    console.info('[LCU][INFO] ✓ Connected successfully!');
                    this.wasConnected = true;
                }
                
                if (wasDisconnected) {
                    this.emit('onConnect', { credentials: this.credentials });
                }
                return true;
            } else {
                return false;
            }
        } catch (error) {
            if (this.isConnected) {
                this.isConnected = false;
                this.credentials = null;
                console.warn('[LCU][WARN] Connection lost');
                this.emit('onDisconnect', { reason: error.message });
            }
            
            this.retryAttempts++;
            
            if (this.retryAttempts < this.maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.connect();
            }

            this.logThrottle.log('LCU', 'ERROR', 'Connection failed after retries', error.message);
            this.emit('onError', { error: error.message });
            return false;
        }
    }

    startPolling(interval = 5000) {
        if (this.isDestroyed) return;

        this.stopPolling();

        this.pollingInterval = setInterval(async () => {
            if (this.isDestroyed) return;
            
            const running = await this.isClientRunning();
            
            if (running && !this.isConnected) {
                await this.connect();
            } else if (!running && this.isConnected) {
                this.disconnect();
            }
        }, interval);

        this.connectionCheckInterval = setInterval(async () => {
            if (this.isDestroyed || !this.isConnected) return;
            
            try {
                const response = await this.get('/lol-summoner/v1/current-summoner');
                if (response.status !== 200) {
                    this.disconnect();
                    await this.connect();
                }
            } catch (error) {
                this.disconnect();
                await this.connect();
            }
        }, 30000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }
    }

    disconnect() {
        if (this.isConnected) {
            console.info('[LCU][INFO] Disconnecting');
        }
        this.isConnected = false;
        this.wasConnected = false;
        this.credentials = null;
        this.processCache = { cmdline: null, timestamp: 0, cacheDuration: 2000 };
        this.emit('onDisconnect', { reason: 'Manual disconnect' });
    }

    /**
     * Proper cleanup to prevent memory leaks
     */
    destroy() {
        console.info('[LCU][INFO] Destroying service');
        this.isDestroyed = true;
        
        // Abort all active requests
        for (const req of this.activeRequests) {
            try {
                req.destroy();
            } catch (e) {
                // Ignore
            }
        }
        this.activeRequests.clear();
        
        this.stopPolling();
        this.disconnect();
        this.removeAllListeners();
    }
}

module.exports = LCUService;