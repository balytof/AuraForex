const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Corrigindo link de download no dashboard HTML...');
    
    // Substituir .mq5 por .ex5 no link e no texto do botão
    const cmd = "sed -i 's/href=\"\\/AURA_PRO_FINAL.mq5\"/href=\"\\/SMC_APEX_EA.ex5\"/g' /root/AuraForex/smc_bot_dashboard.html && sed -i 's/DOWNLOAD AURA_PRO_FINAL.mq5/DOWNLOAD SMC_APEX_EA.ex5/g' /root/AuraForex/smc_bot_dashboard.html";

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('✅ Dashboard HTML corrigido.');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
