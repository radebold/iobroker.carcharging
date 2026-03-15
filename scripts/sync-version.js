
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('./package.json'));
const ioPkg = JSON.parse(fs.readFileSync('./io-package.json'));
ioPkg.common.version = pkg.version;
ioPkg.native.version = pkg.version;
ioPkg.version = pkg.version;
fs.writeFileSync('./io-package.json', JSON.stringify(ioPkg, null, 2) + '
');
console.log(`Version synchronized: ${pkg.version}`);
