// ==================== ENVIRONMENT CHECK ====================

const Environment = {
    isElectron: () => typeof window.api !== 'undefined',
    isDevelopment: () => window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
};


// ==================== STATE MANAGEMENT ====================

class AppStateManager {
    constructor() {
        this.state = {
            connected: false,
            summoner: null,
            ranked: null,
            matches: [],
            matchStats: null,
            logs: [],
            features: {
                autoAccept: false,
                autoPick: { enabled: false, champion: '' },
                autoBan: { enabled: false, champion: '', protect: true },
                appearOffline: false,
                appearOfflineActive: false,
                chatDisconnected: false
            },
            currentView: 'dashboard',
            lastUpdateTime: null
        };
        
        this.listeners = new Set();
    }

    get(key) {
        return key ? this.state[key] : this.state;
    }

    set(key, value) {
        this.state[key] = value;
        this.notifyListeners(key, value);
    }

    update(updates) {
        Object.entries(updates).forEach(([key, value]) => {
            this.state[key] = value;
            this.notifyListeners(key, value);
        });
    }

    getFeature(featureName) {
        return this.state.features[featureName];
    }

    setFeature(featureName, value) {
        this.state.features[featureName] = value;
        this.notifyListeners('features', this.state.features);
    }

    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notifyListeners(key, value) {
        this.listeners.forEach(callback => callback(key, value));
    }

    reset() {
        this.state = {
            ...this.state,
            connected: false,
            summoner: null,
            ranked: null,
            matches: [],
            matchStats: null
        };
    }
}

const appState = new AppStateManager();

// ==================== MOCK DATA FOR BROWSER TESTING ====================

const MockData = {
    summoner: {
        gameName: 'MockPlayer',
        tagLine: 'BR1',
        summonerLevel: 150,
        puuid: 'mock-puuid-123',
        platformId: 'BR1',
        region: 'BR'
    },
    
    ranked: {
        solo: {
            tier: 'GOLD',
            division: 'III',
            leaguePoints: 45,
            wins: 120,
            losses: 100,
            rankDisplay: 'Gold III'
        }
    },
    
    credentials: {
        port: '2999',
        protocol: 'https',
        username: 'riot'
    }
};

// ==================== APPLICATION INITIALIZATION ====================

class Application {
    constructor() {
        this.statusMonitorInterval = null;
        this.isInitialized = false;
        this.initialize();
    }

    async initialize() {
        console.log('[App] 🚀 Initializing application...');
        console.log('[App] Environment:', Environment.isElectron() ? 'Electron' : 'Browser');
        
        try {
            this.setupEventListeners();
            
            if (Environment.isElectron()) {
                await this.initializeElectronMode();
            } else {
                this.initializeBrowserMode();
            }
            
            this.isInitialized = true;
            console.log('[App] ✓ Initialized successfully');
        } catch (error) {
            console.error('[App] ✗ Initialization error:', error);
            UI.showNotification('Failed to initialize application', 'error');
        }
    }

    async initializeElectronMode() {
        console.log('[App] Initializing Electron mode...');
        
        await this.checkLCUStatus();
        await this.loadFeatureStates();
        this.setupLCUHandlers();
        this.startStatusMonitor();
    }

    initializeBrowserMode() {
        console.log('[App] Initializing Browser mode (Mock Data)...');
        
        // Load mock data
        appState.update({
            connected: true,
            summoner: MockData.summoner,
            ranked: MockData.ranked
        });
        
        UI.updateConnectionStatus(true, MockData.credentials);
        UI.updateSummonerDisplay();
        UI.hideConnectionWarning();
        UI.showNotification('Running in browser mode with mock data', 'info');
    }

    setupEventListeners() {
        EventHandler.setupAll();
        
        // Listen for state changes
        appState.subscribe((key, value) => {
            console.log(`[State] ${key} updated:`, value);
        });
    
        // Listen for update status changes (Electron only)
        if (Environment.isElectron()) {
            window.api.onUpdateStatus((status) => {
                console.log('[Update] Status changed:', status);
                UpdateController.updateUI(status);
            });
        }
    }

    async checkLCUStatus() {
        if (!Environment.isElectron()) return;
        
        try {
            const status = await window.api.getLCUStatus();
            const wasConnected = appState.get('connected');
            
            appState.set('connected', status.connected);
            UI.updateConnectionStatus(status.connected, status.credentials);
            
            if (status.connected && !wasConnected) {
                console.log('[App] ✓ LCU Connected - Loading data...');
                await DataLoader.loadAll();
                UI.hideConnectionWarning();
            } else if (!status.connected && wasConnected) {
                console.log('[App] ✗ LCU Disconnected');
                UI.showConnectionWarning();
                UI.clearUserData();
            } else if (!status.connected) {
                UI.showConnectionWarning();
            }
        } catch (error) {
            console.error('[App] Failed to check LCU status:', error);
            appState.set('connected', false);
            UI.updateConnectionStatus(false);
            UI.showConnectionWarning();
        }
    }

    async loadFeatureStates() {
        if (!Environment.isElectron()) return;
        
        try {
            const result = await window.api.getFeatureStates();
            if (result.success) {
                appState.set('features', result.states);
                UI.updateFeatureToggles();
            }
        } catch (error) {
            console.error('[App] Failed to load feature states:', error);
        }
    }

    setupLCUHandlers() {
        if (!Environment.isElectron()) return;
        
        window.api.onLCUConnected((data) => this.handleLCUConnected(data));
        window.api.onLCUDisconnected((data) => this.handleLCUDisconnected(data));
        window.api.onLCUError((data) => this.handleLCUError(data));
        window.api.onSummonerData((data) => this.handleSummonerData(data));
        window.api.onMatchData((data) => this.handleMatchData(data));
        window.api.onRankedStats((data) => this.handleRankedStats(data));
        window.api.onLogEntry((logEntry) => this.handleLogEntry(logEntry));
    }

