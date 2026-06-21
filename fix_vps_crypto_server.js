const { Client } = require('ssh2');

const conn = new Client();

const script = `
const fs = require('fs');
const path = '/root/AuraCrypto/server.ts';
let c = fs.readFileSync(path, 'utf8');
c = c.replace(/'sua_chave_jwt_super_secreta_e_longa_aqui_12345'/g, '"AuraForexSuperChaveSecretaDeProducao2026"');
c = c.replace(/'secret'/g, '"AuraForexSuperChaveSecretaDeProducao2026"');
fs.writeFileSync(path, c);
console.log('Fixed server.ts');
`;

conn.on('ready', () => {
    conn.exec(`echo "${script.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" > /root/fix_crypto_server.js && node /root/fix_crypto_server.js && npx pm2 restart aura-crypto`, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end())
        .on('data', data => process.stdout.write(data))
        .stderr.on('data', data => process.stderr.write(data));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
