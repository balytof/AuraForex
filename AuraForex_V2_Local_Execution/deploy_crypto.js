const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec('pm2 jlist', (err, stream) => {
    if (err) throw err;
    let data = '';
    stream.on('close', (code, signal) => {
      try {
        const pm2List = JSON.parse(data);
        if (pm2List.length === 0) {
           console.log("No PM2 processes found.");
           conn.end();
           return;
        }
        
        console.log("PM2 Apps running:");
        let appPath = null;
        let appName = null;

        for (const app of pm2List) {
           console.log(`- ${app.name} at ${app.pm2_env.pm_cwd}`);
           if (app.name.toLowerCase().includes('crypto') || app.pm2_env.pm_cwd.includes('auratradebotslast')) {
               appPath = app.pm2_env.pm_cwd;
               appName = app.name;
           }
        }
        
        if (!appPath) {
           console.log("Could not find crypto app specifically. Using the first one just in case...");
           appPath = pm2List[0].pm2_env.pm_cwd;
           appName = pm2List[0].name;
        }

        console.log(`\nTargeting app '${appName}' at: ${appPath}`);
        
        // Command to update
        const deployCmd = `cd "${appPath}" && git fetch origin && git reset --hard origin/main && npm install && npm run build && pm2 restart ${appName}`;
        console.log("Executing:", deployCmd);
        
        conn.exec(deployCmd, (err, deployStream) => {
           if (err) throw err;
           deployStream.on('close', (code, signal) => {
             console.log('Deploy finished with code', code);
             conn.end();
           }).on('data', (data) => {
             console.log('DEPLOY OUT: ' + data);
           }).stderr.on('data', (data) => {
             console.log('DEPLOY ERR: ' + data);
           });
        });

      } catch (e) {
        console.log("Error parsing pm2 jlist:", e);
        conn.end();
      }
    }).on('data', (d) => {
      data += d.toString();
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