    handleLCUConnected(data) {
        console.log('[App] ✓ LCU Connected');
        appState.set('connected', true);
        UI.updateConnectionStatus(true, data.credentials);
        UI.showNotification('Connected to League Client', 'success');
        UI.hideConnectionWarning();
        DataLoader.loadAll();
    }

    handleLCUDisconnected(data) {
        console.log('[App] ✗ LCU Disconnected');
        appState.set('connected', false);
        UI.updateConnectionStatus(false);
        UI.showNotification('Disconnected from League Client', 'error');
        UI.showConnectionWarning();
        UI.clearUserData();
    }

    handleLCUError(data) {
        console.error('[App] LCU Error:', data);
        UI.showNotification(`LCU Error: ${data.error}`, 'error');
    }

    async handleSummonerData(data) {
        console.log('[App] Summoner data received:', data);
        
        let summoner = data.summoner;
        
        // Ensure summoner has region (it might come without it from backend events)
        if (!summoner.region || summoner.region === undefined) {
            try {
                const regionInfo = await window.api.getClientInfo();
                if (regionInfo.success && regionInfo.region) {
                    summoner.region = regionInfo.region.webRegion || 
                                    regionInfo.region.region || 
                                    regionInfo.platform || 
                                    'BR';
                    console.log('[App] ✓ Added region to summoner:', summoner.region);
                }
            } catch (error) {
                console.warn('[App] Could not fetch region:', error);
                summoner.region = 'BR'; // Default fallback
            }
        }
        
        appState.update({
            summoner: summoner,
            ranked: data.ranked
        });
        UI.updateSummonerDisplay();
    }

    handleMatchData(data) {
        console.log('[App] Match data received');
        appState.set('matches', data.matches || []);
    }

    handleRankedStats(data) {
        console.log('[App] Ranked stats received');
        appState.set('ranked', data);
    }

    handleLogEntry(logEntry) {
        const logs = appState.get('logs');
        logs.unshift(logEntry);
        
        if (logs.length > 500) {
            appState.set('logs', logs.slice(0, 500));
        }
    }

    startStatusMonitor() {
        if (!Environment.isElectron()) return;
        
        if (this.statusMonitorInterval) {
            clearInterval(this.statusMonitorInterval);
        }

        this.statusMonitorInterval = setInterval(() => {
            if (!document.hidden && this.isInitialized) {
                this.checkLCUStatus();
            }
        }, 3000);
    }

    destroy() {
        if (this.statusMonitorInterval) {
            clearInterval(this.statusMonitorInterval);
            this.statusMonitorInterval = null;
        }
        this.isInitialized = false;
    }
}

// ==================== DATA LOADER ====================

class DataLoader {
    static async loadAll() {
        if (!Environment.isElectron()) {
            console.log('[DataLoader] Skipping - Browser mode');
            return;
        }
        
        try {
            console.log('[DataLoader] Loading all data...');
            
            await Promise.allSettled([
                this.loadSummonerData(),
                this.loadMatchHistory(),
                this.loadRankedStats()
            ]);
            
            appState.set('lastUpdateTime', new Date());
            console.log('[DataLoader] ✓ All data loaded');
        } catch (error) {
            console.error('[DataLoader] Failed to load data:', error);
        }
    }

    static async loadSummonerData() {
        try {
            const result = await window.api.getSummonerData();
            
            if (result.success && result.data) {
                let summoner = result.data.summoner;
                
                // Always fetch region from client info since backend doesn't provide it
                try {
                    const regionInfo = await window.api.getClientInfo();
                    if (regionInfo.success && regionInfo.region) {
                        // Priority: webRegion > region > platform
                        summoner.region = regionInfo.region.webRegion || 
                                        regionInfo.region.region || 
                                        regionInfo.platform || 
                                        'BR';
                        
                        console.log('[DataLoader] ✓ Region fetched from client:', summoner.region);
                    }
                } catch (error) {
                    console.warn('[DataLoader] Could not fetch region:', error);
                    summoner.region = 'BR'; // Default fallback
                }
                
                appState.update({
                    summoner: summoner,
                    ranked: result.data.ranked
                });
                UI.updateSummonerDisplay();
            }
        } catch (error) {
            console.error('[DataLoader] Failed to load summoner data:', error);
        }
    }

    static async loadMatchHistory() {
        const summoner = appState.get('summoner');
        
        if (!summoner?.puuid) return;

        const result = await window.api.getMatchHistory(summoner.puuid, 20);
        
        if (result.success) {
            appState.update({
                matches: result.matches || [],
                matchStats: result.stats
            });
        }
    }

    static async loadRankedStats() {
        const result = await window.api.getRankedStats();
        
        if (result.success) {
            appState.set('ranked', result.stats);
        }
    }
}

// ==================== UI MANAGER ====================

class UI {
    static updateConnectionStatus(connected, credentials = null) {
        this.updateStatusIndicator(connected);
        this.updateReconnectButton(connected);
        this.updateUserInfo(connected);
        this.updateSettingsStatus(connected, credentials);
    }

    static updateStatusIndicator(connected) {
        const elements = {
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText'),
            statusIndicator: document.getElementById('statusIndicator')
        };
        
        if (elements.statusDot) {
            elements.statusDot.className = 'status-dot' + (connected ? ' online' : '');
        }
        
        if (elements.statusText) {
            elements.statusText.textContent = connected ? 'Connected' : 'Disconnected';
        }
        
        if (elements.statusIndicator) {
            const color = connected ? 'var(--success)' : 'var(--error)';
            const shadow = connected ? 'var(--success-glow)' : 'var(--error-glow)';
            elements.statusIndicator.style.borderColor = color;
            elements.statusIndicator.style.boxShadow = `0 4px 12px ${shadow}`;
        }
    }

