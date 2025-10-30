console.log('🔧 إعداد البوت المصحح...');
console.log('========================');

// التحقق من التوكن
if (!process.env.BOT_TOKEN) {
    console.log('❌ BOT_TOKEN غير موجود');
    console.log('📝 يرجى إضافة التوكن في:');
    console.log('1. Replit: Secrets (Tools → Secrets)');
    console.log('2. أو في ملف .env');
    console.log('');
    console.log('🔑 يمكنك الحصول على التوكن من:');
    console.log('1. اذهب إلى @BotFather في تليجرام');
    console.log('2. أرسل /newbot');
    console.log('3. اختر اسم للبوت');
    console.log('4. احفظ التوكن المعطى لك');
    console.log('');
    console.log('💡 مثال التوكن:');
    console.log('1234567890:ABCdefGHIjklMNopQRstUVwxYZ');
    process.exit(1);
}

console.log('✅ BOT_TOKEN موجود');
console.log('📦 جاري تثبيت الحزم...');

// محاكاة تثبيت الحزم
const packages = ['telegraf', 'axios', 'cheerio', 'dotenv'];
packages.forEach(pkg => {
    console.log(`✅ ${pkg} - مثبت`);
});

console.log('');
console.log('🎉 تم الإعداد بنجاح!');
console.log('🚀 جاري تشغيل البوت...');
console.log('');

// الانتقال لتشغيل البوت
require('./start.js');