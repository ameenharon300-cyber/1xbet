require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const Advanced1xBetAPI = require('./1xbet-api');
const GoalPredictor = require('./scanner');

class TelegramGoalBot {
    constructor() {
        this.token = process.env.BOT_TOKEN || require('./config.json').bot.token;
        this.bot = new Telegraf(this.token);
        this.api = new Advanced1xBetAPI();
        this.predictor = new GoalPredictor();
        this.userSessions = new Map();
        this.monitoringMatches = new Map();
        this.botStats = {
            totalUsers: new Set(),
            totalScans: 0,
            matchesFound: 0,
            startTime: new Date()
        };
        
        this.setupMiddlewares();
        this.setupHandlers();
    }

    setupMiddlewares() {
        this.bot.use(session());
        this.bot.use((ctx, next) => {
            this.botStats.totalUsers.add(ctx.from.id);
            console.log(`👤 User ${ctx.from.id} used command: ${ctx.message?.text}`);
            return next();
        });
    }

    setupHandlers() {
        this.setupStartHandler();
        this.setupMatchHandlers();
        this.setupMonitoringHandlers();
        this.setupUtilityHandlers();
        this.setupErrorHandlers();
    }

    setupStartHandler() {
        this.bot.start((ctx) => {
            const welcomeMessage = `
🕌 *بسم الله الرحمن الرحيم*

⚽ *مرحباً بك في بوت توقعات الجول المتقدم*

🛠️ *المطور:* إسماعيل - @VIP_MFM
📅 *الإصدار:* 3.0.0
🌐 *المصدر:* بيانات حية من 1xBet

🎯 *المميزات الرئيسية:*
✅ توقعات ذكية للجول
✅ مراقبة حية للمباريات
✅ إحصائيات مفصلة
✅ بحث متقدم
✅ تحديثات فورية

📋 *الأوامر المتاحة:*
/matches - عرض المباريات الحية
/search [الفريق] - البحث عن مباريات
/monitor [الرمز] - مراقبة مباراة
/stop - إيقاف المراقبة
/stats - إحصائيات البوت
/help - المساعدة

💡 *طريقة الاستخدام:*
1. استخدم /matches لرؤية المباريات
2. انسخ رمز المباراة
3. استخدم /monitor مع الرمز
            `;

            ctx.replyWithMarkdown(welcomeMessage, this.getMainKeyboard());
        });
    }

    setupMatchHandlers() {
        // عرض المباريات الحية
        this.bot.command('matches', async (ctx) => {
            try {
                const processingMsg = await ctx.reply('🔄 جاري جلب المباريات الحية...');
                
                await this.api.initSession();
                const matches = await this.api.getLiveMatches();
                this.botStats.matchesFound += matches.length;
                this.botStats.totalScans++;

                if (matches.length === 0) {
                    await ctx.reply('❌ لا توجد مباريات حية في الوقت الحالي');
                    return;
                }

                await this.sendMatchesList(ctx, matches);
                await ctx.deleteMessage(processingMsg.message_id);

            } catch (error) {
                await this.handleError(ctx, error, 'جلب المباريات');
            }
        });

        // البحث عن مباريات
        this.bot.command('search', async (ctx) => {
            const query = ctx.message.text.replace('/search', '').trim();
            
            if (!query) {
                await ctx.reply('❌ يرجى إدخال اسم الفريق للبحث\nمثال: `/search Barcelona`');
                return;
            }

            try {
                const processingMsg = await ctx.reply(`🔍 جاري البحث عن "${query}"...`);
                
                await this.api.initSession();
                const matches = await this.api.getLiveMatches();
                const filteredMatches = matches.filter(match => 
                    match.team1.toLowerCase().includes(query.toLowerCase()) || 
                    match.team2.toLowerCase().includes(query.toLowerCase())
                );

                if (filteredMatches.length === 0) {
                    await ctx.reply(`❌ لا توجد مباريات حية للفريق: ${query}`);
                    return;
                }

                await this.sendMatchesList(ctx, filteredMatches, `نتائج البحث عن "${query}"`);
                await ctx.deleteMessage(processingMsg.message_id);

            } catch (error) {
                await this.handleError(ctx, error, 'البحث');
            }
        });
    }

