// Tiny JSON-file "database": data/<name>.json
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'data');

function read(name) {
  const file = path.join(dir, name + '.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
}
function write(name, data) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(data, null, 2));
}
module.exports = { read, write };
