const { EventEmitter } = require('events');
const { autoUpdater } = require('electron-updater');
const { app, dialog } = require('electron');

/**
 * Update Service - Sistema de Auto-Update
 * - Verifica atualizações automaticamente
 * - Download em background
 * - Instalação automática ou manual
 * - Notificações de progresso
 */
class UpdateService extends EventEmitter {
    constructor() {
        super();
        
        this.updateStatus = {
            checking: false,
            available: false,
            downloading: false,
            downloaded: false,
            error: null,
            version: null,
            progress: 0
        };

        this.config = {
            autoDownload: true,
            autoInstallOnAppQuit: true,
            checkOnStartup: true,
            checkInterval: 3600000 // 1 hora
        };

        this.checkInterval = null;
        this.setupAutoUpdater();
    }

    /**
     * Configurar electron-updater
     */
    setupAutoUpdater() {
        // Configurações do autoUpdater
        autoUpdater.autoDownload = this.config.autoDownload;
        autoUpdater.autoInstallOnAppQuit = this.config.autoInstallOnAppQuit;

        // Logger personalizado
        autoUpdater.logger = {
            info: (msg) => console.log('[Updater]', msg),
            warn: (msg) => console.warn('[Updater]', msg),
            error: (msg) => console.error('[Updater]', msg)
        };

        // Event Handlers
        autoUpdater.on('checking-for-update', () => {
            console.log('[Updater] 🔍 Checking for updates...');
            this.updateStatus.checking = true;
            this.updateStatus.error = null;
            this.emitStatus();
        });

        autoUpdater.on('update-available', (info) => {
            console.log('[Updater] ✅ Update available:', info.version);
            this.updateStatus.checking = false;
            this.updateStatus.available = true;
            this.updateStatus.version = info.version;
            this.emitStatus();
            
            this.showUpdateAvailableNotification(info);
        });

        autoUpdater.on('update-not-available', (info) => {
            console.log('[Updater] ℹ️ No updates available');
            this.updateStatus.checking = false;
            this.updateStatus.available = false;
            this.emitStatus();
        });

        autoUpdater.on('download-progress', (progressObj) => {
            const percent = Math.round(progressObj.percent);
            console.log(`[Updater] 📥 Download progress: ${percent}%`);
            
            this.updateStatus.downloading = true;
            this.updateStatus.progress = percent;
            this.emitStatus();
        });

        autoUpdater.on('update-downloaded', (info) => {
            console.log('[Updater] ✅ Update downloaded:', info.version);
            this.updateStatus.downloading = false;
            this.updateStatus.downloaded = true;
            this.updateStatus.progress = 100;
            this.emitStatus();
            
            this.showUpdateDownloadedNotification(info);
        });

        autoUpdater.on('error', (error) => {
            console.error('[Updater] ❌ Error:', error.message);
            this.updateStatus.checking = false;
            this.updateStatus.downloading = false;
            this.updateStatus.error = error.message;
            this.emitStatus();
        });
    }

    /**
     * Emitir status para renderer
     */
    emitStatus() {
        this.emit('status-changed', this.updateStatus);
    }

    /**
     * Verificar atualizações manualmente
     */
    async checkForUpdates() {
        if (this.updateStatus.checking || this.updateStatus.downloading) {
            console.warn('[Updater] Already checking/downloading');
            return;
        }

        try {
            console.log('[Updater] 🔍 Manual check initiated');
            await autoUpdater.checkForUpdates();
        } catch (error) {
            console.error('[Updater] Check failed:', error);
            this.updateStatus.error = error.message;
            this.emitStatus();
        }
    }

    /**
     * Iniciar verificação automática
     */
    startAutoCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        // Verificar na inicialização
        if (this.config.checkOnStartup) {
            setTimeout(() => this.checkForUpdates(), 5000);
        }

        // Verificar periodicamente
        this.checkInterval = setInterval(() => {
            this.checkForUpdates();
        }, this.config.checkInterval);

        console.log('[Updater] ✅ Auto-check enabled');
    }

    /**
     * Parar verificação automática
     */
    stopAutoCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('[Updater] ❌ Auto-check disabled');
        }
    }

    /**
     * Download manual da atualização
     */
    async downloadUpdate() {
        if (!this.updateStatus.available || this.updateStatus.downloading) {
            console.warn('[Updater] No update available or already downloading');
            return;
        }

        try {
            console.log('[Updater] 📥 Starting manual download');
            await autoUpdater.downloadUpdate();
        } catch (error) {
            console.error('[Updater] Download failed:', error);
            this.updateStatus.error = error.message;
            this.emitStatus();
        }
    }

    /**
     * Instalar e reiniciar
     */
    quitAndInstall() {
        if (!this.updateStatus.downloaded) {
            console.warn('[Updater] No update downloaded');
            return;
        }

        console.log('[Updater] 🔄 Quitting and installing update');
        autoUpdater.quitAndInstall(false, true);
    }

    /**
     * Notificação de atualização disponível
     */
    showUpdateAvailableNotification(info) {
        const currentVersion = app.getVersion();
        
        dialog.showMessageBox({
            type: 'info',
            title: 'Update Available',
            message: `New version ${info.version} is available!`,
            detail: `Current version: ${currentVersion}\nNew version: ${info.version}\n\nThe update will be downloaded in the background.`,
            buttons: ['OK']
        });
    }

    /**
     * Notificação de atualização baixada
     */
    showUpdateDownloadedNotification(info) {
        const response = dialog.showMessageBoxSync({
            type: 'info',
            title: 'Update Ready',
            message: `Version ${info.version} has been downloaded!`,
            detail: 'The update will be installed when you close the application.\n\nDo you want to restart now?',
            buttons: ['Restart Now', 'Later'],
            defaultId: 0,
            cancelId: 1
        });

        if (response === 0) {
            this.quitAndInstall();
        }
    }

    /**
     * Obter status atual
     */
    getStatus() {
        return {
            ...this.updateStatus,
            currentVersion: app.getVersion()
        };
    }

    /**
     * Configurar opções
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
        
        if (config.autoDownload !== undefined) {
            autoUpdater.autoDownload = config.autoDownload;
        }
        
        if (config.autoInstallOnAppQuit !== undefined) {
            autoUpdater.autoInstallOnAppQuit = config.autoInstallOnAppQuit;
        }

        console.log('[Updater] Config updated:', this.config);
    }

    /**
     * Limpar recursos
     */
    destroy() {
        this.stopAutoCheck();
        this.removeAllListeners();
        console.log('[Updater] Service destroyed');
    }
}

module.exports = UpdateService;