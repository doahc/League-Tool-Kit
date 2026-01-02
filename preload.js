const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // ==================== WINDOW CONTROLS ====================
    windowMinimize: () => ipcRenderer.invoke('window-minimize'),
    windowMaximize: () => ipcRenderer.invoke('window-maximize'),
    windowClose: () => ipcRenderer.invoke('window-close'),

    // ==================== LCU ====================
    getLCUStatus: () => ipcRenderer.invoke('lcu-status'),
    
    // ==================== SUMMONER ====================
    getSummonerData: () => ipcRenderer.invoke('get-summoner-data'),
    refreshData: () => ipcRenderer.invoke('refresh-data'),
    
    // ==================== FEATURES ====================
    getFeatureStates: () => ipcRenderer.invoke('get-feature-states'),
    
    // Auto Accept
    toggleAutoAccept: (enabled) => ipcRenderer.invoke('toggle-auto-accept', enabled),
    
    // Auto Pick
    setAutoPick: (championName, enabled) => ipcRenderer.invoke('set-auto-pick', championName, enabled),
    
    // Auto Ban
    setAutoBan: (championName, enabled, protectBan) => ipcRenderer.invoke('set-auto-ban', championName, enabled, protectBan),
    
    // Chat
    toggleChat: (disconnect) => ipcRenderer.invoke('toggle-chat', disconnect),
    
    // ==================== PROFILE ====================
    changeIcon: (iconId) => ipcRenderer.invoke('change-icon', iconId),
    changeBackground: (skinId) => ipcRenderer.invoke('change-background', skinId),
    changeRiotId: (gameName, tagLine) => ipcRenderer.invoke('change-riot-id', gameName, tagLine),
    changeStatus: (statusMessage) => ipcRenderer.invoke('change-status', statusMessage),
    removeBadges: () => ipcRenderer.invoke('remove-badges'),
    
    // ==================== GAME ACTIONS ====================
    revealLobby: () => ipcRenderer.invoke('reveal-lobby'),
    dodge: () => ipcRenderer.invoke('dodge'),
    removeFriends: () => ipcRenderer.invoke('remove-friends'),
    restartClient: () => ipcRenderer.invoke('restart-client'),
    
    // ==================== MATCH & STATS ====================
    getMatchHistory: (puuid, count) => ipcRenderer.invoke('get-match-history', puuid, count),
    calculateGamesToRank: (tier, division, lp, winrate) => ipcRenderer.invoke('calculate-games-to-rank', tier, division, lp, winrate),
    getRankedStats: () => ipcRenderer.invoke('get-ranked-stats'),
    
    // ==================== LOGS ====================
    getLogs: (filter) => ipcRenderer.invoke('get-logs', filter),
    clearLogs: () => ipcRenderer.invoke('clear-logs'),
    exportLogs: (outputPath) => ipcRenderer.invoke('export-logs', outputPath),
    
    // ==================== SYSTEM ====================
    getClientInfo: () => ipcRenderer.invoke('get-client-info'),
    openClientLogs: () => ipcRenderer.invoke('open-client-logs'),
    openAppData: () => ipcRenderer.invoke('open-app-data'),
    clearCache: () => ipcRenderer.invoke('clear-cache'),
    
    // ==================== UPDATES ====================
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
    getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
    setUpdateConfig: (config) => ipcRenderer.invoke('set-update-config', config),
    
    // ==================== EVENT LISTENERS ====================
    
    // LCU Events
    onLCUConnected: (callback) => {
        ipcRenderer.on('lcu-connected', (event, data) => callback(data));
    },
    onLCUDisconnected: (callback) => {
        ipcRenderer.on('lcu-disconnected', (event, data) => callback(data));
    },
    onLCUError: (callback) => {
        ipcRenderer.on('lcu-error', (event, data) => callback(data));
    },
    
    // Data Events
    onSummonerData: (callback) => {
        ipcRenderer.on('summoner-data', (event, data) => callback(data));
    },
    onMatchData: (callback) => {
        ipcRenderer.on('match-data', (event, data) => callback(data));
    },
    onRankedStats: (callback) => {
        ipcRenderer.on('ranked-stats', (event, data) => callback(data));
    },
    
    // Log Events
    onLogEntry: (callback) => {
        ipcRenderer.on('log-entry', (event, data) => callback(data));
    },
    
    // Update Events
    onUpdateStatus: (callback) => {
        ipcRenderer.on('update-status', (event, data) => callback(data));
    },
    
    // Remove Listeners
    removeListener: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    },
    
    // Remove All Listeners
    removeAllListeners: () => {
        const channels = [
            'lcu-connected',
            'lcu-disconnected',
            'lcu-error',
            'summoner-data',
            'match-data',
            'ranked-stats',
            'log-entry',
            'update-status'
        ];
        
        channels.forEach(channel => ipcRenderer.removeAllListeners(channel));
    }
});