    setupMonitoringHandlers() {
        // مراقبة مباراة
        this.bot.command('monitor', async (ctx) => {
            const matchId = ctx.message.text.replace('/monitor', '').trim();
            
            if (!matchId) {
                await ctx.reply('❌ يرجى إدخال رمز المباراة\nمثال: `/monitor 123456`');
                return;
            }

            // إيقاف أي مراقبة سابقة
            this.stopUserMonitoring(ctx.from.id);

            try {
                const processingMsg = await ctx.reply('🔍 جاري تحضير المراقبة...');
                
                await this.api.initSession();
                const matchDetails = await this.api.getMatchDetails(matchId);
                
                if (!matchDetails) {
                    await ctx.reply('❌ لم يتم العثور على المباراة. تأكد من الرمز.');
                    return;
                }

                // إرسال التقرير الأولي
                await this.sendMatchReport(ctx, matchDetails);
                
                // بدء المراقبة
                this.startMonitoring(ctx, matchId, matchDetails);
                
                await ctx.deleteMessage(processingMsg.message_id);
                await ctx.replyWithMarkdown(
                    '🔔 *تم بدء المراقبة*\n\n' +
                    'سيتم إرسال التحديثات كل 45 ثانية\n' +
                    'لإيقاف المراقبة: /stop'
                );

            } catch (error) {
                await this.handleError(ctx, error, 'بدء المراقبة');
            }
        });

        // إيقاف المراقبة
        this.bot.command('stop', (ctx) => {
            if (this.stopUserMonitoring(ctx.from.id)) {
                ctx.reply('🛑 تم إيقاف المراقبة بنجاح');
            } else {
                ctx.reply('⚠️ لا توجد مراقبة نشطة حالياً');
            }
        });
    }

    setupUtilityHandlers() {
        // الإحصائيات
        this.bot.command('stats', (ctx) => {
            const statsMessage = `
📊 *إحصائيات البوت*

👥 *المستخدمين:* ${this.botStats.totalUsers.size}
🔍 *عمليات الفحص:* ${this.botStats.totalScans}
⚽ *المباريات المعثور عليها:* ${this.botStats.matchesFound}
⏰ *مدة التشغيل:* ${this.getUptime()}
🔄 *المراقبات النشطة:* ${this.monitoringMatches.size}

🛠️ *المطور:* إسماعيل
📞 @VIP_MFM
            `;
            
            ctx.replyWithMarkdown(statsMessage);
        });

        // المساعدة
        this.bot.command('help', (ctx) => {
            const helpMessage = `
📖 *دليل الاستخدام الكامل*

🎯 *طريقة العمل:*
1. استخدم /matches لرؤية المباريات الحية
2. انسخ "الرمز" الموجود بجانب المباراة
3. استخدم /monitor مع الرمز لبدء المراقبة
4. استخدم /stop لإيقاف المراقبة

🔍 *أمثلة:*
/matches - عرض جميع المباريات
/search real madrid - البحث عن مباريات الريال
/monitor 123456 - مراقبة مباراة معينة
/stop - إيقاف المراقبة

⚡ *المميزات:*
• توقعات ذكية للجول القادمة
• إحصائيات حية من 1xBet
• مراقبة مستمرة
• تحديثات فورية

📞 *لل دعم:* @VIP_MFM
            `;
            
            ctx.replyWithMarkdown(helpMessage);
        });

        // معالجة النصوص (للأزرار)
        this.bot.on('text', (ctx) => {
            const text = ctx.message.text;
            
            switch (text) {
                case '⚽ المباريات الحية':
                    ctx.replyWithMarkdown('استخدم الأمر: `/matches`');
                    break;
                case '🔍 بحث سريع':
                    ctx.replyWithMarkdown('أرسل اسم الفريق للبحث\nمثال: `ريال مدريد`');
                    this.userSessions.set(ctx.from.id, { waitingForSearch: true });
                    break;
                case '📊 الإحصائيات':
                    ctx.replyWithMarkdown('استخدم الأمر: `/stats`');
                    break;
                case 'ℹ️ المساعدة':
                    ctx.replyWithMarkdown('استخدم الأمر: `/help`');
                    break;
                default:
                    if (this.userSessions.get(ctx.from.id)?.waitingForSearch) {
                        this.bot.telegram.sendMessage(ctx.chat.id, `🔍 جاري البحث عن "${text}"...`)
                            .then(() => {
                                ctx.replyWithMarkdown(`/search ${text}`);
                            });
                        this.userSessions.set(ctx.from.id, { waitingForSearch: false });
                    }
                    break;
            }
        });
    }

