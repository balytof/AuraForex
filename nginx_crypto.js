const { Client } = require('ssh2');

const conn = new Client();

const nginxConfig = `
server {
    listen 80;
    server_name crypto.auratradebots.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
`;

conn.on('ready', () => {
    console.log('Configuring Nginx for crypto.auratradebots.com...');
    const cmd = `
        echo "${nginxConfig.replace(/\$/g, '\\$').replace(/"/g, '\\"')}" > /etc/nginx/sites-available/auracrypto &&
        ln -sf /etc/nginx/sites-available/auracrypto /etc/nginx/sites-enabled/auracrypto &&
        nginx -t &&
        systemctl restart nginx
    `;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('Nginx successfully configured.');
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