    static updateReconnectButton(connected) {
        const reconnectBtn = document.getElementById('reconnectBtn');
        
        if (reconnectBtn) {
            reconnectBtn.disabled = connected;
            reconnectBtn.style.opacity = connected ? '0.5' : '1';
        }
    }

    static updateUserInfo(connected) {
        const userInfo = document.getElementById('userInfo');
        
        if (userInfo) {
            userInfo.style.opacity = connected ? '1' : '0.4';
        }
    }

    static updateSettingsStatus(connected, credentials) {
        const settingsStatus = document.getElementById('settingsStatus');
        if (settingsStatus) {
            settingsStatus.textContent = connected ? '🟢 Connected' : '🔴 Disconnected';
            settingsStatus.style.color = connected ? 'var(--success)' : 'var(--error)';
        }
        
        const settingsPort = document.getElementById('settingsPort');
        if (settingsPort && credentials) {
            settingsPort.textContent = credentials.port || '—';
        }
        
        const settingsLastCheck = document.getElementById('settingsLastCheck');
        if (settingsLastCheck) {
            settingsLastCheck.textContent = new Date().toLocaleTimeString();
        }
    }

    static showConnectionWarning() {
        const warning = document.getElementById('connectionWarning');
        if (warning) {
            warning.style.display = 'flex';
            warning.style.animation = 'slideDown 0.3s ease';
        }
    }

    static hideConnectionWarning() {
        const warning = document.getElementById('connectionWarning');
        if (warning) {
            warning.style.display = 'none';
        }
    }

    static clearUserData() {
        const defaultValues = {
            summonerName: '—',
            level: '—',
            region: '—',
            rank: '—',
            gameVersion: '—',
            platform: '—',
            clientRegion: '—',
            locale: '—'
        };
        
        Object.entries(defaultValues).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    static updateSummonerDisplay() {
        const summoner = appState.get('summoner');
        const ranked = appState.get('ranked');
        
        if (!summoner) {
            console.warn('[UI] No summoner data available');
            return;
        }
        
        console.log('[UI] Updating summoner display:', summoner);
        
        // Extract region from various possible formats
        let regionDisplay = this.extractRegion(summoner);
        
        const elements = {
            summonerName: `${summoner.gameName}#${summoner.tagLine}`,
            level: summoner.summonerLevel,
            region: regionDisplay
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = value;
                console.log(`[UI] Updated ${id}:`, value);
            }
        });
        
        // Update rank
        if (ranked?.solo) {
            const rankEl = document.getElementById('rank');
            if (rankEl) {
                rankEl.textContent = ranked.solo.rankDisplay || 'Unranked';
            }
        }
    }

    static extractRegion(summoner) {
        console.log('[UI] === EXTRACTING REGION ===');
        console.log('[UI] Summoner.region:', summoner.region);
        
        // Direct string check
        if (summoner.region && typeof summoner.region === 'string') {
            const result = summoner.region.toUpperCase();
            console.log('[UI] ✓ Found region:', result);
            return result;
        }
        
        // If object, try to extract
        if (summoner.region && typeof summoner.region === 'object') {
            const possibleValues = [
                summoner.region.webRegion,
                summoner.region.region,
                summoner.region.platformId
            ];
            
            for (const value of possibleValues) {
                if (value && typeof value === 'string') {
                    const result = value.toUpperCase();
                    console.log('[UI] ✓ Found region from object:', result);
                    return result;
                }
            }
        }
        
        // Try platformId as fallback
        if (summoner.platformId && typeof summoner.platformId === 'string') {
            const result = summoner.platformId.toUpperCase();
            console.log('[UI] ✓ Using platformId:', result);
            return result;
        }
        
        console.log('[UI] ✗ No region found, using default: BR');
        return 'BR'; // Default to BR instead of Unknown
    }

    static updateFeatureToggles() {
        const features = appState.get('features');
        
        const toggles = {
            autoAccept: features.autoAccept,
            instalock: features.autoPick?.enabled,
            autoBan: features.autoBan?.enabled,
            appearOffline: features.appearOffline,
            disconnectChat: features.chatDisconnected
        };
        
        Object.entries(toggles).forEach(([id, enabled]) => {
            const toggle = document.getElementById(id);
            if (toggle) toggle.checked = enabled;
        });
        
        if (features.autoPick?.champion) {
            this.updateChampionDisplay('instalock', features.autoPick.champion);
        }
        
        if (features.autoBan?.champion) {
            this.updateChampionDisplay('autoBan', features.autoBan.champion);
        }
        
        const protectBan = document.getElementById('protectBan');
        if (protectBan) {
            protectBan.checked = features.autoBan?.protect !== false;
        }

        this.updateAutoBanMode(features.autoBan?.enabled, features.autoBan?.champion);
        this.updateAppearOfflineUI(features.appearOffline, features.appearOfflineActive);
    }

    static updateAppearOfflineUI(desiredEnabled, activeEnabled) {
        const desired = Boolean(desiredEnabled);
        const active = Boolean(activeEnabled);

        const statusEl = document.getElementById('appearOfflineStatus');
        const restartBtn = document.getElementById('appearOfflineRestartBtn');

        const pending = desired !== active;

        if (statusEl) {
            let text = active ? 'Appearing Offline' : 'Online';
            if (pending) {
                text += desired ? ' (restart required)' : ' (pending disable)';
            }
            statusEl.textContent = text;
        }

        if (restartBtn) {
            restartBtn.disabled = !pending;
            if (pending) {
                restartBtn.textContent = desired ? 'Restart game to enable' : 'Restart game to disable';
            } else {
                restartBtn.textContent = 'Restart game to apply';
            }
        }
    }

    static updateAutoBanMode(enabled, champion) {
        const normalized = (champion ?? '').toString().trim();
        const isNoneBan = normalized.length === 0 || normalized.toLowerCase() === 'none';
        const hideProtect = Boolean(enabled && isNoneBan);

        const protectInput = document.getElementById('protectBan');
        const protectContainer = protectInput?.closest('label');

        if (protectContainer) protectContainer.style.display = hideProtect ? 'none' : '';
        if (protectInput) protectInput.disabled = hideProtect;

        if (enabled && isNoneBan) {
            const current = document.getElementById('autoBanCurrent');
            if (current) current.textContent = 'Not banning any champion';
        }
    }

    static updateChampionDisplay(type, champion) {
        const input = document.getElementById(`${type}Champ`);
        if (input) input.value = champion;
        
        const current = document.getElementById(`${type}Current`);
        if (current) current.textContent = champion;
    }

    static showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Add icon based on type
        const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';
        notification.innerHTML = `<span style="margin-right: 8px; font-weight: bold;">${icon}</span>${message}`;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// ==================== EVENT HANDLER ====================

