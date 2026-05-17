const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const settings = await prisma.systemSettings.findFirst();
        if (settings) {
            const updatedGuide = settings.installationGuide 
                ? settings.installationGuide.replace(/http:\/\/139\.59\.159\.48:3005\/api/g, "https://www.auratradebots.com/api") 
                : "";
            await prisma.systemSettings.update({
                where: { id: settings.id },
                data: {
                    apiUrl: "https://www.auratradebots.com/api",
                    installationGuide: updatedGuide
                }
            });
            console.log("System Settings API URL and Guide updated to: https://www.auratradebots.com/api");
        } else {
            await prisma.systemSettings.create({
                data: {
                    apiUrl: "https://www.auratradebots.com/api",
                    installationGuide: "### 💡 Orientações Importantes:\n1. Certifique-se de que o Algotrading está verde no MT5.\n2. Adicione https://www.auratradebots.com/api na lista de URLs permitidos.\n3. Utilize o par EURUSD no timeframe H1 para melhores resultados.\n4. Sua chave de licença deve ser inserida exatamente como aparece no seu dashboard."
                }
            });
            console.log("System Settings created with API URL and default Guide pointing to: https://www.auratradebots.com/api");
        }
    } catch (e) {
        console.error("Error updating DB:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
