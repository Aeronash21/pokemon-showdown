/**
 * Small jobs on the self-hosted login server's account database (SQLite),
 * for tools/vm/install.sh.
 *
 *   node login-db.cjs init DATABASE_FILE SCHEMA_FILE
 *       Creates the database's tables (only use on a new database).
 *   node login-db.cjs has-user DATABASE_FILE USERNAME
 *       Exits with 0 if the name is registered, 1 if not.
 *   node login-db.cjs set-password LOGINSERVER_DIR DATABASE_FILE USERNAME < password
 *       Registers the name, or changes its password if it's registered. The
 *       password comes from standard input, so it never shows up in the
 *       process list or shell history.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const toID = name => `${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '');
const usage = () => {
	console.error('Usage: node login-db.cjs init DB SCHEMA | has-user DB NAME | set-password LOGINDIR DB NAME < password');
	process.exit(2);
};

const [command, ...args] = process.argv.slice(2);

if (command === 'init') {
	const [dbPath, schemaPath] = args;
	if (!dbPath || !schemaPath) usage();
	const db = new DatabaseSync(dbPath);
	db.exec(fs.readFileSync(schemaPath, 'utf8'));
	db.close();
} else if (command === 'has-user') {
	const [dbPath, username] = args;
	if (!dbPath || !username) usage();
	const db = new DatabaseSync(dbPath, { readOnly: true });
	const row = db.prepare('SELECT 1 FROM users WHERE userid = ?').get(toID(username));
	db.close();
	process.exit(row ? 0 : 1);
} else if (command === 'set-password') {
	const [loginDir, dbPath, username] = args;
	if (!loginDir || !dbPath || !username) usage();
	const userid = toID(username);
	if (!/[a-z]/.test(userid) || userid.length > 18 || userid.startsWith('guest')) {
		console.error(`"${username}" isn't a valid username.`);
		process.exit(1);
	}
	let password = '';
	process.stdin.setEncoding('utf8');
	process.stdin.on('data', chunk => { password += chunk; });
	process.stdin.on('end', async () => {
		password = password.replace(/\r?\n$/, '');
		if (password.replace(/\s/g, '').length < 5) {
			console.error('The password must have at least 5 characters.');
			process.exit(1);
		}
		// the same hashing the login server uses (bcrypt, its default 10 rounds)
		const bcrypt = require(path.join(path.resolve(loginDir), 'node_modules', 'bcrypt'));
		const hash = await bcrypt.hash(password, 10);
		const db = new DatabaseSync(dbPath);
		db.prepare(
			`INSERT INTO users (userid, username, passwordhash, email, registertime, ip) VALUES (?, ?, ?, NULL, ?, '') ` +
			`ON CONFLICT(userid) DO UPDATE SET passwordhash = excluded.passwordhash`
		).run(userid, username, hash, Math.floor(Date.now() / 1000));
		db.close();
		console.log(`"${username}" is registered on your login server.`);
	});
} else {
	usage();
}
