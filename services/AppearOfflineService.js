const fs = require('fs');
const path = require('path');

const ChatPresenceProxy = require('./ChatPresenceProxy');
const ClientConfigProxy = require('./ClientConfigProxy');
const RiotClientLauncher = require('./RiotClientLauncher');

class AppearOfflineService {
    constructor(logService, { settingsPath } = {}) {
        this.log = logService;
        this.enabled = false;
        this.desiredOffline = false;
        this.settingsPath = settingsPath || null;

        this.chatProxy = null;
        this.configProxy = null;
        this.chatTarget = null;

        this.loadSettings();
    }

    isEnabled() {
        return this.enabled;
    }

    isAppearingOffline() {
        return Boolean(this.enabled && this.desiredOffline);
    }

    getDesiredOffline() {
        return this.desiredOffline;
    }

    isPending() {
        return Boolean(this.desiredOffline && !this.enabled);
    }

    setDesiredOffline(enabled) {
        if (process.platform !== 'win32') {
            return { success: false, error: 'Appear Offline is supported on Windows only.' };
        }

        this.desiredOffline = Boolean(enabled);
        this.saveSettings();

        // If the proxy is already active, we can switch modes without restarting.
        if (this.enabled && this.chatProxy) {
            this.chatProxy.setMode(this.desiredOffline ? 'offline' : 'passthrough');
        }

        return {
            success: true,
            desiredOffline: this.desiredOffline,
            activeOffline: this.isAppearingOffline(),
            pending: this.isPending(),
        };
    }

    async applyDesired() {
        if (process.platform !== 'win32') {
            return { success: false, error: 'Appear Offline is supported on Windows only.' };
        }

        // If proxy is already running, applying is a no-op (mode changes happen live).
        if (this.enabled) {
            return {
                success: true,
                desiredOffline: this.desiredOffline,
                activeOffline: this.isAppearingOffline(),
                pending: false,
                message: 'No restart needed.',
            };
        }

        if (!this.isPending()) {
            return {
                success: true,
                desiredOffline: this.desiredOffline,
                activeOffline: this.isAppearingOffline(),
                pending: false,
                message: 'No changes to apply.',
            };
        }

        const result = await this.enable();
        if (result.success) this.enabled = true;

        return {
            ...result,
            desiredOffline: this.desiredOffline,
            activeOffline: this.isAppearingOffline(),
            pending: this.isPending(),
        };
    }

    async enable() {
        try {
            const { key, cert } = this.loadTlsCredentials();

            this.chatProxy = new ChatPresenceProxy({
                key,
                cert,
                log: this.log,
                allowMuc: true,
                mode: this.desiredOffline ? 'offline' : 'passthrough',
            });

            const chatStart = await this.chatProxy.start();
            if (!chatStart.success) {
                return { success: false, error: 'Failed to start chat proxy.' };
            }

            this.configProxy = new ClientConfigProxy({
                chatPort: this.chatProxy.port,
                log: this.log,
                onChatTarget: (target) => this.updateChatTarget(target),
            });

            const configStart = await this.configProxy.start();
            if (!configStart.success) {
                await this.chatProxy.stop();
                this.chatProxy = null;
                return { success: false, error: 'Failed to start client-config proxy.' };
            }

            const clientConfigUrl = `http://127.0.0.1:${this.configProxy.port}`;

            const launch = await RiotClientLauncher.restartLeague({ clientConfigUrl });
            if (!launch.success) {
                await this.stopServers();
                return { success: false, error: launch.error || 'Failed to restart Riot Client.' };
            }

            this.log?.success?.('System', 'Appear Offline enabled');
            return {
                success: true,
                enabled: true,
                message: 'Appear Offline enabled (restarting Riot Client)',
            };
        } catch (error) {
            await this.stopServers();
            return { success: false, error: error.message };
        }
    }

    async disable() {
        try {
            const launch = await RiotClientLauncher.restartLeague({ clientConfigUrl: null });
            if (!launch.success) {
                return { success: false, error: launch.error || 'Failed to restart Riot Client.' };
            }

            await this.stopServers();
            this.log?.success?.('System', 'Appear Offline disabled');
            return {
                success: true,
                enabled: false,
                message: 'Appear Offline disabled (restarting Riot Client)',
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    updateChatTarget(target) {
        if (!target?.host || !target?.port) return;
        this.chatTarget = target;
        this.chatProxy?.setTarget(target);
        this.log?.info('System', `Chat target resolved: ${target.host}:${target.port}`);
    }

    loadTlsCredentials() {
        const keyPath = path.join(__dirname, '..', 'assets', 'appear-offline-key.pem');
        const certPath = path.join(__dirname, '..', 'assets', 'appear-offline-cert.pem');

        const key = fs.readFileSync(keyPath);
        const cert = fs.readFileSync(certPath);

        return { key, cert };
    }

    async stopServers() {
        try {
            await this.configProxy?.stop();
        } catch {
            // ignore
        }
        this.configProxy = null;

        try {
            await this.chatProxy?.stop();
        } catch {
            // ignore
        }
        this.chatProxy = null;
        this.chatTarget = null;
    }

    async destroy() {
        await this.stopServers();
    }

    loadSettings() {
        if (!this.settingsPath) return;

        try {
            if (!fs.existsSync(this.settingsPath)) return;
            const raw = fs.readFileSync(this.settingsPath, 'utf8');
            const data = JSON.parse(raw);
            // Backward compatible: older versions stored desiredEnabled (proxy).
            this.desiredOffline = Boolean(data?.desiredOffline ?? data?.desiredEnabled);
        } catch (error) {
            this.log?.warning?.('System', 'Failed to read Appear Offline settings', error.message);
        }
    }

    saveSettings() {
        if (!this.settingsPath) return;

        try {
            fs.mkdirSync(path.dirname(this.settingsPath), { recursive: true });
            fs.writeFileSync(
                this.settingsPath,
                JSON.stringify({ desiredOffline: this.desiredOffline }, null, 2),
                'utf8'
            );
        } catch (error) {
            this.log?.warning?.('System', 'Failed to save Appear Offline settings', error.message);
        }
    }
}

module.exports = AppearOfflineService;
