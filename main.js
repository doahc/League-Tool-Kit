const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

// Services
const LCUService = require('./services/LCUService');
const SummonerService = require('./services/SummonerService');
const FeatureService = require('./services/FeatureService');
const MatchService = require('./services/MatchService');
const StatsService = require('./services/StatsService');
const LogService = require('./services/LogService');
const UpdateService = require('./services/UpdateService');

let mainWindow;
let services = {};
let updateInterval;

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

app.whenReady().then(() => {
    createWindow();
    initializeServices();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    // Smart update interval
    updateInterval = setInterval(() => {
        if (services.lcu?.isConnected && mainWindow && !mainWindow.isDestroyed()) {
            updateAllData();
        }
    }, 15000); // 15 seconds
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            devTools: true
        },
        frame: false,
        resizable: true,
        backgroundColor: '#050507',
        icon: path.join(__dirname, 'assets/icon.ico'),
        titleBarStyle: 'hidden',
        show: false
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        services.log?.success('System', 'Application window ready');
    });

    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        cleanupServices();
        mainWindow = null;
    });
}

function initializeServices() {
    console.log('[Main] 🚀 Initializing services...');
    
    // Initialize LogService first
    services.log = new LogService();
    
    // Forward logs to renderer
    services.log.on('log', (logEntry) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('log-entry', logEntry);
        }
    });
    
    // Initialize UpdateService
    services.update = new UpdateService();
    
    // Forward update status to renderer
    services.update.on('status-changed', (status) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-status', status);
        }
    });
    
    // Start auto-check for updates
    services.update.startAutoCheck();
    
    // Initialize core services
    services.lcu = new LCUService();
    services.summoner = new SummonerService(services.lcu);
    services.feature = new FeatureService(services.lcu);
    services.match = new MatchService(services.lcu);
    services.stats = new StatsService(services.lcu);

    // LCU Event Handlers
    services.lcu.on('onConnect', async (data) => {
        services.log.success('LCU', 'Connected successfully');
        
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('lcu-connected', data);
            setTimeout(() => updateAllData(), 1000);
        }
    });

    services.lcu.on('onDisconnect', (data) => {
        services.log.warning('LCU', 'Disconnected', data.reason);
        
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('lcu-disconnected', data);
        }
        
        services.summoner?.clearCache();
        services.match?.clearCache();
    });

    services.lcu.on('onError', (data) => {
        services.log.error('LCU', 'Error occurred', data.error);
        
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('lcu-error', data);
        }
    });

    // Start LCU polling
    services.log.info('LCU', 'Starting polling...');
    services.lcu.startPolling(3000);
    
    setTimeout(async () => {
        const connected = await services.lcu.connect();
        services.log.info('LCU', connected ? 'Initial connection successful' : 'Initial connection failed');
    }, 1000);
}

async function updateAllData() {
    if (!services.lcu?.isConnected) return;

    try {
        // Get summoner data
        const summonerData = await services.summoner.getAllData();
        
        if (summonerData.isComplete && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('summoner-data', summonerData);
            
            // Get match history
            if (summonerData.summoner?.puuid) {
                const matches = await services.match.getMatchHistory(summonerData.summoner.puuid, 20);
                mainWindow.webContents.send('match-data', { matches });
            }

            // Get detailed ranked stats
            const rankedStats = await services.stats.getDetailedRankedStats();
            if (rankedStats) {
                mainWindow.webContents.send('ranked-stats', rankedStats);
            }
        }
    } catch (error) {
        services.log.error('System', 'Failed to update data', error.message);
    }
}

function cleanupServices() {
    services.log?.info('System', 'Cleaning up services...');
    
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
    
    services.update?.destroy();
    services.lcu?.destroy();
    services.feature?.destroy();
    services.summoner?.clearCache();
    services.match?.clearCache();
    
    services = {};
}

app.on('window-all-closed', () => {
    cleanupServices();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', cleanupServices);
app.on('will-quit', cleanupServices);

// ==================== IPC HANDLERS ====================

// Window Controls
ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
    if (mainWindow) {
        mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    }
});
ipcMain.handle('window-close', () => mainWindow?.close());

// LCU Status
ipcMain.handle('lcu-status', async () => ({
    connected: services.lcu?.isConnected ?? false,
    credentials: services.lcu?.isConnected ? services.lcu.credentials : null
}));

