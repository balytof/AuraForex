const prisma = require('./db');

async function fixAffiliates() {
    try {
        const admin = await prisma.user.findFirst({
            where: { OR: [ { referralCode: "AURA-MASTER" }, { email: "admin@auratrade.ai" } ] }
        });

        if (!admin) {
            console.log("Admin user not found.");
            return;
        }

        console.log(`Found Admin: ${admin.email} (${admin.id}) with code: ${admin.referralCode}`);

        // Update all users who have sponsorId as null (except the admin themselves)
        const result = await prisma.user.updateMany({
            where: {
                sponsorId: null,
                NOT: { id: admin.id }
            },
            data: {
                sponsorId: admin.id
            }
        });

        console.log(`Fixed ${result.count} users. They are now affiliated to the admin.`);

    } catch (err) {
        console.error("Error fixing affiliates:", err);
    } finally {
        await prisma.$disconnect();
    }
}

fixAffiliates();
