const { Client } = require('ssh2');

const conn = new Client();

const nginxForexConfig = `
server {
    listen 80 default_server;
    server_name auratradebots.com www.auratradebots.com _;

    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
`;

conn.on('ready', () => {
    console.log('Fixing Nginx for auraforex...');
    const cmd = `
        echo "${nginxForexConfig.replace(/\$/g, '\\$').replace(/"/g, '\\"')}" > /etc/nginx/sites-available/auraforex &&
        nginx -t &&
        systemctl restart nginx
    `;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('Nginx successfully fixed.');
            conn.end();
        }).on('data', data => process.stdout.write(data))
        .stderr.on('data', data => process.stderr.write(data));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