// Summoner Data
ipcMain.handle('get-summoner-data', async () => {
    if (!services.summoner || !services.lcu?.isConnected) {
        return { success: false, error: 'Service not initialized or LCU disconnected' };
    }

    try {
        const data = await services.summoner.getAllData();
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Refresh All Data
ipcMain.handle('refresh-data', async () => {
    if (!services.lcu) {
        return { success: false, error: 'Service not initialized' };
    }

    try {
        services.summoner?.clearCache();
        services.match?.clearCache();
        services.lcu.stopPolling();
        
        const connected = await services.lcu.connect();
        services.lcu.startPolling(3000);
        
        if (connected) {
            await updateAllData();
            services.log.success('System', 'Data refreshed');
            return { success: true };
        }
        
        return { success: false, error: 'Could not connect to LCU' };
    } catch (error) {
        services.lcu.startPolling(3000);
        return { success: false, error: error.message };
    }
});

// ===== FEATURES =====

// Auto Accept
ipcMain.handle('toggle-auto-accept', async (event, enabled) => {
    if (!services.feature) return { success: false, error: 'Service not initialized' };
    
    try {
        services.log.info('AutoAccept', enabled ? 'Enabled' : 'Disabled');
        return await services.feature.toggleAutoAccept(enabled);
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Auto Pick
ipcMain.handle('set-auto-pick', async (event, championName, enabled) => {
    if (!services.feature) return { success: false, error: 'Service not initialized' };
    
    try {
        services.log.info('AutoPick', `${enabled ? 'Enabled' : 'Disabled'} - Champion: ${championName}`);
        return await services.feature.setAutoPick(championName, enabled);
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Auto Ban
ipcMain.handle('set-auto-ban', async (event, championName, enabled, protectBan = true) => {
    if (!services.feature) return { success: false, error: 'Service not initialized' };
    
    try {
        services.log.info('AutoBan', `${enabled ? 'Enabled' : 'Disabled'} - Champion: ${championName} - Protect: ${protectBan}`);
        return await services.feature.setAutoBan(championName, enabled, protectBan);
    } catch (error) {
        services.log.error('AutoBan', 'Error', error.message);
        return { success: false, error: error.message };
    }
});

// Chat
ipcMain.handle('toggle-chat', async (event, disconnect) => {
    if (!services.feature) return { success: false, error: 'Service not initialized' };
    
    try {
        services.log.info('Chat', disconnect ? 'Disconnected' : 'Connected');
        return await services.feature.toggleChat(disconnect);
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Profile Actions
ipcMain.handle('change-icon', async (event, iconId) => {
    if (!services.feature) return { success: false, error: 'Service not initialized' };
    
    try {
        services.log.info('Profile', `Changing icon to ${iconId}`);
        return await services.feature.changeProfileIcon(iconId);
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('change-background', async (event, skinId) => {
    if (!services.feature) return { success: false, error: 'Service not initialized' };
    
    try {
        services.log.info('Profile', `Changing background to ${skinId}`);
        return await services.feature.changeBackground(skinId);
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('change-riot-id', async (event, gameName, tagLine) => {
    if (!services.feature) return { success: false, error: 'Service not initialized' };
    
    try {
        services.log.info('Profile', `Changing Riot ID to ${gameName}#${tagLine}`);
        return await services.feature.changeRiotId(gameName, tagLine);
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('change-status', async (event, statusMessage) => {
    if (!services.feature) return { success: false, error: 'Service not initialized' };
    
    try {
        services.log.info('Profile', 'Changing status message');
        return await services.feature.changeStatus(statusMessage);
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('remove-badges', async () => {
    if (!services.feature) return { success: false, error: 'Service not initialized' };
    
    try {
        services.log.info('Profile', 'Removing badges');
        return await services.feature.removeBadges();
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Game Actions
ipcMain.handle('reveal-lobby', async () => {
    if (!services.feature) return { success: false, error: 'Service not initialized' };
    
    try {
        const result = await services.feature.revealLobby();
        if (result.success && result.url) {
            shell.openExternal(result.url);
            services.log.success('Feature', 'Lobby revealed');
        }
        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('dodge', async () => {
    if (!services.feature) return { success: false, error: 'Service not initialized' };
    
    try {
        services.log.warning('Feature', 'Game dodged');
        return await services.feature.dodgeGame();
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('remove-friends', async () => {
    if (!services.feature) return { success: false, error: 'Service not initialized' };
    
    try {
        const result = await services.feature.removeAllFriends();
        services.log.warning('Feature', `Removed ${result.removed || 0} friends`);
        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('restart-client', async () => {
    if (!services.feature) return { success: false, error: 'Service not initialized' };
    
    try {
        services.log.info('Feature', 'Restarting client');
        return await services.feature.restartClient();
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Feature States
ipcMain.handle('get-feature-states', async () => {
    if (!services.feature) return { success: false, error: 'Service not initialized' };
    
    try {
        return { success: true, states: services.feature.getFeatureStates() };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ===== MATCH & STATS =====

// Get Match History
ipcMain.handle('get-match-history', async (event, puuid, count = 20) => {
    if (!services.match || !services.lcu?.isConnected) {
        return { success: false, error: 'Service not initialized or LCU disconnected' };
    }

    try {
        const matches = await services.match.getMatchHistory(puuid, count);
        const stats = services.match.getAggregatedStats(matches);
        const mostPlayed = services.match.getMostPlayedChampions(matches, 5);
        const streak = services.match.getCurrentStreak(matches);

        return {
            success: true,
            matches,
            stats,
            mostPlayed,
            streak
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Calculate Games to Next Rank
ipcMain.handle('calculate-games-to-rank', async (event, tier, division, lp, winrate) => {
    if (!services.stats) return { success: false, error: 'Service not initialized' };

    try {
        const result = services.stats.calculateGamesToNextRank(tier, division, lp, winrate);
        return { success: true, ...result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get Detailed Ranked Stats
ipcMain.handle('get-ranked-stats', async () => {
    if (!services.stats || !services.lcu?.isConnected) {
        return { success: false, error: 'Service not initialized or LCU disconnected' };
    }

    try {
        const stats = await services.stats.getDetailedRankedStats();
        return { success: true, stats };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ===== LOGS =====

// Get Logs
ipcMain.handle('get-logs', async (event, filter) => {
    if (!services.log) return { success: false, error: 'Service not initialized' };

    try {
        const logs = services.log.getLogs(filter);
        const stats = services.log.getStats();
        return { success: true, logs, stats };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Clear Logs
ipcMain.handle('clear-logs', async () => {
    if (!services.log) return { success: false, error: 'Service not initialized' };

    try {
        services.log.clearLogs();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Export Logs
ipcMain.handle('export-logs', async (event, outputPath) => {
    if (!services.log) return { success: false, error: 'Service not initialized' };

    try {
        return await services.log.exportLogs(outputPath);
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ===== SYSTEM =====

// Get Client Info
ipcMain.handle('get-client-info', async () => {
    if (!services.lcu?.isConnected) {
        return { success: false, error: 'LCU not connected' };
    }
    
    try {
        const responses = await Promise.allSettled([
            services.lcu.get('/lol-patch/v1/game-version'),
            services.lcu.get('/lol-platform-config/v1/namespaces/LoginDataPacket'),
            services.lcu.get('/riotclient/region-locale')
        ]);
        
        return {
            success: true,
            version: responses[0].status === 'fulfilled' ? responses[0].value.data : 'Unknown',
            platform: responses[1].status === 'fulfilled' ? responses[1].value.data?.platformId : 'Unknown',
            region: responses[2].status === 'fulfilled' ? responses[2].value.data : {}
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Open Client Logs
ipcMain.handle('open-client-logs', () => {
    const logsPath = path.join(require('os').homedir(), 'AppData', 'Local', 'Riot Games', 'League of Legends', 'Logs');
    shell.openPath(logsPath);
});

// Open App Data
ipcMain.handle('open-app-data', () => {
    shell.openPath(app.getPath('userData'));
});

// Clear Cache
ipcMain.handle('clear-cache', async () => {
    services.summoner?.clearCache();
    services.match?.clearCache();
    services.log?.success('System', 'Cache cleared');
    return { success: true };
});

// ===== UPDATES =====

// Check for Updates
ipcMain.handle('check-for-updates', async () => {
    if (!services.update) return { success: false, error: 'Service not initialized' };
    
    try {
        await services.update.checkForUpdates();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Download Update
ipcMain.handle('download-update', async () => {
    if (!services.update) return { success: false, error: 'Service not initialized' };
    
    try {
        await services.update.downloadUpdate();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Quit and Install
ipcMain.handle('quit-and-install', async () => {
    if (!services.update) return { success: false, error: 'Service not initialized' };
    
    try {
        services.update.quitAndInstall();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get Update Status
ipcMain.handle('get-update-status', async () => {
    if (!services.update) return { success: false, error: 'Service not initialized' };
    
    try {
        const status = services.update.getStatus();
        return { success: true, status };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Set Update Config
ipcMain.handle('set-update-config', async (event, config) => {
    if (!services.update) return { success: false, error: 'Service not initialized' };
    
    try {
        services.update.setConfig(config);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});