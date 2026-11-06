const {randomBytes} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {parse} = require('dotenv');

const target = path.join(__dirname, '../.env');
const template = fs.readFileSync(path.join(__dirname, '../.env.example'), 'utf8');
let content = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : template;
const current = parse(content);
for (const [key, value] of Object.entries(parse(template))) {
  if (!(key in current)) content += `\n${key}=${value}`;
}
if (!current.JWT_SECRET) {
  const secret = randomBytes(48).toString('hex');
  content = content.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`);
}
fs.writeFileSync(target, content.endsWith('\n') ? content : `${content}\n`);
console.log('Environment file prepared; existing values were preserved.');
