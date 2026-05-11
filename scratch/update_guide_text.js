const prisma = require('./db');

async function main() {
  const newUrl = "http://139.59.159.48:3005/api";
  const newGuide = `### 💡 Orientações Importantes:
1. Certifique-se de que o Algotrading está verde no MT5.
2. Adicione ${newUrl} na lista de URLs permitidos.
3. Utilize o par EURUSD no timeframe H1 para melhores resultados.
4. Sua chave de licença deve ser inserida exatamente como aparece no seu dashboard.`;

  console.log('🚀 Updating Installation Guide to reflect the new IP...');
  
  try {
    const settings = await prisma.systemSettings.findFirst();
    if (settings) {
      const updated = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: { installationGuide: newGuide }
      });
      console.log('✅ Updated Guide:', updated.installationGuide);
    }
  } catch (err) {
    console.error('❌ Error updating guide:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