    setupErrorHandlers() {
        this.bot.catch((err, ctx) => {
            console.error('❌ Error occurred:', err);
            ctx.reply('❌ حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.');
        });
    }

    async sendMatchesList(ctx, matches, title = "المباريات الحية") {
        const chunks = this.chunkArray(matches, 5);
        
        for (const [index, chunk] of chunks.entries()) {
            let message = `📊 *${title} (${matches.length})* - الجزء ${index + 1}\n\n`;
            
            chunk.forEach((match, idx) => {
                const globalIndex = (index * 5) + idx + 1;
                message += `*${globalIndex}. ${match.team1} 🆚 ${match.team2}*\n`;
                message += `⏰ ${match.time} | 📍 ${match.score || '0:0'}\n`;
                message += `🏆 ${match.leagueName}\n`;
                message += `🔢 الرمز: \`${match.id}\`\n`;
                
                if (match.odds && match.odds.team1) {
                    message += `🎯 النسب: ${match.odds.team1} | ${match.odds.draw} | ${match.odds.team2}\n`;
                }
                
                message += `\n`;
            });

            await ctx.replyWithMarkdown(message);
            
            // تأخير بين الرسائل
            if (index < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        if (matches.length > 0) {
            await ctx.replyWithMarkdown(
                '💡 *للمراقبة:*\n' +
                'انسخ الرمز ثم استخدم:\n' +
                '`/monitor [الرمز]`\n\n' +
                '🔍 *للبحث:*\n' +
                '`/search [اسم الفريق]`'
            );
        }
    }

    async sendMatchReport(ctx, matchDetails) {
        const prediction = this.predictor.generatePrediction(matchDetails);
        
        const report = `
⚽ *${matchDetails.basicInfo.team1} vs ${matchDetails.basicInfo.team2}*

📊 *النتيجة الحالية:* ${matchDetails.basicInfo.score || '0:0'}
⏰ *الوقت:* ${matchDetails.basicInfo.time || 'بداية المباراة'}
🏆 *البطولة:* ${matchDetails.basicInfo.league}

🎯 *توقعات الجول:*
• الاحتمالية: ${prediction.goalProbability}%
• التوقع: ${prediction.predictions.nextGoal.expectedTime}
• الثقة: ${prediction.predictions.nextGoal.confidence}

📈 *الإحصائيات:*
${this.formatStatistics(matchDetails.statistics)}

🔮 *التوقعات النهائية:* ${prediction.predictions.finalScore}

💡 *النصائح:*
${prediction.predictions.strategy.join('\n')}

🔄 *آخر تحديث:* ${new Date().toLocaleString('ar-EG')}
        `;

        await ctx.replyWithMarkdown(report);
    }

    formatStatistics(stats) {
        if (!stats) return '• جاري جمع البيانات...';
        
        let formatted = '';
        if (stats.attacks) formatted += `• الهجمات: ${stats.attacks}\n`;
        if (stats.possession) formatted += `• الاستحواذ: ${stats.possession}\n`;
        if (stats.shotsOnTarget) formatted += `• التسديدات: ${stats.shotsOnTarget}\n`;
        if (stats.corners) formatted += `• الركنيات: ${stats.corners}\n`;
        if (stats.fouls) formatted += `• الأخطاء: ${stats.fouls}\n`;
        
        return formatted || '• البيانات غير متوفرة بعد';
    }

    startMonitoring(ctx, matchId, initialDetails) {
        const userId = ctx.from.id;
        const chatId = ctx.chat.id;
        
        const intervalId = setInterval(async () => {
            try {
                const currentDetails = await this.api.getMatchDetails(matchId);
                if (currentDetails && this.hasSignificantChange(initialDetails, currentDetails)) {
                    await this.sendMatchReport(ctx, currentDetails);
                    initialDetails = currentDetails;
                }
            } catch (error) {
                console.error(`Monitoring error for user ${userId}:`, error);
                // لا نرسل ошиб لل пользователя لتجنب الإزعاج
            }
        }, 45000); // كل 45 ثانية

        this.monitoringMatches.set(userId, {
            intervalId,
            matchId,
            chatId,
            lastUpdate: new Date()
        });
    }

    stopUserMonitoring(userId) {
        const monitoring = this.monitoringMatches.get(userId);
        if (monitoring) {
            clearInterval(monitoring.intervalId);
            this.monitoringMatches.delete(userId);
            return true;
        }
        return false;
    }

    hasSignificantChange(oldData, newData) {
        // التحقق من تغيير في النتيجة
        if (oldData.basicInfo.score !== newData.basicInfo.score) return true;
        
        // التحقق من تغيير كبير في الوقت
        const oldTime = parseInt(oldData.basicInfo.time) || 0;
        const newTime = parseInt(newData.basicInfo.time) || 0;
        if (Math.abs(newTime - oldTime) >= 2) return true;
        
        // يمكن إضافة المزيد من شروط التغيير
        return false;
    }

    getMainKeyboard() {
        return Markup.keyboard([
            ['⚽ المباريات الحية', '🔍 بحث سريع'],
            ['📊 الإحصائيات', 'ℹ️ المساعدة']
        ]).resize();
    }

    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    getUptime() {
        const uptime = Date.now() - this.botStats.startTime;
        const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
        const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        
        return `${days} أيام, ${hours} ساعات, ${minutes} دقائق`;
    }

    async handleError(ctx, error, operation) {
        console.error(`Error in ${operation}:`, error);
        
        let errorMessage = '❌ حدث خطأ أثناء العملية';
        
        if (error.code === 'ECONNREFUSED') {
            errorMessage = '❌ تعذر الاتصال بالخادم. يرجى المحاولة لاحقاً.';
        } else if (error.response?.status === 403) {
            errorMessage = '❌ تم حظر الوصول. يرجى الانتظار قليلاً.';
        } else if (error.response?.status === 404) {
            errorMessage = '❌ لم يتم العثور على البيانات المطلوبة.';
        }
        
        await ctx.reply(errorMessage);
    }

    start() {
        this.bot.launch().then(() => {
            console.log('🤖 بوت توقعات الجول يعمل الآن...');
            console.log('👤 المطور: إسماعيل');
            console.log('📞 @VIP_MFM');
            console.log('⏰ وقت البدء:', new Date().toLocaleString('ar-EG'));
        });

        // إغلاق نظيف
        process.once('SIGINT', () => {
            console.log('🛑 إيقاف البوت...');
            this.bot.stop('SIGINT');
            process.exit(0);
        });
        
        process.once('SIGTERM', () => {
            console.log('🛑 إيقاف البوت...');
            this.bot.stop('SIGTERM');
            process.exit(0);
        });
    }
}

// التشغيل
if (require.main === module) {
    const bot = new TelegramGoalBot();
    bot.start();
}

module.exports = TelegramGoalBot;