class GoalPredictor {
    constructor() {
        this.predictionModels = {
            timeBased: this.timeBasedPrediction,
            statsBased: this.statsBasedPrediction,
            hybrid: this.hybridPrediction
        };
    }

    generatePrediction(matchDetails) {
        const basicPrediction = this.basicPrediction(matchDetails);
        const advancedPrediction = this.advancedPrediction(matchDetails);
        
        return {
            ...basicPrediction,
            ...advancedPrediction,
            confidence: this.calculateConfidence(matchDetails),
            timestamp: new Date().toISOString()
        };
    }

    basicPrediction(matchDetails) {
        const currentScore = matchDetails.basicInfo.score;
        const currentTime = matchDetails.basicInfo.time;
        const stats = matchDetails.statistics;

        const goalProbability = this.calculateGoalProbability(currentScore, currentTime, stats);
        
        return {
            goalProbability: Math.round(goalProbability),
            predictions: {
                nextGoal: this.predictNextGoal(goalProbability, currentTime),
                finalScore: this.predictFinalScore(currentScore, goalProbability),
                strategy: this.generateStrategy(goalProbability, stats)
            }
        };
    }

    calculateGoalProbability(score, time, stats) {
        let probability = 50; // الاحتمال الأساسي

        // عامل الوقت
        probability *= this.getTimeFactor(time);

        // عامل النتيجة
        probability *= this.getScoreFactor(score);

        // عامل الإحصائيات
        if (stats) {
            probability = this.applyStatsFactors(probability, stats);
        }

        return Math.min(Math.max(probability, 5), 95);
    }

    getTimeFactor(time) {
        if (!time) return 1;
        
        const timeMinutes = parseInt(time.replace("'", "")) || 0;
        
        if (timeMinutes <= 15) return 0.7;    // بداية المباراة
        if (timeMinutes <= 30) return 0.9;    // منتصف الشوط الأول
        if (timeMinutes <= 45) return 1.1;    // نهاية الشوط الأول
        if (timeMinutes <= 60) return 1.3;    // بداية الشوط الثاني
        if (timeMinutes <= 75) return 1.6;    // منتصف الشوط الثاني
        return 1.8;                           // نهاية المباراة
    }

    getScoreFactor(score) {
        if (!score || score === '0:0') return 1.0;
        
        const [goals1, goals2] = score.split(':').map(Number);
        const totalGoals = goals1 + goals2;
        
        if (totalGoals === 0) return 1.2;
        if (totalGoals === 1) return 1.1;
        if (totalGoals === 2) return 1.0;
        if (totalGoals === 3) return 0.9;
        return 0.8; // أكثر من 3 أهداف
    }

    applyStatsFactors(probability, stats) {
        let adjustedProb = probability;

        // الهجمات الخطيرة
        if (stats.dangerousAttacks) {
            const attacks = this.parseStatValue(stats.dangerousAttacks);
            if (attacks > 10) adjustedProb += 10;
            if (attacks > 20) adjustedProb += 15;
        }

        // التسديدات
        if (stats.shotsOnTarget) {
            const shots = this.parseStatValue(stats.shotsOnTarget);
            if (shots > 5) adjustedProb += 8;
            if (shots > 10) adjustedProb += 12;
        }

        // الركنيات
        if (stats.corners) {
            const corners = this.parseStatValue(stats.corners);
            if (corners > 5) adjustedProb += 5;
            if (corners > 8) adjustedProb += 7;
        }

        // الاستحواذ
        if (stats.possession) {
            const possession = this.parseStatValue(stats.possession);
            if (possession > 60) adjustedProb += 5;
        }

        return adjustedProb;
    }

    parseStatValue(stat) {
        if (typeof stat === 'number') return stat;
        if (typeof stat === 'string') {
            // معالجة الصيغ مثل "12:8"
            const parts = stat.split(':');
            return parts.reduce((sum, part) => sum + parseInt(part) || 0, 0);
        }
        return 0;
    }

