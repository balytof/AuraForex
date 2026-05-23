const fs = require('fs');
let txt = fs.readFileSync('server.js', 'utf8');
const regex = /app\.(post|get|delete)\(\"\/api\/user\/pamm\/[^\"]*\"/g;
let match;
while ((match = regex.exec(txt)) !== null) {
  console.log(match[0]);
}