class EventHandler {
    static setupAll() {
        this.setupFeatureToggles();
        this.setupChampionInputs();
        this.setupKeyboardShortcuts();
    }

    static setupFeatureToggles() {
        const toggleHandlers = {
            autoAccept: () => FeatureController.toggleAutoAccept(),
            instalock: () => FeatureController.toggleAutoPick(),
            autoBan: () => FeatureController.toggleAutoBan(),
            appearOffline: () => FeatureController.toggleAppearOffline(),
            disconnectChat: () => FeatureController.toggleChat()
        };

        Object.entries(toggleHandlers).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', handler);
            }
        });
    }

    static setupChampionInputs() {
        const inputs = ['instalockChamp', 'autoBanChamp'];
        
        inputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.handleChampionInput(inputId);
                    }
                });
            }
        });
    }

    static setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + R - Refresh
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                SystemController.reconnectLCU();
            }
            
            // Ctrl/Cmd + 1/2 - Switch views
            if ((e.ctrlKey || e.metaKey) && e.key === '1') {
                e.preventDefault();
                ViewController.switchView('dashboard');
            }
            if ((e.ctrlKey || e.metaKey) && e.key === '2') {
                e.preventDefault();
                ViewController.switchView('settings');
            }
        });
    }

    static handleChampionInput(inputId) {
        if (inputId === 'instalockChamp') {
            const toggle = document.getElementById('instalock');
            const champion = document.getElementById('instalockChamp')?.value?.trim();
            if (toggle && champion && !toggle.checked) toggle.checked = true;
            FeatureController.toggleAutoPick();
        } else if (inputId === 'autoBanChamp') {
            const toggle = document.getElementById('autoBan');
            const champion = document.getElementById('autoBanChamp')?.value?.trim();
            if (toggle && champion && !toggle.checked) toggle.checked = true;
            FeatureController.toggleAutoBan();
        }
    }
}

// ==================== UPDATE CONTROLLER ====================

class UpdateController {
    static async checkForUpdates() {
        if (!Environment.isElectron()) {
            UI.showNotification('Updates only available in Electron mode', 'error');
            return;
        }

        const btn = document.getElementById('checkUpdateBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Checking...';
        }

        try {
            await window.api.checkForUpdates();
            UI.showNotification('Checking for updates...', 'info');
        } catch (error) {
            console.error('[Update] Check error:', error);
            UI.showNotification('Failed to check for updates', 'error');
        } finally {
            setTimeout(() => {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Check for Updates';
                }
            }, 2000);
        }
    }

    static async installUpdate() {
        if (!Environment.isElectron()) return;

        if (!confirm('Install update and restart application?')) return;

        try {
            UI.showNotification('Installing update...', 'info');
            await window.api.quitAndInstall();
        } catch (error) {
            console.error('[Update] Install error:', error);
            UI.showNotification('Failed to install update', 'error');
        }
    }

    static async toggleAutoDownload() {
        if (!Environment.isElectron()) return;

        const enabled = document.getElementById('autoDownloadUpdates').checked;
        
        try {
            await window.api.setUpdateConfig({ autoDownload: enabled });
            UI.showNotification(`Auto-download ${enabled ? 'enabled' : 'disabled'}`, 'success');
        } catch (error) {
            console.error('[Update] Config error:', error);
        }
    }

    static async toggleAutoInstall() {
        if (!Environment.isElectron()) return;

        const enabled = document.getElementById('autoInstallUpdates').checked;
        
        try {
            await window.api.setUpdateConfig({ autoInstallOnAppQuit: enabled });
            UI.showNotification(`Auto-install ${enabled ? 'enabled' : 'disabled'}`, 'success');
        } catch (error) {
            console.error('[Update] Config error:', error);
        }
    }

    static updateUI(status) {
        // Current Version
        const currentVersion = document.getElementById('currentVersion');
        if (currentVersion) {
            currentVersion.textContent = status.currentVersion || '—';
        }

        // Status Text
        const statusText = document.getElementById('updateStatusText');
        if (statusText) {
            if (status.checking) {
                statusText.textContent = '🔍 Checking...';
                statusText.style.color = 'var(--text-secondary)';
            } else if (status.downloading) {
                statusText.textContent = '📥 Downloading...';
                statusText.style.color = 'var(--accent)';
            } else if (status.downloaded) {
                statusText.textContent = '✅ Ready to install';
                statusText.style.color = 'var(--success)';
            } else if (status.available) {
                statusText.textContent = '🆕 Update available';
                statusText.style.color = 'var(--warning)';
            } else if (status.error) {
                statusText.textContent = `❌ ${status.error}`;
                statusText.style.color = 'var(--error)';
            } else {
                statusText.textContent = '✅ Up to date';
                statusText.style.color = 'var(--success)';
            }
        }

        // Latest Version
        const latestVersion = document.getElementById('latestVersion');
        if (latestVersion) {
            latestVersion.textContent = status.version || '—';
        }

        // Progress Bar
        const progressContainer = document.getElementById('updateProgress');
        const progressBar = document.getElementById('updateProgressBar');
        const progressText = document.getElementById('updateProgressText');

        if (progressContainer && progressBar && progressText) {
            if (status.downloading) {
                progressContainer.style.display = 'block';
                progressBar.style.width = `${status.progress}%`;
                progressText.textContent = `${status.progress}%`;
            } else {
                progressContainer.style.display = 'none';
            }
        }

        // Install Button
        const installBtn = document.getElementById('installUpdateBtn');
        if (installBtn) {
            installBtn.style.display = status.downloaded ? 'block' : 'none';
        }
    }

    static async loadInitialStatus() {
        if (!Environment.isElectron()) return;

        try {
            const result = await window.api.getUpdateStatus();
            if (result.success) {
                this.updateUI(result.status);
            }
        } catch (error) {
            console.error('[Update] Failed to load status:', error);
        }
    }
}


