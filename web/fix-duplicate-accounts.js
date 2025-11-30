const fs = require('fs');
const idl = JSON.parse(fs.readFileSync('lib/staking.json', 'utf-8'));

// Remove Platform, Project, and Stake from types array (they belong in accounts only)
idl.types = idl.types.filter(t => 
  !['Platform', 'Project', 'Stake'].includes(t.name)
);

fs.writeFileSync('lib/staking.json', JSON.stringify(idl, null, 2));
console.log('✅ Removed duplicate account definitions from types array');
console.log('Remaining types:', idl.types.length);
