const LogThrottle = require('../utils/LogThrottle');

/**
 * Match Service - Análise de Partidas Real
 */
class MatchService {
    constructor(lcuService) {
        this.lcu = lcuService;
        this.logThrottle = new LogThrottle(5000);
        this.cache = {
            matches: null,
            timestamp: 0,
            duration: 120000 // 2 minutos
        };
    }

    async getMatchHistory(puuid, count = 20) {
        try {
            const now = Date.now();
            if (this.cache.matches && (now - this.cache.timestamp) < this.cache.duration) {
                console.log('[Match] Using cached match history');
                return this.cache.matches;
            }

            console.log('[Match] Fetching match history...');
            const response = await this.lcu.get(`/lol-match-history/v1/products/lol/${puuid}/matches?begIndex=0&endIndex=${count}`);
            
            if (response.status === 200 && response.data?.games?.games) {
                const matches = response.data.games.games.map(game => {
                    const participant = game.participants[0];
                    const stats = participant.stats;
                    
                    return {
                        gameId: game.gameId,
                        gameCreation: game.gameCreation,
                        gameDuration: game.gameDuration,
                        gameMode: game.gameMode,
                        championId: participant.championId,
                        win: stats.win,
                        kills: stats.kills,
                        deaths: stats.deaths,
                        assists: stats.assists,
                        kda: this.calculateKDA(stats.kills, stats.deaths, stats.assists),
                        cs: (stats.totalMinionsKilled || 0) + (stats.neutralMinionsKilled || 0),
                        gold: stats.goldEarned
                    };
                });

                this.cache.matches = matches;
                this.cache.timestamp = now;
                
                console.log(`[Match] ✓ Loaded ${matches.length} matches`);
                return matches;
            }

            console.warn('[Match] No match data found');
            return [];
        } catch (error) {
            this.logThrottle.log('Match', 'ERROR', 'Failed to get match history', error.message);
            return [];
        }
    }

    calculateKDA(kills, deaths, assists) {
        if (deaths === 0) return ((kills + assists) || 0).toFixed(2);
        return ((kills + assists) / deaths).toFixed(2);
    }

    calculateWinrate(matches) {
        if (!matches || matches.length === 0) return 0;
        const wins = matches.filter(m => m.win).length;
        return Math.round((wins / matches.length) * 100);
    }

    getAggregatedStats(matches) {
        if (!matches || matches.length === 0) {
            return {
                totalGames: 0,
                wins: 0,
                losses: 0,
                winrate: 0,
                avgKills: 0,
                avgDeaths: 0,
                avgAssists: 0,
                avgKDA: 0
            };
        }

        const wins = matches.filter(m => m.win).length;
        const losses = matches.length - wins;
        
        const totals = matches.reduce((acc, match) => ({
            kills: acc.kills + match.kills,
            deaths: acc.deaths + match.deaths,
            assists: acc.assists + match.assists
        }), { kills: 0, deaths: 0, assists: 0 });

        const count = matches.length;

        return {
            totalGames: count,
            wins,
            losses,
            winrate: Math.round((wins / count) * 100),
            avgKills: (totals.kills / count).toFixed(1),
            avgDeaths: (totals.deaths / count).toFixed(1),
            avgAssists: (totals.assists / count).toFixed(1),
            avgKDA: this.calculateKDA(totals.kills, totals.deaths, totals.assists)
        };
    }

    getMostPlayedChampions(matches, limit = 5) {
        if (!matches || matches.length === 0) return [];

        const championStats = {};

        matches.forEach(match => {
            const champId = match.championId;
            
            if (!championStats[champId]) {
                championStats[champId] = {
                    championId: champId,
                    games: 0,
                    wins: 0,
                    losses: 0,
                    winrate: 0
                };
            }

            championStats[champId].games++;
            if (match.win) {
                championStats[champId].wins++;
            } else {
                championStats[champId].losses++;
            }
        });

        Object.values(championStats).forEach(champ => {
            champ.winrate = Math.round((champ.wins / champ.games) * 100);
        });

        return Object.values(championStats)
            .sort((a, b) => b.games - a.games)
            .slice(0, limit);
    }

    getCurrentStreak(matches) {
        if (!matches || matches.length === 0) return { type: 'none', count: 0 };

        let streak = 0;
        const firstResult = matches[0].win;

        for (const match of matches) {
            if (match.win === firstResult) {
                streak++;
            } else {
                break;
            }
        }

        return {
            type: firstResult ? 'win' : 'loss',
            count: streak
        };
    }

    async getCurrentGameFlow() {
        try {
            const response = await this.lcu.get('/lol-gameflow/v1/gameflow-phase');
            if (response.status === 200 && response.data) {
                return response.data;
            }
            return 'None';
        } catch (error) {
            return 'None';
        }
    }

    clearCache() {
        this.cache = {
            matches: null,
            timestamp: 0,
            duration: 120000
        };
        console.log('[Match] Cache cleared');
    }
}

module.exports = MatchService;