// ==================== FEATURE CONTROLLER ====================

class FeatureController {
    static async toggleAutoAccept() {
        if (!this.checkConnection()) return;

        const enabled = document.getElementById('autoAccept').checked;
        
        try {
            const result = await window.api.toggleAutoAccept(enabled);
            
            if (result.success) {
                appState.setFeature('autoAccept', enabled);
                UI.showNotification(`Auto Accept ${enabled ? 'enabled' : 'disabled'}`, 'success');
            } else {
                this.handleError('autoAccept', enabled, result.error);
            }
        } catch (error) {
            console.error('[Feature] Toggle Auto Accept error:', error);
            UI.showNotification('Failed to toggle Auto Accept', 'error');
            this.revertToggle('autoAccept', enabled);
        }
    }

    static async toggleAutoPick() {
        if (!this.checkConnection()) {
            document.getElementById('instalock').checked = false;
            return;
        }

        const enabled = document.getElementById('instalock').checked;
        const champion = document.getElementById('instalockChamp').value.trim();
        
        if (enabled && !champion) {
            UI.showNotification('Please enter a champion name', 'error');
            document.getElementById('instalock').checked = false;
            return;
        }
        
        try {
            const result = await window.api.setAutoPick(champion, enabled);
            
            if (result.success) {
                const resolvedChampion = result.champion ?? champion;
                appState.setFeature('autoPick', { enabled, champion: resolvedChampion });
                UI.updateChampionDisplay('instalock', enabled ? resolvedChampion : 'None');
                UI.showNotification(`Auto Pick ${enabled ? 'enabled for ' + resolvedChampion : 'disabled'}`, 'success');
            } else {
                this.handleError('instalock', enabled, result.error);
            }
        } catch (error) {
            console.error('[Feature] Toggle Auto Pick error:', error);
            UI.showNotification('Failed to toggle Auto Pick', 'error');
            this.revertToggle('instalock', enabled);
        }
    }

    static async toggleAutoBan() {
        if (!this.checkConnection()) {
            document.getElementById('autoBan').checked = false;
            return;
        }

        const enabled = document.getElementById('autoBan').checked;
        const championInput = document.getElementById('autoBanChamp').value.trim();
        const champion = championInput || 'None';
        const protect = document.getElementById('protectBan').checked;

        try {
            const result = await window.api.setAutoBan(champion, enabled, protect);
            
            if (result.success) {
                const resolvedChampion = result.champion ?? champion;
                appState.setFeature('autoBan', { enabled, champion: resolvedChampion, protect });
                UI.updateChampionDisplay('autoBan', enabled ? resolvedChampion : 'None');
                UI.updateAutoBanMode(enabled, resolvedChampion);

                const isNoneBan = resolvedChampion.toString().trim().toLowerCase() === 'none';
                const message = enabled
                    ? (isNoneBan ? 'Auto Ban enabled (not banning any champion)' : `Auto Ban enabled for ${resolvedChampion}`)
                    : 'Auto Ban disabled';
                UI.showNotification(message, 'success');
            } else {
                this.handleError('autoBan', enabled, result.error);
            }
        } catch (error) {
            console.error('[Feature] Toggle Auto Ban error:', error);
            UI.showNotification('Failed to toggle Auto Ban', 'error');
            this.revertToggle('autoBan', enabled);
        }
    }

    static async toggleAppearOffline() {
        if (!Environment.isElectron()) {
            UI.showNotification('Feature only available in Electron mode', 'error');
            const toggle = document.getElementById('appearOffline');
            if (toggle) toggle.checked = false;
            return;
        }

        const enabled = document.getElementById('appearOffline').checked;

        try {
            const result = await window.api.setAppearOffline(enabled);

            if (result.success) {
                const desired = result.desiredOffline ?? enabled;
                const active = result.activeOffline ?? appState.getFeature('appearOfflineActive');

                appState.setFeature('appearOffline', desired);
                appState.setFeature('appearOfflineActive', active);
                UI.updateFeatureToggles();

                const pending = Boolean(result.pending ?? (desired !== active));
                UI.showNotification(
                    pending
                        ? `Appear Offline ${desired ? 'enabled' : 'disabled'} (restart to apply)`
                        : `Appear Offline ${desired ? 'enabled' : 'disabled'}`,
                    'success'
                );
            } else {
                this.handleError('appearOffline', enabled, result.error);
            }
        } catch (error) {
            console.error('[Feature] Toggle Appear Offline error:', error);
            UI.showNotification('Failed to toggle Appear Offline', 'error');
            this.revertToggle('appearOffline', enabled);
        }
    }

