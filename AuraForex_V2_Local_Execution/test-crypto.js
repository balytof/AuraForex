const { generatePaymentWallet, decryptPrivateKey, getTokenBalance } = require('./payments/cryptoGateway');

async function runTest() {
    console.log("=== TESTE DE LEITURA BSC (USDT) ===");
    try {
        // Binance Hot Wallet 6
        const address = "0x8894E0a0c962CB723c1976a4421c95949bE2D4E3";
        console.log(`Lendo o saldo USDT da carteira: ${address}`);
        
        const balance = await getTokenBalance(address);
        console.log(`Saldo USDT: $${balance}`);
        
        if (balance > 0) {
            console.log("\n[SUCESSO] Comunicação com o Blockchain da BSC (BEP20) a funcionar perfeitamente!");
        } else {
            console.log("\n[AVISO] Saldo zero, mas comunicação ok.");
        }
    } catch (e) {
        console.error("ERRO na BSC:", e.message);
    }
}

runTest();
