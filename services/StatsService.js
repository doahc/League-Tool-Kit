/**
 * Stats Service - Cálculos de Elo e Estatísticas
 */
class StatsService {
    constructor(lcuService) {
        this.lcu = lcuService;
        
        this.LP_PER_WIN_AVG = 20;
        this.LP_PER_LOSS_AVG = 18;
        
        this.TIER_ORDER = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
        this.DIV_ORDER = ['IV', 'III', 'II', 'I'];
    }

    calculateGamesToNextRank(currentTier, currentDiv, currentLP, winrate, lpGain = null, lpLoss = null) {
        if (!this.TIER_ORDER.includes(currentTier)) {
            return {
                valid: false,
                message: 'Invalid tier'
            };
        }

        if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(currentTier)) {
            return this.calculateGamesToMasterTier(currentTier, currentLP, winrate, lpGain, lpLoss);
        }

        const lpNeeded = 100 - currentLP;
        const avgGain = lpGain || this.LP_PER_WIN_AVG;
        const avgLoss = lpLoss || this.LP_PER_LOSS_AVG;
        const wr = winrate / 100;
        
        const avgLPPerGame = (avgGain * wr) - (avgLoss * (1 - wr));
        
        if (avgLPPerGame <= 0) {
            return {
                valid: false,
                message: 'Winrate too low',
                recommendation: 'You need at least 50% winrate to climb'
            };
        }

        const gamesNeeded = Math.ceil(lpNeeded / avgLPPerGame);
        const winsNeeded = Math.ceil(gamesNeeded * wr);
        const lossesExpected = gamesNeeded - winsNeeded;

        const nextRank = this.getNextRank(currentTier, currentDiv);

        return {
            valid: true,
            gamesNeeded,
            winsNeeded,
            lossesExpected,
            currentRank: `${currentTier} ${currentDiv}`,
            nextRank,
            lpNeeded,
            avgLPPerGame: avgLPPerGame.toFixed(2)
        };
    }

    calculateGamesToMasterTier(currentTier, currentLP, winrate, lpGain = null, lpLoss = null) {
        const thresholds = {
            MASTER: { next: 'GRANDMASTER', lpNeeded: 200 },
            GRANDMASTER: { next: 'CHALLENGER', lpNeeded: 500 },
            CHALLENGER: { next: 'TOP 10', lpNeeded: 1000 }
        };

        const threshold = thresholds[currentTier];
        if (!threshold) return { valid: false };

        const lpNeeded = threshold.lpNeeded - currentLP;
        const avgGain = lpGain || this.LP_PER_WIN_AVG;
        const avgLoss = lpLoss || this.LP_PER_LOSS_AVG;
        const wr = winrate / 100;
        
        const avgLPPerGame = (avgGain * wr) - (avgLoss * (1 - wr));
        
        if (avgLPPerGame <= 0 || lpNeeded <= 0) {
            return {
                valid: false,
                message: lpNeeded <= 0 ? 'Already at threshold' : 'Winrate too low'
            };
        }

        const gamesNeeded = Math.ceil(lpNeeded / avgLPPerGame);
        const winsNeeded = Math.ceil(gamesNeeded * wr);

        return {
            valid: true,
            gamesNeeded,
            winsNeeded,
            lossesExpected: gamesNeeded - winsNeeded,
            currentRank: `${currentTier} ${currentLP} LP`,
            nextRank: threshold.next,
            lpNeeded,
            avgLPPerGame: avgLPPerGame.toFixed(2)
        };
    }

    getNextRank(tier, division) {
        const divIndex = this.DIV_ORDER.indexOf(division);
        
        if (divIndex > 0) {
            return `${tier} ${this.DIV_ORDER[divIndex - 1]}`;
        } else if (divIndex === 0) {
            const tierIndex = this.TIER_ORDER.indexOf(tier);
            if (tierIndex < this.TIER_ORDER.length - 1) {
                const nextTier = this.TIER_ORDER[tierIndex + 1];
                return nextTier === 'MASTER' ? 'MASTER' : `${nextTier} IV`;
            }
        }
        
        return 'MAX RANK';
    }

    async getDetailedRankedStats() {
        try {
            const response = await this.lcu.get('/lol-ranked/v1/current-ranked-stats');
            
            if (response.status !== 200 || !response.data) {
                return null;
            }

            const queues = response.data.queues || [];
            const soloQueue = queues.find(q => q.queueType === 'RANKED_SOLO_5x5');
            const flexQueue = queues.find(q => q.queueType === 'RANKED_FLEX_SR');

            const parseQueue = (queue) => {
                if (!queue) return null;

                const wins = queue.wins || 0;
                const losses = queue.losses || 0;
                const total = wins + losses;
                const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;

                return {
                    tier: queue.tier,
                    division: queue.division,
                    leaguePoints: queue.leaguePoints || 0,
                    wins,
                    losses,
                    total,
                    winrate
                };
            };

            return {
                solo: parseQueue(soloQueue),
                flex: parseQueue(flexQueue)
            };
        } catch (error) {
            console.error('[Stats] Failed to get ranked stats:', error.message);
            return null;
        }
    }
}

module.exports = StatsService;