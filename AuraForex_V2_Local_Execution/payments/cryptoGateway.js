const { ethers } = require('ethers');
const crypto = require('crypto');
require('dotenv').config();

// BSC RPC Node (Fallback to public node if not provided)
const RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
const provider = new ethers.JsonRpcProvider(RPC_URL);

// USDT Contract Address on BSC (BEP20)
const USDT_CONTRACT_ADDRESS = process.env.USDT_CONTRACT_ADDRESS || '0x55d398326f99059fF775485246999027B3197955';

// ERC20/BEP20 minimal ABI to check balance and transfer
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint amount) returns (bool)",
    "function decimals() view returns (uint8)"
];

/**
 * Encripta uma chave privada para a guardar em segurança na base de dados
 */
function encryptPrivateKey(privateKey) {
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

/**
 * Desencripta a chave privada lida da base de dados
 */
function decryptPrivateKey(encryptedText) {
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

/**
 * Gera uma nova carteira temporária para receber o pagamento.
 * Retorna o endereço público e a chave privada encriptada.
 */
function generatePaymentWallet() {
    const wallet = ethers.Wallet.createRandom();
    const encryptedPK = encryptPrivateKey(wallet.privateKey);
    return {
        address: wallet.address,
        encryptedPK: encryptedPK
    };
}

/**
 * Verifica o saldo de USDT (ou outro token BEP20) de uma morada
 */
async function getTokenBalance(walletAddress) {
    const contract = new ethers.Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, provider);
    const balanceWei = await contract.balanceOf(walletAddress);
    const decimals = await contract.decimals();
    // Converter de Wei para unidade legível (USDT usa 18 decimais na BSC)
    const balance = ethers.formatUnits(balanceWei, decimals);
    return parseFloat(balance);
}

/**
 * Inicia a varredura (Sweep). 
 * 1. A Gas Wallet (Admin) envia um pequeno valor de BNB para a Temporary Wallet.
 * 2. A Temporary Wallet envia todo o seu USDT para a Cold Wallet (Admin).
 */
async function sweepFunds(encryptedTempPK, adminColdWalletAddress, bnbGasAmount = '0.0005') {
    if (!process.env.GAS_WALLET_PRIVATE_KEY) {
        throw new Error("GAS_WALLET_PRIVATE_KEY não configurada no .env");
    }

    // 1. Instanciar as carteiras
    const gasWallet = new ethers.Wallet(process.env.GAS_WALLET_PRIVATE_KEY, provider);
    
    const tempPK = decryptPrivateKey(encryptedTempPK);
    const tempWallet = new ethers.Wallet(tempPK, provider);

    console.log(`[SWEEP] Iniciando varredura da carteira ${tempWallet.address}`);
    
    // 2. Verificar se a Gas Wallet tem BNB suficiente
    const gasWalletBalance = await provider.getBalance(gasWallet.address);
    const gasRequired = ethers.parseEther(bnbGasAmount);
    
    if (gasWalletBalance < gasRequired) {
        throw new Error(`Gas Wallet (${gasWallet.address}) não tem BNB suficiente para a taxa.`);
    }

    // 3. Enviar BNB (Gas) para a carteira temporária
    console.log(`[SWEEP] Enviando ${bnbGasAmount} BNB para a carteira temporária...`);
    const gasTx = await gasWallet.sendTransaction({
        to: tempWallet.address,
        value: gasRequired
    });
    console.log(`[SWEEP] Tx BNB enviada (Hash: ${gasTx.hash}). Aguardando confirmação...`);
    await gasTx.wait(1); // Esperar 1 bloco de confirmação
    console.log(`[SWEEP] BNB recebido na carteira temporária!`);

    // 4. Conectar ao contrato do Token e varrer o saldo
    const tokenContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, tempWallet);
    const tokenBalanceWei = await tokenContract.balanceOf(tempWallet.address);
    
    if (tokenBalanceWei == 0n) { // ethers v6 usa bigint para comparar zero
        throw new Error("A carteira temporária não tem saldo de Token para transferir.");
    }

    console.log(`[SWEEP] Transferindo USDT para Cold Wallet (${adminColdWalletAddress})...`);
    // Envia todo o saldo para a carteira fria
    const transferTx = await tokenContract.transfer(adminColdWalletAddress, tokenBalanceWei);
    console.log(`[SWEEP] Transferência de USDT enviada (Hash: ${transferTx.hash}). Aguardando confirmação...`);
    await transferTx.wait(1);
    console.log(`[SWEEP] Varredura concluída com sucesso!`);

    return transferTx.hash;
}

module.exports = {
    generatePaymentWallet,
    getTokenBalance,
    sweepFunds,
    encryptPrivateKey,
    decryptPrivateKey
};
