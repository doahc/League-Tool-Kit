const LogThrottle = require('../utils/LogThrottle');

/**
 * Feature Service - Refactored
 * Clean, modular architecture with separation of concerns
 */
class FeatureService {
    constructor(lcuService) {
        this.lcu = lcuService;
        this.logThrottle = new LogThrottle(5000);
        
        this.state = this.initializeState();
        this.championData = this.initializeChampionData();
        this.intervals = {};
        this.throttles = {};
        
        this.setupEventListeners();
    }

    // ==================== INITIALIZATION ====================

    initializeState() {
        return {
            autoAccept: { 
                enabled: false,
                lastAccepted: 0
            },
            autoPick: { 
                enabled: false,
                champion: null,
                championId: null,
                currentSession: null,
                hasShownIntent: false,
                hasLocked: false
            },
            autoBan: { 
                enabled: false,
                champion: null,
                championId: null,
                currentSession: null,
                hasBanned: false,
                protectBan: true
            },
            chatDisconnected: false
        };
    }

    initializeChampionData() {
        return {
            list: null,
            idToName: null,
            owned: null
        };
    }

    setupEventListeners() {
        this.lcu.on('onConnect', () => this.handleConnect());
        this.lcu.on('onDisconnect', () => this.handleDisconnect());
    }

    async handleConnect() {
        console.log('[Feature] LCU Connected - Initializing...');
        await this.loadAllChampionData();
        this.restartActiveFeatures();
    }

    handleDisconnect() {
        console.log('[Feature] LCU Disconnected - Resetting states');
        this.resetSessionStates();
    }

    resetSessionStates() {
        this.state.autoPick.currentSession = null;
        this.state.autoPick.hasShownIntent = false;
        this.state.autoPick.hasLocked = false;
        this.state.autoBan.currentSession = null;
        this.state.autoBan.hasBanned = false;
    }

    restartActiveFeatures() {
        if (this.state.autoAccept.enabled) this.startAutoAccept();
        if (this.state.autoPick.enabled) this.startAutoPick();
        if (this.state.autoBan.enabled) this.startAutoBan();
    }

    // ==================== CHAMPION DATA MANAGEMENT ====================

    async loadAllChampionData() {
        if (this.championData.list) return true;

        try {
            const champions = await this.fetchChampionsFromEndpoints();
            
            if (!champions || champions.length === 0) {
                console.warn('[Feature] Using fallback champion list');
                this.loadFallbackChampions();
                return true;
            }

            this.processChampionData(champions);
            await this.loadOwnedChampions();
            
            console.log(`[Feature] ✓ Loaded ${champions.length} champions`);
            return true;
        } catch (error) {
            console.error('[Feature] Failed to load champions:', error.message);
            this.loadFallbackChampions();
            return false;
        }
    }

    async fetchChampionsFromEndpoints() {
        const endpoints = [
            '/lol-champions/v1/inventories/local/champions',
            '/lol-champ-select/v1/all-grid-champions',
            '/lol-champions/v1/owned-champions-minimal'
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.lcu.get(endpoint);
                
                if (this.isValidChampionResponse(response)) {
                    console.log(`[Feature] ✓ Loaded from ${endpoint}`);
                    return response.data;
                }
            } catch (error) {
                console.log(`[Feature] Failed ${endpoint}, trying next...`);
            }
        }

