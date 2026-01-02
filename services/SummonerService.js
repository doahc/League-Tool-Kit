const LogThrottle = require('../utils/LogThrottle');

/**
 * Summoner Service - Fixed
 * - Better cache invalidation
 * - Error handling improvements
 * - Data validation
 */
class SummonerService {
    constructor(lcuService) {
        this.lcu = lcuService;
        this.logThrottle = new LogThrottle(5000);
        this.currentSummoner = null;
        this.rankedStats = null;
        this.region = null;
        this.cache = {
            summoner: { data: null, timestamp: 0, valid: false },
            ranked: { data: null, timestamp: 0, valid: false },
            region: { data: null, timestamp: 0, valid: false }
        };
        this.cacheDuration = 30000; // 30 seconds
    }

    /**
     * Check if cache is valid
     */
    isCacheValid(cacheKey) {
        const cache = this.cache[cacheKey];
        return cache.valid && cache.data && (Date.now() - cache.timestamp) < this.cacheDuration;
    }

    /**
     * Save to cache with validation flag
     */
    setCache(cacheKey, data) {
        this.cache[cacheKey] = {
            data: data,
            timestamp: Date.now(),
            valid: data !== null
        };
    }

    /**
     * Invalidate cache entry
     */
    invalidateCache(cacheKey) {
        if (this.cache[cacheKey]) {
            this.cache[cacheKey].valid = false;
        }
    }

    /**
     * Get current summoner with validation
     */
    async getCurrentSummoner() {
        try {
            if (this.isCacheValid('summoner')) {
                return this.cache.summoner.data;
            }

            const response = await this.lcu.get('/lol-summoner/v1/current-summoner');
            
            if (response.status === 200 && response.data) {
                const data = response.data;
                
                // Validate required fields
                if (!data.summonerId || !data.puuid) {
                    this.invalidateCache('summoner');
                    return null;
                }

                const summoner = {
                    id: data.summonerId,
                    accountId: data.accountId,
                    puuid: data.puuid,
                    gameName: data.gameName || data.displayName || 'Unknown',
                    tagLine: data.tagLine || 'BR1',
                    summonerLevel: data.summonerLevel || 0,
                    profileIconId: data.profileIconId || 0,
                    xpSinceLastLevel: data.xpSinceLastLevel || 0,
                    xpUntilNextLevel: data.xpUntilNextLevel || 0
                };

                this.currentSummoner = summoner;
                this.setCache('summoner', summoner);
                return summoner;
            }

            this.invalidateCache('summoner');
            return null;
        } catch (error) {
            this.invalidateCache('summoner');
            this.logThrottle.log('Summoner', 'ERROR', 'Failed to get summoner', error.message);
            return null;
        }
    }

    /**
     * Get ranked stats with better error handling
     */
    async getRankedStats() {
        try {
            if (this.isCacheValid('ranked')) {
                return this.cache.ranked.data;
            }

            const response = await this.lcu.get('/lol-ranked/v1/current-ranked-stats');
            
            if (response.status === 200 && response.data) {
                const queues = response.data.queues || [];
                
                const soloQueue = queues.find(q => q.queueType === 'RANKED_SOLO_5x5');
                const flexQueue = queues.find(q => q.queueType === 'RANKED_FLEX_SR');

                const stats = {
                    solo: soloQueue ? this.parseQueueStats(soloQueue) : this.getUnrankedStats(),
                    flex: flexQueue ? this.parseQueueStats(flexQueue) : this.getUnrankedStats(),
                    highestTier: response.data.highestPreviousSeasonEndTier || 'UNRANKED',
                    highestDivision: response.data.highestPreviousSeasonEndDivision || 'NA'
                };

                this.rankedStats = stats;
                this.setCache('ranked', stats);
                return stats;
            }

            this.invalidateCache('ranked');
            return null;
        } catch (error) {
            this.invalidateCache('ranked');
            this.logThrottle.log('Summoner', 'ERROR', 'Failed to get ranked stats', error.message);
            return null;
        }
    }

    /**
     * Parse queue stats with validation
     */
    parseQueueStats(queue) {
        const wins = queue.wins || 0;
        const losses = queue.losses || 0;
        const total = wins + losses;
        const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;

        return {
            tier: queue.tier || 'UNRANKED',
            division: queue.division || '',
            leaguePoints: queue.leaguePoints || 0,
            wins: wins,
            losses: losses,
            winrate: winrate,
            isProvisional: queue.isProvisional || false,
            miniSeriesProgress: queue.miniSeriesProgress || null,
            rankDisplay: this.formatRank(queue.tier, queue.division, queue.leaguePoints)
        };
    }

    getUnrankedStats() {
        return {
            tier: 'UNRANKED',
            division: '',
            leaguePoints: 0,
            wins: 0,
            losses: 0,
            winrate: 0,
            isProvisional: false,
            miniSeriesProgress: null,
            rankDisplay: 'Unranked'
        };
    }

    formatRank(tier, division, lp) {
        if (!tier || tier === 'UNRANKED') {
            return 'Unranked';
        }

        const tierName = tier.charAt(0) + tier.slice(1).toLowerCase();
        
        if (['Master', 'Grandmaster', 'Challenger'].includes(tierName)) {
            return `${tierName} ${lp} LP`;
        }

        return `${tierName} ${division} - ${lp} LP`;
    }

    /**
     * Get region with validation
     */
    async getRegion() {
        try {
            if (this.isCacheValid('region')) {
                return this.cache.region.data;
            }

            const response = await this.lcu.get('/riotclient/region-locale');
            
            if (response.status === 200 && response.data) {
                const region = {
                    region: response.data.region || 'BR',
                    webRegion: response.data.webRegion || 'BR1',
                    locale: response.data.locale || 'pt_BR'
                };

                this.region = region;
                this.setCache('region', region);
                return region;
            }

            this.invalidateCache('region');
            return null;
        } catch (error) {
            this.invalidateCache('region');
            this.logThrottle.log('Summoner', 'ERROR', 'Failed to get region', error.message);
            return null;
        }
    }

    /**
     * Get all data with retry logic
     */
    async getAllData(retries = 2) {
        try {
            const results = await Promise.allSettled([
                this.getCurrentSummoner(),
                this.getRankedStats(),
                this.getRegion()
            ]);

            const summoner = results[0].status === 'fulfilled' ? results[0].value : null;
            const ranked = results[1].status === 'fulfilled' ? results[1].value : null;
            const region = results[2].status === 'fulfilled' ? results[2].value : null;

            const isComplete = summoner !== null && ranked !== null && region !== null;

            // Retry if incomplete and retries available
            if (!isComplete && retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.getAllData(retries - 1);
            }

            return {
                summoner,
                ranked,
                region,
                isComplete
            };
        } catch (error) {
            this.logThrottle.log('Summoner', 'ERROR', 'Failed to get all data', error.message);
            return {
                summoner: null,
                ranked: null,
                region: null,
                isComplete: false
            };
        }
    }

    /**
     * Clear all cache
     */
    clearCache() {
        this.cache = {
            summoner: { data: null, timestamp: 0, valid: false },
            ranked: { data: null, timestamp: 0, valid: false },
            region: { data: null, timestamp: 0, valid: false }
        };
        this.currentSummoner = null;
        this.rankedStats = null;
        this.region = null;
    }

    /**
     * Validate session
     */
    async validateSession() {
        try {
            const summoner = await this.getCurrentSummoner();
            return summoner !== null;
        } catch (error) {
            return false;
        }
    }
}

module.exports = SummonerService;