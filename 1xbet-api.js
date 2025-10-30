const axios = require('axios');
const cheerio = require('cheerio');

class Advanced1xBetAPI {
    constructor() {
        this.baseURL = 'https://1xbet.com';
        this.session = null;
        this.endpoints = [];
        this.rateLimitDelay = 2000;
    }

    async initSession() {
        if (this.session) return true;

        try {
            this.session = axios.create({
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Referer': 'https://1xbet.com/en/live',
                    'Origin': 'https://1xbet.com'
                }
            });

            // اختبار الجلسة
            await this.session.get(`${this.baseURL}/en/live`);
            console.log('✅ تم تهيئة الجلسة بنجاح');
            return true;
        } catch (error) {
            console.error('❌ فشل في تهيئة الجلسة:', error.message);
            this.session = null;
            return false;
        }
    }

    async getLiveMatches(sportId = null) {
        try {
            if (!await this.initSession()) {
                throw new Error('فشل في تهيئة الجلسة');
            }

            const timestamp = Date.now();
            const url = `${this.baseURL}/LiveFeed/Get1x2_VZip?sn=147&ts=${timestamp}&mode=4&country=1&partner=1&getEmpty=true`;

            const response = await this.session.get(url);
            
            if (response.data && response.data.Value) {
                let matches = response.data.Value;
                
                // تصفية حسب الرياضة إذا طلب
                if (sportId) {
                    matches = matches.filter(match => match.SI === sportId);
                }
                
                return this.processMatchesData(matches);
            }
            
            return [];
        } catch (error) {
            console.error('❌ خطأ في جلب المباريات الحية:', error.message);
            throw error;
        }
    }

    processMatchesData(matches) {
        return matches.map(match => ({
            id: match.I || match.Id,
            sportId: match.SI,
            sportName: match.SN || 'Football',
            leagueId: match.LI,
            leagueName: match.LN || 'Unknown League',
            team1: match.O1 || 'Team 1',
            team2: match.O2 || 'Team 2',
            score: match.SC || '0:0',
            time: match.TM || '0\'',
            odds: this.extractOdds(match),
            statistics: this.extractStatistics(match),
            timestamp: new Date().toISOString()
        })).filter(match => match.team1 && match.team2);
    }

    extractOdds(match) {
        try {
            if (match.E && match.E.length > 0) {
                const mainEvent = match.E[0];
                if (mainEvent.C && mainEvent.C.length > 0) {
                    const team1 = mainEvent.C.find(c => c.T === '1');
                    const draw = mainEvent.C.find(c => c.T === 'X');
                    const team2 = mainEvent.C.find(c => c.T === '2');
                    
                    return {
                        team1: team1 ? team1.P : null,
                        draw: draw ? draw.P : null,
                        team2: team2 ? team2.P : null
                    };
                }
            }
            return { team1: null, draw: null, team2: null };
        } catch (error) {
            return { team1: null, draw: null, team2: null };
        }
    }

    extractStatistics(match) {
        try {
            if (!match.STATS) return null;
            
            return {
                attacks: match.STATS.ATTACKS,
                dangerousAttacks: match.STATS.DANGEROUS_ATTACKS,
                possession: match.STATS.BALL_POSSESSION,
                shotsOnTarget: match.STATS.SHOTS_ON_TARGET,
                shotsOffTarget: match.STATS.SHOTS_OFF_TARGET,
                corners: match.STATS.CORNERS,
                fouls: match.STATS.FOULS,
                offsides: match.STATS.OFFSIDES,
                yellowCards: match.STATS.YELLOW_CARDS,
                redCards: match.STATS.RED_CARDS
            };
        } catch (error) {
            return null;
        }
    }

    async getMatchDetails(matchId) {
        try {
            if (!await this.initSession()) {
                throw new Error('فشل في تهيئة الجلسة');
            }

            const url = `${this.baseURL}/LiveFeed/GetGameZip?lng=en&id=${matchId}&cfview=0&isSubGames=true&GroupEvents=true&allEventsGroupSubGames=true&counters=1&country=1&marketType=1`;
            
            const response = await this.session.get(url);
            
            if (response.data && response.data.Value) {
                return this.processMatchDetails(response.data.Value);
            }
            
            return null;
        } catch (error) {
            console.error(`❌ خطأ في جلب تفاصيل المباراة ${matchId}:`, error.message);
            throw error;
        }
    }

    processMatchDetails(matchData) {
        const details = {
            basicInfo: {
                team1: matchData.O1 || 'Team 1',
                team2: matchData.O2 || 'Team 2',
                score: matchData.SCORE || '0:0',
                time: matchData.TM || '0\'',
                league: matchData.LN || 'Unknown League',
                sport: matchData.SN || 'Football'
            },
            events: this.extractEvents(matchData),
            statistics: this.extractDetailedStats(matchData),
            odds: this.extractAllOdds(matchData),
            timeline: this.extractTimeline(matchData)
        };

        return details;
    }

    extractEvents(matchData) {
        const events = [];
        
        try {
            if (matchData.EV && Array.isArray(matchData.EV)) {
                matchData.EV.forEach(event => {
                    if (event.T && event.TY) {
                        events.push({
                            time: event.T,
                            type: event.TY,
                            team: event.TI === 1 ? 'team1' : 'team2',
                            player: event.P || 'Unknown',
                            description: this.getEventDescription(event.TY)
                        });
                    }
                });
            }
        } catch (error) {
            console.error('Error extracting events:', error);
        }
        
        return events;
    }

    getEventDescription(eventType) {
        const eventsMap = {
            1: '⚽ هدف',
            2: '🟨 كرت أصفر',
            3: '🟥 كرت أحمر',
            4: '🔄 تبديل',
            5: '🎯 ركنية',
            6: '🎪 ضربة حرة',
            7: '🥅 ضربة جزاء',
            8: '🧤 تصدي',
            9: '🚫 هجمة خطيرة'
        };
        
        return eventsMap[eventType] || '📝 حدث';
    }

    extractDetailedStats(matchData) {
        try {
            if (!matchData.STATS) return null;
            
            return {
                attacks: matchData.STATS.ATTACKS,
                dangerousAttacks: matchData.STATS.DANGEROUS_ATTACKS,
                possession: matchData.STATS.BALL_POSSESSION,
                shotsOnTarget: matchData.STATS.SHOTS_ON_TARGET,
                shotsOffTarget: matchData.STATS.SHOTS_OFF_TARGET,
                corners: matchData.STATS.CORNERS,
                fouls: matchData.STATS.FOULS,
                offsides: matchData.STATS.OFFSIDES,
                yellowCards: matchData.STATS.YELLOW_CARDS,
                redCards: matchData.STATS.RED_CARDS
            };
        } catch (error) {
            return null;
        }
    }

    extractAllOdds(matchData) {
        // تنفيذ استخراج جميع odds المتاحة
        return {
            main: this.extractOdds(matchData),
            // يمكن إضافة المزيد من أنواع odds هنا
        };
    }

    extractTimeline(matchData) {
        // تنفيذ استخراج الخط الزمني للأحداث
        return [];
    }

    async discoverEndpoints() {
        console.log('🔍 بدء اكتشاف end points...');
        
        const endpointsToTest = [
            '/LiveFeed/Get1x2_VZip',
            '/LiveFeed/GetGameZip',
            '/LiveFeed/GetGamesZip',
            '/LiveFeed/GetChampZip',
            '/LineFeed/Get1x2_VZip',
            '/ServiceFeed/GetFeaturedGames'
        ];

        for (const endpoint of endpointsToTest) {
            try {
                const testUrl = `${this.baseURL}${endpoint}?ts=${Date.now()}`;
                const response = await this.session.get(testUrl);
                
                if (response.status === 200) {
                    this.endpoints.push({
                        url: endpoint,
                        status: 'active',
                        lastChecked: new Date()
                    });
                    console.log(`✅ ${endpoint} - نشط`);
                }
            } catch (error) {
                console.log(`❌ ${endpoint} - غير نشط`);
            }
            
            await this.delay(1000);
        }

        return this.endpoints;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = Advanced1xBetAPI;