    predictNextGoal(probability, currentTime) {
        if (probability >= 75) {
            return {
                probability: "عالية جداً",
                expectedTime: "في الدقائق 1-3 القادمة",
                confidence: "🟢 عالية"
            };
        } else if (probability >= 60) {
            return {
                probability: "عالية",
                expectedTime: "في الدقائق 5-10 القادمة",
                confidence: "🟢 جيدة"
            };
        } else if (probability >= 40) {
            return {
                probability: "متوسطة",
                expectedTime: "في خلال 10-15 دقيقة",
                confidence: "🟡 متوسطة"
            };
        } else {
            return {
                probability: "منخفضة",
                expectedTime: "غير متوقع قريباً",
                confidence: "🔴 منخفضة"
            };
        }
    }

    predictFinalScore(currentScore, goalProbability) {
        if (!currentScore || currentScore === '0:0') {
            const expectedGoals = Math.round(goalProbability / 33); // 33% لكل هدف متوقع
            return expectedGoals <= 1 ? "1-0 أو 1-1" : 
                   expectedGoals === 2 ? "2-1 أو 2-0" : "2-2 أو 3-1";
        }

        try {
            const [score1, score2] = currentScore.split(':').map(Number);
            const additionalGoals = Math.round(goalProbability / 25); // 25% لكل هدف إضافي
            
            const finalScore1 = score1 + Math.round(additionalGoals * 0.6);
            const finalScore2 = score2 + Math.round(additionalGoals * 0.4);
            
            return `${finalScore1}-${finalScore2}`;
        } catch (error) {
            return "1-1 أو 2-1";
        }
    }

    generateStrategy(probability, stats) {
        const strategies = [];

        if (probability >= 70) {
            strategies.push("🎯 الضغط الهجومي مرتفع - توقع هدف قريب");
            strategies.push("⚡ استعد لهجمات سريعة مضادة");
        } else if (probability >= 50) {
            strategies.push("📊 اللعب متوازن - توقع أهداف في الشوط الثاني");
            strategies.push("🎪 ركز على الركنيات والكرات الثابتة");
        } else {
            strategies.push("🛡️ الدفاع متحكم - أهداف محدودة متوقعة");
        }

        // إضافة استراتيجيات بناءً على الإحصائيات
        if (stats) {
            if (stats.corners && this.parseStatValue(stats.corners) > 8) {
                strategies.push("🎪 الركنيات كثيرة - توقع هدف من كرة ثابتة");
            }
            
            if (stats.possession && this.parseStatValue(stats.possession) > 65) {
                strategies.push("🔵 استحواذ عالي - توقع هدف من ضغط مستمر");
            }
            
            if (stats.shotsOnTarget && this.parseStatValue(stats.shotsOnTarget) > 8) {
                strategies.push("🎯 التسديدات كثيرة - الهدف قادم لا محالة");
            }
        }

        return strategies.length > 0 ? strategies : ["📝 جاري تحليل البيانات..."];
    }

    advancedPrediction(matchDetails) {
        // يمكن إضافة تنبؤات متقدمة هنا
        return {
            riskLevel: this.assessRiskLevel(matchDetails),
            keyMoments: this.predictKeyMoments(matchDetails),
            trend: this.analyzeTrend(matchDetails)
        };
    }

    assessRiskLevel(matchDetails) {
        const probability = this.calculateGoalProbability(
            matchDetails.basicInfo.score,
            matchDetails.basicInfo.time,
            matchDetails.statistics
        );

        if (probability >= 70) return "🟢 منخفض";
        if (probability >= 40) return "🟡 متوسط";
        return "🔴 عالي";
    }

    predictKeyMoments(matchDetails) {
        const time = parseInt(matchDetails.basicInfo.time) || 0;
        const moments = [];

        if (time <= 45) {
            moments.push(`الدقيقة ${time + 5}-${time + 10}: فترة هجوم محتملة`);
        } else {
            moments.push(`الدقيقة ${time + 3}-${time + 8}: فرص تسجيل متوقعة`);
        }

        return moments;
    }

    analyzeTrend(matchDetails) {
        // تحليل الاتجاه بناءً على الإحصائيات
        return "📈 في تحسن مستمر";
    }

    calculateConfidence(matchDetails) {
        let confidence = 70; // الثقة الأساسية

        // زيادة الثقة بوجود إحصائيات
        if (matchDetails.statistics) {
            confidence += 15;
        }

        // زيادة الثقة بوجود events
        if (matchDetails.events && matchDetails.events.length > 0) {
            confidence += 10;
        }

        return Math.min(confidence, 95);
    }
}

module.exports = GoalPredictor;