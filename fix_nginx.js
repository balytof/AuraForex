const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Corrigindo Nginx...');
    
    const nginxConfig = `server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
`;

    conn.sftp((err, sftp) => {
        if (err) throw err;
        const stream = sftp.createWriteStream('/etc/nginx/sites-enabled/auraforex');
        stream.end(nginxConfig);
        stream.on('close', () => {
            console.log('✅ Nginx Config atualizada para porta 3005');
            
            conn.exec('nginx -s reload', (err, stream) => {
                if (err) throw err;
                stream.on('close', () => {
                    console.log('✨ NGINX RECARREGADO! O site deve estar de volta.');
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