    static async applyAppearOffline() {
        if (!Environment.isElectron()) {
            UI.showNotification('Feature only available in Electron mode', 'error');
            return;
        }

        const features = appState.get('features');
        const desired = Boolean(features?.appearOffline);
        const active = Boolean(features?.appearOfflineActive);

        if (desired === active) {
            UI.showNotification('No Appear Offline changes to apply', 'info');
            return;
        }

        const confirmed = confirm(
            `Restart the Riot Client to ${desired ? 'enable' : 'disable'} Appear Offline now?`
        );
        if (!confirmed) return;

        const restartBtn = document.getElementById('appearOfflineRestartBtn');
        if (restartBtn) restartBtn.disabled = true;

        try {
            const result = await window.api.applyAppearOffline();
            if (result.success) {
                const nextDesired = result.desiredOffline ?? desired;
                const nextActive = result.activeOffline ?? nextDesired;

                appState.setFeature('appearOffline', nextDesired);
                appState.setFeature('appearOfflineActive', nextActive);
                UI.updateFeatureToggles();
                UI.showNotification(result.message || 'Riot Client restarting...', 'success');
            } else {
                UI.showNotification(`Failed: ${result.error}`, 'error');
                UI.updateFeatureToggles();
            }
        } catch (error) {
            console.error('[Feature] Apply Appear Offline error:', error);
            UI.showNotification('Failed to apply Appear Offline', 'error');
            UI.updateFeatureToggles();
        }
    }

    static async toggleChat() {
        if (!this.checkConnection()) {
            document.getElementById('disconnectChat').checked = false;
            return;
        }

        const disconnect = document.getElementById('disconnectChat').checked;
        
        try {
            const result = await window.api.toggleChat(disconnect);
            
            if (result.success) {
                appState.setFeature('chatDisconnected', disconnect);
                UI.showNotification(`Chat ${disconnect ? 'disconnected' : 'connected'}`, 'success');
            } else {
                this.handleError('disconnectChat', disconnect, result.error);
            }
        } catch (error) {
            console.error('[Feature] Toggle Chat error:', error);
            UI.showNotification('Failed to toggle Chat', 'error');
            this.revertToggle('disconnectChat', disconnect);
        }
    }

    static checkConnection() {
        if (!Environment.isElectron()) {
            UI.showNotification('Feature only available in Electron mode', 'error');
            return false;
        }
        
        if (!appState.get('connected')) {
            UI.showNotification('Please connect to League Client first', 'error');
            return false;
        }
        
        return true;
    }

    static handleError(toggleId, enabled, error) {
        UI.showNotification(`Failed: ${error}`, 'error');
        this.revertToggle(toggleId, enabled);
    }

    static revertToggle(toggleId, enabled) {
        const toggle = document.getElementById(toggleId);
        if (toggle) toggle.checked = !enabled;
    }
}

// ==================== PROFILE CONTROLLER ====================

