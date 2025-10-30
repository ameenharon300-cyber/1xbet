console.log('🚀 بدء تشغيل بوت توقعات الجول...');
console.log('⏰ ' + new Date().toLocaleString('ar-EG'));

// التحقق من وجود التوكن
if (!process.env.BOT_TOKEN) {
    console.error('❌ ERROR: BOT_TOKEN غير موجود!');
    console.log('📝 يرجى إضافة BOT_TOKEN في ملف .env أو في إعدادات Replit');
    console.log('🔧 يمكنك الحصول على التوكن من @BotFather في تليجرام');
    process.exit(1);
}

console.log('✅ تم العثور على التوكن');
console.log('🔧 جاري تحميل البوت...');

// محاولة تشغيل البوت مع معالجة الأخطاء
try {
    require('./bot-fixed.js');
    console.log('✅ تم تحميل البوت بنجاح');
    console.log('🤖 البوت يعمل الآن...');
    console.log('👤 المطور: إسماعيل - @VIP_MFM');
} catch (error) {
    console.error('❌ فشل في تحميل البوت:', error.message);
    console.log('🔧 جاري محاولة بديلة...');
    
    // محاولة بديلة
    try {
        const { Telegraf } = require('telegraf');
        const bot = new Telegraf(process.env.BOT_TOKEN);
        
        bot.start((ctx) => {
            ctx.reply('🎉 البوت يعمل! تم الإصلاح بنجاح');
        });
        
        bot.launch();
        console.log('✅ البوت البدائي يعمل الآن');
    } catch (secondError) {
        console.error('❌ فشل كلي في تشغيل البوت:', secondError.message);
        console.log('📋 تفاصيل الخطأ:', secondError.stack);
    }
}

// منع إغلاق البرنامج
process.on('uncaughtException', (error) => {
    console.error('❌ خطأ غير متوقع:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ وعد مرفوض:', reason);
});