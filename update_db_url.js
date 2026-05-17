const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const settings = await prisma.systemSettings.findFirst();
        if (settings) {
            await prisma.systemSettings.update({
                where: { id: settings.id },
                data: {
                    apiUrl: "https://www.auratradebots.com/api"
                }
            });
            console.log("System Settings API URL updated to: https://www.auratradebots.com/api");
        } else {
            await prisma.systemSettings.create({
                data: {
                    apiUrl: "https://www.auratradebots.com/api",
                    installationGuide: ""
                }
            });
            console.log("System Settings created with API URL: https://www.auratradebots.com/api");
        }
    } catch (e) {
        console.error("Error updating DB:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