class ProfileController {
    static async changeIcon() {
        if (!this.checkConnection()) return;
        
        const iconId = document.getElementById('iconId').value;
        if (!iconId) {
            UI.showNotification('Please enter an icon ID', 'error');
            return;
        }
        
        const iconIdNum = parseInt(iconId);
        if (isNaN(iconIdNum) || iconIdNum < 1 || iconIdNum > 5000) {
            UI.showNotification('Please enter a valid icon ID (1-5000)', 'error');
            return;
        }
        
        const btn = document.querySelector('#iconId').closest('.feature-card').querySelector('.btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Changing...';
        }
        
        try {
            console.log(`[Profile] Changing icon to: ${iconIdNum}`);
            const result = await window.api.changeIcon(iconIdNum);
            
            console.log('[Profile] Change icon result:', result);
            
            if (result.success) {
                UI.showNotification(`Icon changed to ${iconIdNum}!`, 'success');
                document.getElementById('iconId').value = '';
                
                // Reload summoner data to update icon display
                setTimeout(() => DataLoader.loadSummonerData(), 800);
            } else {
                UI.showNotification(`Failed: ${result.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('[Profile] Change icon error:', error);
            UI.showNotification('Failed to change icon', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Apply Icon';
            }
        }
    }

    static async changeBackground() {
        if (!this.checkConnection()) return;
        
        const skinId = document.getElementById('skinId').value;
        if (!skinId) {
            UI.showNotification('Please enter a skin ID', 'error');
            return;
        }
        
        const skinIdNum = parseInt(skinId);
        if (isNaN(skinIdNum)) {
            UI.showNotification('Please enter a valid number', 'error');
            return;
        }
        
        const btn = document.querySelector('#skinId').closest('.feature-card').querySelector('.btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Changing...';
        }
        
        try {
            console.log(`[Profile] Changing background to skin ID: ${skinIdNum}`);
            const result = await window.api.changeBackground(skinIdNum);
            
            console.log('[Profile] Change background result:', result);
            
            if (result.success) {
                document.getElementById('skinId').value = '';
                
                // Ask if user wants to restart client to see changes
                if (confirm('Background changed! Restart client now to see changes?')) {
                    UI.showNotification('Restarting client...', 'success');
                    setTimeout(async () => {
                        await window.api.restartClient();
                    }, 1000);
                } else {
                    UI.showNotification('Background changed! Restart client to see changes.', 'success');
                }
            } else {
                // Show error with suggestions
                const errorMsg = result.error || 'Unknown error';
                UI.showNotification(`Failed: ${errorMsg}`, 'error');
                
                if (errorMsg.includes('Invalid skin ID')) {
                    console.log('💡 Try these working IDs:');
                    console.log('  Ezreal Striker: 81001');
                    console.log('  Yasuo High Noon: 157001');
                    console.log('  Ahri K/DA: 103015');
                    console.log('  Type window.showPopularSkins() to see all');
                    
                    setTimeout(() => {
                        UI.showNotification('Check console for valid Skin IDs', 'info');
                    }, 500);
                }
            }
        } catch (error) {
            console.error('[Profile] Change background error:', error);
            UI.showNotification('Failed to change background', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Apply Background';
            }
        }
    }

    static async changeRiotId() {
        if (!this.checkConnection()) return;
        
        const gameName = document.getElementById('newName').value.trim();
        const tagLine = document.getElementById('newTag').value.trim();
        
        if (!gameName || !tagLine) {
            UI.showNotification('Please enter both name and tag', 'error');
            return;
        }
        
        const result = await this.executeProfileAction(
            () => window.api.changeRiotId(gameName, tagLine),
            'Riot ID changed successfully',
            ['newName', 'newTag']
        );
        
        if (result) {
            setTimeout(() => DataLoader.loadAll(), 1000);
        }
    }

    static async changeStatus() {
        if (!this.checkConnection()) return;
        
        const status = document.getElementById('statusMessage').value;
        
        await this.executeProfileAction(
            () => window.api.changeStatus(status),
            'Status updated successfully'
        );
    }

    static async removeBadges() {
        if (!this.checkConnection()) return;
        
        if (!confirm('Remove all challenge badges from your profile?')) return;
        
        await this.executeProfileAction(
            () => window.api.removeBadges(),
            'All badges removed successfully'
        );
    }

    static async executeProfileAction(apiCall, successMessage, clearInputs = null) {
        try {
            const result = await apiCall();
            
            if (result.success) {
                UI.showNotification(successMessage, 'success');
                
                if (clearInputs) {
                    const inputs = Array.isArray(clearInputs) ? clearInputs : [clearInputs];
                    inputs.forEach(id => {
                        const input = document.getElementById(id);
                        if (input) input.value = '';
                    });
                }
                
                return true;
            } else {
                UI.showNotification(`Failed: ${result.error}`, 'error');
                return false;
            }
        } catch (error) {
            console.error('[Profile] Action error:', error);
            UI.showNotification('Failed to execute action', 'error');
            return false;
        }
    }

    static checkConnection() {
        if (!Environment.isElectron()) {
            UI.showNotification('Feature only available in Electron mode', 'error');
            return false;
        }
        
        if (!appState.get('connected')) {
            UI.showNotification('Please connect to League Client first', 'error');
            return false;
        }
        
        return true;
    }
}

// ==================== GAME CONTROLLER ====================

class GameController {
    static async revealLobby() {
        if (!this.checkConnection()) return;
        
        try {
            const result = await window.api.revealLobby();
            
            if (result.success) {
                UI.showNotification('Opening Porofessor...', 'success');
            } else {
                UI.showNotification(`Failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('[Game] Reveal lobby error:', error);
            UI.showNotification('Failed to reveal lobby', 'error');
        }
    }

    static async dodgeGame() {
        if (!this.checkConnection()) return;
        
        if (!confirm('Are you sure you want to dodge? You will receive a penalty.')) return;
        
        await this.executeGameAction(
            () => window.api.dodge(),
            'Game dodged successfully'
        );
    }

    static async removeAllFriends() {
        if (!this.checkConnection()) return;
        
        if (!confirm('Are you sure you want to remove ALL friends? This cannot be undone.')) return;
        
        try {
            const result = await window.api.removeFriends();
            
            if (result.success) {
                UI.showNotification(`Removed ${result.removed || 0} friends`, 'success');
            } else {
                UI.showNotification(`Failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('[Game] Remove friends error:', error);
            UI.showNotification('Failed to remove friends', 'error');
        }
    }

    static async restartClient() {
        if (!this.checkConnection()) return;
        
        if (!confirm('Restart League Client?')) return;
        
        await this.executeGameAction(
            () => window.api.restartClient(),
            'Client restarting...'
        );
    }

    static async executeGameAction(apiCall, successMessage) {
        try {
            const result = await apiCall();
            
            if (result.success) {
                UI.showNotification(successMessage, 'success');
            } else {
                UI.showNotification(`Failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('[Game] Action error:', error);
            UI.showNotification('Failed to execute action', 'error');
        }
    }

    static checkConnection() {
        if (!Environment.isElectron()) {
            UI.showNotification('Feature only available in Electron mode', 'error');
            return false;
        }
        
        if (!appState.get('connected')) {
            UI.showNotification('Please connect to League Client first', 'error');
            return false;
        }
        
        return true;
    }
}

// ==================== SYSTEM CONTROLLER ====================

class SystemController {
    static async reconnectLCU() {
        if (!Environment.isElectron()) {
            UI.showNotification('Feature only available in Electron mode', 'error');
            return;
        }
        
        const btn = document.getElementById('reconnectBtn');
        const text = document.getElementById('reconnectText');
        
        if (!btn || !text) return;
        
        btn.disabled = true;
        btn.classList.add('loading');
        text.textContent = 'Reconnecting...';
        
        try {
            const result = await window.api.refreshData();
            
            if (result.success) {
                UI.showNotification('Reconnected successfully', 'success');
                await app.checkLCUStatus();
            } else {
                UI.showNotification(`Failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('[System] Reconnect error:', error);
            UI.showNotification('Failed to reconnect', 'error');
        } finally {
            setTimeout(() => {
                btn.disabled = appState.get('connected');
                btn.classList.remove('loading');
                text.textContent = 'Reconnect';
            }, 2000);
        }
    }

    static async clearCache() {
        if (!Environment.isElectron()) {
            UI.showNotification('Feature only available in Electron mode', 'error');
            return;
        }
        
        try {
            const result = await window.api.clearCache();
            
            if (result.success) {
                UI.showNotification('Cache cleared successfully', 'success');
                await DataLoader.loadAll();
            }
        } catch (error) {
            console.error('[System] Clear cache error:', error);
            UI.showNotification('Failed to clear cache', 'error');
        }
    }

    static openClientLogs() {
        if (!Environment.isElectron()) {
            UI.showNotification('Feature only available in Electron mode', 'error');
            return;
        }
        
        window.api.openClientLogs();
    }

    static openAppData() {
        if (!Environment.isElectron()) {
            UI.showNotification('Feature only available in Electron mode', 'error');
            return;
        }
        
        window.api.openAppData();
    }

    static async loadClientInfo() {
        if (!Environment.isElectron()) return;
        if (!appState.get('connected')) return;
        
        try {
            const result = await window.api.getClientInfo();
            
            if (result.success) {
                const { version, platform, region } = result;
                
                const updates = {
                    gameVersion: version || 'Unknown',
                    platform: platform || 'Unknown',
                    clientRegion: region?.region || 'Unknown',
                    locale: region?.locale || 'Unknown'
                };
                
                Object.entries(updates).forEach(([id, value]) => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = value;
                });
            }
        } catch (error) {
            console.error('[System] Load client info error:', error);
        }
    }
}

// ==================== VIEW CONTROLLER ====================

class ViewController {
    static switchView(viewName) {
        console.log(`[View] Switching to: ${viewName}`);
        
        appState.set('currentView', viewName);
        
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });
        
        // Update content views
        document.querySelectorAll('.view-content').forEach(view => {
            view.classList.toggle('active', view.id === `view-${viewName}`);
        });
        
        // Load data for specific views
        if (viewName === 'settings') {
            SystemController.loadClientInfo();
            UpdateController.loadInitialStatus(); // ← ADICIONAR ESTA LINHA
            UI.updateConnectionStatus(appState.get('connected'));
        }
    }
}

// ==================== POPULAR SKIN IDS ====================

const PopularSkins = {
    // Ezreal
    'Ezreal Striker': 81001,
    'Ezreal Frosted': 81002,
    'Ezreal Pulsefire': 81013,
    
    // Yasuo
    'Yasuo High Noon': 157001,
    'Yasuo PROJECT': 157002,
    'Yasuo Spirit Blossom': 157027,
    
    // Ahri
    'Ahri Dynasty': 103002,
    'Ahri K/DA': 103015,
    
    // Jinx
    'Jinx Mafia': 222001,
    'Jinx Star Guardian': 222003,
    
    // Lux
    'Lux Elementalist': 99007,
    'Lux Battle Academia': 99027,
    
    // Zed
    'Zed Shockblade': 238001,
    'Zed PROJECT': 238002,
    
    // Pyke
    'Pyke Blood Moon': 555001,
    'Pyke PROJECT': 555002,
    
    // Akali
    'Akali Blood Moon': 84003,
    'Akali K/DA': 84014,
    
    // Yone
    'Yone Spirit Blossom': 777001,
    'Yone Battle Academia': 777002
};

// Add to window for HTML access
window.PopularSkins = PopularSkins;
window.fillSkinId = (skinId) => {
    const input = document.getElementById('skinId');
    if (input) input.value = skinId;
};

// Helper to show popular skins in console
window.showPopularSkins = () => {
    console.log('🎨 Popular Skin IDs:');
    Object.entries(PopularSkins).forEach(([name, id]) => {
        console.log(`  ${name}: ${id}`);
    });
};

let app;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Main] DOM Content Loaded');
    app = new Application();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (app) {
        app.destroy();
    }
});




// ==================== GLOBAL EXPORTS FOR HTML HANDLERS ====================

window.switchView = (view) => ViewController.switchView(view);
window.reconnectLCU = () => SystemController.reconnectLCU();
window.changeIcon = () => ProfileController.changeIcon();
window.changeBackground = () => ProfileController.changeBackground();
window.changeRiotId = () => ProfileController.changeRiotId();
window.changeStatus = () => ProfileController.changeStatus();
window.removeBadges = () => ProfileController.removeBadges();
window.revealLobby = () => GameController.revealLobby();
window.dodgeGame = () => GameController.dodgeGame();
window.removeAllFriends = () => GameController.removeAllFriends();
window.restartClient = () => GameController.restartClient();
window.clearCache = () => SystemController.clearCache();
window.openClientLogs = () => SystemController.openClientLogs();
window.openAppData = () => SystemController.openAppData();
window.forceReconnect = () => SystemController.reconnectLCU();
window.loadClientInfo = () => SystemController.loadClientInfo();
window.updateConnectionStatus = () => app?.checkLCUStatus();
window.applyAppearOffline = () => FeatureController.applyAppearOffline();


// Update functions
window.checkForUpdates = () => UpdateController.checkForUpdates();
window.installUpdate = () => UpdateController.installUpdate();
window.toggleAutoDownload = () => UpdateController.toggleAutoDownload();
window.toggleAutoInstall = () => UpdateController.toggleAutoInstall();

// ==================== DEBUG UTILITIES ====================

if (Environment.isDevelopment()) {
    window.debug = {
        state: () => appState.get(),
        connected: () => appState.get('connected'),
        summoner: () => appState.get('summoner'),
        ranked: () => appState.get('ranked'),
        features: () => appState.get('features'),
        reset: () => appState.reset(),
        mock: () => {
            appState.update({
                connected: true,
                summoner: MockData.summoner,
                ranked: MockData.ranked
            });
            UI.updateConnectionStatus(true, MockData.credentials);
            UI.updateSummonerDisplay();
        }
    };
    
    console.log('[Debug] Utilities available via window.debug');
}