        return null;
    }

    isValidChampionResponse(response) {
        return response.status === 200 && 
               response.data && 
               Array.isArray(response.data) && 
               response.data.length > 0;
    }

    processChampionData(champions) {
        this.championData.list = {};
        this.championData.idToName = {};
        
        champions.forEach(champ => {
            const { id, name, alias } = champ;
            const championName = name || alias;
            
            if (!id || !championName) return;
            
            this.championData.idToName[id] = championName;
            this.mapChampionNameFormats(championName, id);
        });
    }

    mapChampionNameFormats(name, id) {
        const formats = this.generateNameFormats(name);
        formats.forEach(format => {
            this.championData.list[format] = id;
        });
    }

    generateNameFormats(name) {
        return [
            name,
            name.toLowerCase(),
            name.toLowerCase().replace(/\s+/g, ''),
            name.toLowerCase().replace(/[^a-z]/g, ''),
            name.toLowerCase().replace(/'/g, ''),
            name.toLowerCase().replace(/\./g, '')
        ];
    }

    loadFallbackChampions() {
        const fallbackData = {
            'Yasuo': 157, 'Yone': 777, 'Zed': 238, 'Akali': 84, 'Lee Sin': 64,
            'Thresh': 412, 'Blitzcrank': 53, 'Pyke': 555, 'Nautilus': 111,
            'Jinx': 222, 'Caitlyn': 51, 'Vayne': 67, 'Kai\'Sa': 145, 'Ezreal': 81,
            'Darius': 122, 'Garen': 86, 'Sett': 875, 'Mordekaiser': 82,
            'Lux': 99, 'Ahri': 103, 'Katarina': 55, 'Fizz': 105,
            'Riven': 92, 'Fiora': 114, 'Camille': 164, 'Irelia': 39,
            'Jhin': 202, 'Aphelios': 523, 'Draven': 119, 'Lucian': 236,
            'Sylas': 517, 'Ekko': 245, 'Diana': 131, 'Qiyana': 246
        };

        this.championData.list = {};
        this.championData.idToName = {};

        Object.entries(fallbackData).forEach(([name, id]) => {
            this.championData.idToName[id] = name;
            this.mapChampionNameFormats(name, id);
        });

        console.log('[Feature] ✓ Loaded fallback champion list');
    }

    async loadOwnedChampions() {
        try {
            const response = await this.lcu.get('/lol-champions/v1/owned-champions-minimal');
            
            if (response.status === 200 && response.data) {
                this.championData.owned = new Set(
                    response.data
                        .filter(champ => champ.ownership?.owned)
                        .map(champ => champ.id)
                );
                console.log(`[Feature] ✓ Loaded ${this.championData.owned.size} owned champions`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('[Feature] Failed to load owned champions:', error.message);
            return false;
        }
    }

    getChampionId(championName) {
        if (!this.championData.list || !championName) return null;
        
        const formats = this.generateNameFormats(championName);
        
        for (const format of formats) {
            const id = this.championData.list[format];
            if (id) {
                console.log(`[Champion] Found "${championName}" -> ID: ${id} (${this.championData.idToName[id]})`);
                return id;
            }
        }
        
        console.error(`[Champion] "${championName}" not found! Tried:`, formats);
        return null;
    }

    getChampionName(championId) {
        return this.championData.idToName[championId] || 'Unknown';
    }

    isChampionOwned(championId) {
        return this.championData.owned?.has(championId) ?? false;
    }

    // ==================== AUTO ACCEPT ====================

    async toggleAutoAccept(enabled) {
        console.log(`[AutoAccept] ${enabled ? 'ENABLING' : 'DISABLING'}`);
        
        this.state.autoAccept.enabled = enabled;
        enabled ? this.startAutoAccept() : this.stopAutoAccept();
        
        return { success: true, enabled };
    }

    startAutoAccept() {
        this.stopAutoAccept();
        console.log('[AutoAccept] Starting monitor...');
        
        this.intervals.autoAccept = setInterval(
            () => this.checkReadyCheck(),
            400
        );
    }

    async checkReadyCheck() {
        if (!this.state.autoAccept.enabled || !this.lcu.isConnected) return;

        try {
            const response = await this.lcu.get('/lol-matchmaking/v1/ready-check');
            
            if (this.shouldAcceptMatch(response)) {
                await this.acceptMatch();
            }
        } catch (error) {
            // Not in ready check - ignore
        }
    }

    shouldAcceptMatch(response) {
        if (response.status !== 200 || !response.data) return false;
        
        const { state, playerResponse } = response.data;
        const now = Date.now();
        const timeSinceLastAccept = now - this.state.autoAccept.lastAccepted;
        
        return state === 'InProgress' && 
               playerResponse !== 'Accepted' && 
               timeSinceLastAccept > 1000;
    }

    async acceptMatch() {
        await this.lcu.post('/lol-matchmaking/v1/ready-check/accept');
        this.state.autoAccept.lastAccepted = Date.now();
        console.log('[AutoAccept] ✅ MATCH ACCEPTED');
    }

    stopAutoAccept() {
        this.clearInterval('autoAccept');
    }

    // ==================== AUTO PICK ====================

    async setAutoPick(championName, enabled) {
        console.log(`[AutoPick] ${enabled ? 'ENABLING' : 'DISABLING'} - Champion: "${championName}"`);
        
        if (!enabled || !championName || championName === '99') {
            return this.disableAutoPick();
        }

        if (!this.championData.list) {
            await this.loadAllChampionData();
        }

        const championId = await this.validateChampionForPick(championName);
        if (!championId.success) {
            return championId;
        }

        this.configureAutoPick(championName, championId.id, enabled);
        
        if (enabled) {
            this.startAutoPick();
        }

        return { 
            success: true, 
            enabled, 
            champion: championName, 
            championId: championId.id 
        };
    }

    disableAutoPick() {
        this.state.autoPick = {
            enabled: false,
            champion: null,
            championId: null,
            currentSession: null,
            hasShownIntent: false,
            hasLocked: false
        };
        this.stopAutoPick();
        return { success: true, enabled: false };
    }

    async validateChampionForPick(championName) {
        if (championName.toLowerCase() === 'random') {
            return { success: true, id: null };
        }

        const championId = this.getChampionId(championName);
        
        if (!championId) {
            return { 
                success: false, 
                error: `Champion "${championName}" not found` 
            };
        }

        if (!this.isChampionOwned(championId)) {
            return { 
                success: false, 
                error: `You don't own ${championName}` 
            };
        }

        return { success: true, id: championId };
    }

    configureAutoPick(championName, championId, enabled) {
        this.state.autoPick = {
            enabled,
            champion: championName,
            championId,
            currentSession: null,
            hasShownIntent: false,
            hasLocked: false
        };
        
        console.log(`[AutoPick] ✓ Configured: ${championName} (ID: ${championId || 'RANDOM'})`);
    }

    startAutoPick() {
        this.stopAutoPick();
        console.log('[AutoPick] 🚀 Starting monitor...');
        
        this.intervals.autoPick = setInterval(
            () => this.checkChampionSelect('pick'),
            200
        );
    }

    async checkChampionSelect(actionType) {
        const stateKey = actionType === 'pick' ? 'autoPick' : 'autoBan';
        
        if (!this.state[stateKey].enabled || !this.lcu.isConnected) return;

        try {
            const response = await this.lcu.get('/lol-champ-select/v1/session');
            
            if (!this.isValidChampSelectSession(response)) return;

            const session = response.data;
            this.handleNewSession(session, stateKey);
            
            if (this.hasCompletedAction(stateKey)) return;

            await this.processChampionSelectActions(session, actionType, stateKey);
        } catch (error) {
            // Not in champ select - ignore
        }
    }

    isValidChampSelectSession(response) {
        if (response.status !== 200 || !response.data) return false;
        
        const { localPlayerCellId, actions } = response.data;
        return localPlayerCellId !== null && 
               localPlayerCellId !== undefined && 
               actions;
    }

    handleNewSession(session, stateKey) {
        const sessionId = session.timer?.internalNowInEpochMs || Date.now();
        
        if (this.state[stateKey].currentSession !== sessionId) {
            this.state[stateKey].currentSession = sessionId;
            this.state[stateKey].hasShownIntent = false;
            this.state[stateKey].hasLocked = false;
            this.state[stateKey].hasBanned = false;
            console.log(`[${stateKey === 'autoPick' ? 'AutoPick' : 'AutoBan'}] 🆕 NEW SESSION`);
        }
    }

    hasCompletedAction(stateKey) {
        return stateKey === 'autoPick' 
            ? this.state.autoPick.hasLocked 
            : this.state.autoBan.hasBanned;
    }

    async processChampionSelectActions(session, actionType, stateKey) {
        const myCell = session.localPlayerCellId;
        
        // Check ally protection for bans
        if (actionType === 'ban' && this.state.autoBan.protectBan) {
            if (this.shouldProtectAllyPick(session)) {
                this.state.autoBan.hasBanned = true;
                return;
            }
        }

        for (const actionGroup of session.actions) {
            if (!Array.isArray(actionGroup)) continue;
            
            for (const action of actionGroup) {
                if (this.isMyActiveAction(action, myCell, actionType)) {
                    await this.executeChampionAction(action, actionType, stateKey);
                    return;
                }
            }
        }
    }

    shouldProtectAllyPick(session) {
        if (!session.myTeam) return false;
        
        const allyIntents = session.myTeam
            .filter(player => player.championPickIntent > 0)
            .map(player => player.championPickIntent);
        
        if (allyIntents.includes(this.state.autoBan.championId)) {
            console.warn(`[AutoBan] ⚠️ Ally wants ${this.state.autoBan.champion} - SKIPPING`);
            return true;
        }
        
        return false;
    }

    isMyActiveAction(action, myCell, actionType) {
        return action.actorCellId === myCell && 
               action.type === actionType && 
               !action.completed && 
               action.isInProgress;
    }

    async executeChampionAction(action, actionType, stateKey) {
        const throttleKey = `${actionType}Attempt`;
        
        if (!this.checkThrottle(throttleKey, 300)) return;

        console.log(`[${actionType === 'pick' ? 'AutoPick' : 'AutoBan'}] 🎯 MY TURN!`);

        const championId = actionType === 'pick' 
            ? await this.selectPickChampion()
            : this.state.autoBan.championId;

        if (!championId) {
            console.error(`[${actionType === 'pick' ? 'AutoPick' : 'AutoBan'}] ❌ No champion ID`);
            return;
        }

        await this.lockChampion(action.id, championId, actionType, stateKey);
    }

    checkThrottle(key, delay) {
        const now = Date.now();
        
        if (this.throttles[key] && (now - this.throttles[key]) < delay) {
            return false;
        }
        
        this.throttles[key] = now;
        return true;
    }

    async selectPickChampion() {
        let championId = this.state.autoPick.championId;

        if (!championId && this.championData.owned?.size > 0) {
            const ownedArray = Array.from(this.championData.owned);
            championId = ownedArray[Math.floor(Math.random() * ownedArray.length)];
            console.log(`[AutoPick] 🎲 Random: ${this.getChampionName(championId)}`);
        }

        return championId;
    }

    async lockChampion(actionId, championId, actionType, stateKey) {
        try {
            const actionName = actionType === 'pick' ? 'Locking' : 'Banning';
            console.log(`[${actionType === 'pick' ? 'AutoPick' : 'AutoBan'}] 🔒 ${actionName} ${this.getChampionName(championId)}...`);
            
            const response = await this.lcu.patch(
                `/lol-champ-select/v1/session/actions/${actionId}`,
                { championId, completed: true }
            );

            if (response.status === 200 || response.status === 204) {
                const successKey = actionType === 'pick' ? 'hasLocked' : 'hasBanned';
                this.state[stateKey][successKey] = true;
                
                const action = actionType === 'pick' ? 'LOCKED' : 'BANNED';
                console.log(`[${actionType === 'pick' ? 'AutoPick' : 'AutoBan'}] ✅ ${action}: ${this.getChampionName(championId)}`);
            }
        } catch (error) {
            console.error(`[${actionType === 'pick' ? 'AutoPick' : 'AutoBan'}] ❌ Error:`, error.message);
        }
    }

    stopAutoPick() {
        this.clearInterval('autoPick');
    }

    // ==================== AUTO BAN ====================

    async setAutoBan(championName, enabled, protectBan = true) {
        console.log(`[AutoBan] ${enabled ? 'ENABLING' : 'DISABLING'} - Champion: "${championName}"`);
        
        if (!enabled || !championName || championName === '99') {
            return this.disableAutoBan();
        }

        if (!this.championData.list) {
            await this.loadAllChampionData();
        }

        const championId = this.getChampionId(championName);
        
        if (!championId) {
            return { 
                success: false, 
                error: `Champion "${championName}" not found` 
            };
        }

        this.configureAutoBan(championName, championId, enabled, protectBan);
        
        if (enabled) {
            this.startAutoBan();
        }

        return { 
            success: true, 
            enabled, 
            champion: championName, 
            championId, 
            protectBan 
        };
    }

    disableAutoBan() {
        this.state.autoBan = {
            enabled: false,
            champion: null,
            championId: null,
            currentSession: null,
            hasBanned: false,
            protectBan: true
        };
        this.stopAutoBan();
        return { success: true, enabled: false };
    }

    configureAutoBan(championName, championId, enabled, protectBan) {
        this.state.autoBan = {
            enabled,
            champion: championName,
            championId,
            protectBan,
            currentSession: null,
            hasBanned: false
        };
        
        console.log(`[AutoBan] ✓ Configured: ${championName} (ID: ${championId})`);
    }

    startAutoBan() {
        this.stopAutoBan();
        console.log('[AutoBan] 🚀 Starting monitor...');
        
        this.intervals.autoBan = setInterval(
            () => this.checkChampionSelect('ban'),
            200
        );
    }

    stopAutoBan() {
        this.clearInterval('autoBan');
    }

    // ==================== PROFILE & CHAT FEATURES ====================

    async toggleChat(disconnect) {
        if (!this.lcu.isConnected) {
            return { success: false, error: 'LCU not connected' };
        }

        try {
            const endpoint = disconnect ? '/chat/v1/suspend' : '/chat/v1/resume';
            const payload = disconnect ? { config: 'disable' } : undefined;
            
            await this.lcu.post(endpoint, payload);
            this.state.chatDisconnected = disconnect;
            
            return { success: true, disconnected: disconnect };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async changeProfileIcon(iconId) {
        return this.executeLCURequest(
            () => this.lcu.put('/lol-summoner/v1/current-summoner/icon', {
                profileIconId: parseInt(iconId)
            }),
            'Invalid icon ID'
        );
    }

    async changeBackground(skinId) {
        return this.executeLCURequest(
            () => this.lcu.post('/lol-summoner/v1/current-summoner/summoner-profile', {
                key: 'backgroundSkinId', value: parseInt(skinId)
            }),
            'Invalid skin ID'
        );
    }

    async changeRiotId(gameName, tagLine) {
        return this.executeLCURequest(
            () => this.lcu.post('/lol-summoner/v1/save-alias', { gameName, tagLine }),
            'Failed to change Riot ID'
        );
    }

    async changeStatus(statusMessage) {
        return this.executeLCURequest(
            () => this.lcu.put('/lol-chat/v1/me', { statusMessage }),
            'Failed to change status'
        );
    }

    async removeBadges() {
        return this.executeLCURequest(
            () => this.lcu.post('/lol-challenges/v1/update-player-preferences/', { 
                challengeIds: [] 
            }),
            'Failed to remove badges',
            [200, 204]
        );
    }

    // ==================== GAME ACTIONS ====================

    async revealLobby() {
        if (!this.lcu.isConnected) {
            return { success: false, error: 'LCU not connected' };
        }

        try {
            const session = await this.getChampSelectSession();
            if (!session) {
                return { success: false, error: 'Not in champion select' };
            }

            const region = await this.getRegion();
            const summonerNames = await this.getSummonerNames(session);

            if (summonerNames.length === 0) {
                return { success: false, error: 'No summoners found' };
            }

            const url = `https://porofessor.gg/pregame/${region}/${summonerNames.join(',')}/soloqueue/season`;
            return { success: true, url };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getChampSelectSession() {
        const response = await this.lcu.get('/lol-champ-select/v1/session');
        return (response.status === 200 && response.data) ? response.data : null;
    }

    async getRegion() {
        const response = await this.lcu.get('/riotclient/region-locale');
        return response.data?.webRegion || 'NA1';
    }

    async getSummonerNames(session) {
        const names = [];
        
        if (session.myTeam) {
            for (const player of session.myTeam) {
                if (player.summonerId && player.summonerId !== 0) {
                    const name = await this.getSummonerName(player.summonerId);
                    if (name) names.push(name);
                }
            }
        }
        
        return names;
    }

    async getSummonerName(summonerId) {
        try {
            const response = await this.lcu.get(`/lol-summoner/v1/summoners/${summonerId}`);
            if (response.status === 200 && response.data) {
                return `${response.data.gameName}%23${response.data.tagLine}`;
            }
        } catch (error) {
            // Ignore
        }
        return null;
    }

    async dodgeGame() {
        return this.executeLCURequest(
            () => this.lcu.post('/lol-login/v1/session/invoke?destination=lcdsServiceProxy&method=call&args=["","teambuilder-draft","quitV2",""]'),
            'Failed to dodge game'
        );
    }

    async removeAllFriends() {
        if (!this.lcu.isConnected) {
            return { success: false, error: 'LCU not connected' };
        }

        try {
            const response = await this.lcu.get('/lol-chat/v1/friends');
            
            if (response.status === 200 && response.data) {
                const removed = await this.removeFriendsList(response.data);
                return { success: true, removed };
            }
            
            return { success: false, error: 'Failed to get friends list' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async removeFriendsList(friends) {
        let removed = 0;
        
        for (const friend of friends) {
            try {
                await this.lcu.delete(`/lol-chat/v1/friends/${friend.pid}`);
                removed++;
            } catch (error) {
                // Continue removing others
            }
        }
        
        return removed;
    }

    async restartClient() {
        return this.executeLCURequest(
            () => this.lcu.post('/riotclient/kill-and-restart-ux'),
            'Failed to restart client'
        );
    }

    // ==================== UTILITY METHODS ====================

    async executeLCURequest(requestFn, errorMessage, validStatuses = [200]) {
        if (!this.lcu.isConnected) {
            return { success: false, error: 'LCU not connected' };
        }

        try {
            const response = await requestFn();
            const isSuccess = validStatuses.includes(response.status);
            
            return isSuccess 
                ? { success: true } 
                : { success: false, error: errorMessage };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    clearInterval(key) {
        if (this.intervals[key]) {
            clearInterval(this.intervals[key]);
            this.intervals[key] = null;
            console.log(`[${key}] Stopped`);
        }
    }

    getFeatureStates() {
        return {
            autoAccept: this.state.autoAccept.enabled,
            autoPick: {
                enabled: this.state.autoPick.enabled,
                champion: this.state.autoPick.champion,
                championId: this.state.autoPick.championId
            },
            autoBan: {
                enabled: this.state.autoBan.enabled,
                champion: this.state.autoBan.champion,
                championId: this.state.autoBan.championId,
                protect: this.state.autoBan.protectBan
            },
            chatDisconnected: this.state.chatDisconnected
        };
    }

    destroy() {
        console.log('[Feature] Destroying service...');
        
        this.stopAutoAccept();
        this.stopAutoPick();
        this.stopAutoBan();
        
        Object.keys(this.intervals).forEach(key => {
            this.clearInterval(key);
        });
        
        this.intervals = {};
        this.throttles = {};
    }
    
}

module.exports = FeatureService;