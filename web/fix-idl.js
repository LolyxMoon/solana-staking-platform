const fs = require('fs');
const idl = JSON.parse(fs.readFileSync('./lib/staking.json', 'utf8'));

// Find Platform, Project, Stake in types section
const accountTypes = ['Platform', 'Project', 'Stake'];
const typeDefinitions = {};

if (idl.types) {
  idl.types.forEach(type => {
    if (accountTypes.includes(type.name)) {
      typeDefinitions[type.name] = type.type;
    }
  });
}

console.log('Found type definitions for:', Object.keys(typeDefinitions));

// Update accounts array to include type definitions
if (idl.accounts) {
  idl.accounts = idl.accounts.map(account => {
    if (typeDefinitions[account.name]) {
      console.log(`✅ Adding type definition to ${account.name}`);
      return {
        ...account,
        type: typeDefinitions[account.name]
      };
    }
    return account;
  });
}

// Save the fixed IDL
fs.writeFileSync('./lib/staking.json', JSON.stringify(idl, null, 2));
console.log('✅ IDL fixed! Account types now have full definitions.');
