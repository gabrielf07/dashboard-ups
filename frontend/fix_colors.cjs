const fs = require('fs');
const path = 'src/App.tsx';
let c = fs.readFileSync(path, 'utf8');
c = c.replace(/1px solid rgba\(255,255,255,0\.\d\)/g, '1px solid var(--glass-border)');
c = c.replace(/color: 'rgba\(255,255,255,0\.\d\)'/g, "color: 'var(--text-secondary)'");
c = c.replace(/color: 'white'/g, "color: 'var(--text-primary)'");
c = c.replace(/background: 'rgba\(0,0,0,0\.2\)'/g, "background: 'var(--input-bg)'");
fs.writeFileSync(path, c);
console.log('Colors fixed in App.tsx');
