/**
 * Makes the page players open on the self-hosted VM (index.html): the
 * client's testclient-old.html, set to connect to the game server on the same
 * site and to log in through the login server on the same site.
 *
 * Usage: node make-client-index.cjs CLIENT_DIR/play.pokemonshowdown.com
 */
'use strict';

const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) {
	console.error('Usage: node make-client-index.cjs CLIENT_DIR/play.pokemonshowdown.com');
	process.exit(2);
}

let html = fs.readFileSync(path.join(dir, 'testclient-old.html'), 'utf8');
const marker = 'Config.testclient = true;';
if (!html.includes(marker)) {
	console.error('testclient-old.html has changed, so index.html could not be made. tools/vm/make-client-index.cjs needs updating.');
	process.exit(1);
}
html = html.replace(
	marker,
	`${marker} Config.ownLoginServer = true; ` +
	`Config.server = { id: location.hostname, host: location.hostname, port: 443 };`
);
// (only for the test client run on your own computer)
html = html.replace('<script src="../config/testclient-key.js"></script>', '');
html = html.replace(
	/<h4>Test client<\/h4><p>[^<]*<\/p>(<p>&mdash;.*?<\/p>)?/,
	'<h4>Welcome!</h4><p>Click <strong>Choose name</strong> at the top right to register or log in.</p>'
);
fs.writeFileSync(path.join(dir, 'index.html'), html);
console.log('Made index.html');
