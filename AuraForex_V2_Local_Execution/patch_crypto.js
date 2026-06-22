const { Client } = require('ssh2');

const mainTsxContent = `import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';

// SSO Token Interception
const urlParams = new URLSearchParams(window.location.search);
const ssoToken = urlParams.get('sso_token');
if (ssoToken) {
  localStorage.setItem('token', ssoToken);
  const newUrl = new URL(window.location.href);
  newUrl.searchParams.delete('sso_token');
  window.history.replaceState({}, document.title, newUrl.toString());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  
  // Replace the file content and build
  const cmd = `cat << 'EOF' > /root/AuraCrypto/src/main.tsx
${mainTsxContent}
EOF
cd /root/AuraCrypto && npm run build && pm2 restart aura-crypto`;

  console.log('Executing build on server...');
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Deploy finished with code', code);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
