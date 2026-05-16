const prisma = require('../db');

async function checkAdminAffiliate() {
    try {
        const user = await prisma.user.findFirst({
            where: { email: 'admin@auratrade.ai' },
            include: {
                referrals: true
            }
        });

        if (!user) {
            console.log("User admin@auratrade.ai not found");
            return;
        }

        console.log("Admin User Affiliate Data:");
        console.log(JSON.stringify({
            id: user.id,
            email: user.email,
            referralCode: user.referralCode,
            totalBonusEarned: user.totalBonusEarned,
            availableBonus: user.availableBonus,
            totalBonusWithdrawn: user.totalBonusWithdrawn,
            referralsCount: user.referrals.length
        }, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

checkAdminAffiliate();
