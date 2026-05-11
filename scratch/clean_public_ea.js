const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Limpando ficheiros .mq5 e .ex5 da pasta pública no VPS...');
    const cmd = 'rm -f /root/AuraForex/public/*.mq5 /root/AuraForex/public/*.ex5';
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('✅ Pasta pública limpa.');
            
            // Agora recolocar o ficheiro correto
            console.log('📦 Repondo a versão correta: AURA_PRO_FINAL.mq5...');
            const cmd2 = 'cp /root/AuraForex/AURA_PRO_FINAL.mq5 /root/AuraForex/public/AURA_PRO_FINAL.mq5';
            conn.exec(cmd2, (err2, stream2) => {
                if (err2) throw err2;
                stream2.on('close', () => {
                    console.log('✨ Operação concluída. Apenas a V6.0 está na pasta pública agora.');
                    conn.end();
                });
            });
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
