-- SQLite tables for the Pokémon Showdown login server (smogon/pokemon-showdown-loginserver).
-- The CREATE statements from its src/test/fixtures/database.sql (commit fed2f4a, test data left out),
-- plus the teams table. tools/vm/install.sh loads this into a new database only.

CREATE TABLE users (
	userid TEXT PRIMARY KEY,
	usernum INTEGER UNIQUE,
	username TEXT NOT NULL,
	nonce TEXT,
	passwordhash TEXT,
	email TEXT,
	registertime INTEGER NOT NULL DEFAULT 0,
	"group" INTEGER NOT NULL DEFAULT 1,
	banstate INTEGER NOT NULL DEFAULT 0,
	ip TEXT NOT NULL DEFAULT '',
	avatar INTEGER NOT NULL DEFAULT 0,
	logintime INTEGER NOT NULL DEFAULT 0,
	loginip TEXT
);

CREATE TABLE sessions (
	session INTEGER PRIMARY KEY AUTOINCREMENT,
	sid TEXT NOT NULL,
	userid TEXT NOT NULL,
	time INTEGER NOT NULL,
	timeout INTEGER NOT NULL,
	ip TEXT NOT NULL
);

CREATE TABLE userstats (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	serverid TEXT NOT NULL UNIQUE,
	usercount INTEGER NOT NULL,
	date INTEGER NOT NULL
);

CREATE TABLE userstatshistory (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	date INTEGER NOT NULL,
	usercount INTEGER NOT NULL,
	programid TEXT NOT NULL DEFAULT 'showdown'
);

CREATE TABLE loginthrottle (
	ip TEXT PRIMARY KEY,
	count INTEGER NOT NULL,
	time INTEGER NOT NULL,
	lastuserid TEXT NOT NULL
);

CREATE TABLE loginattempts (
	userid TEXT PRIMARY KEY,
	count INTEGER NOT NULL,
	time INTEGER NOT NULL
);

CREATE TABLE oauth_clients (
	owner TEXT NOT NULL,
	client_title TEXT NOT NULL,
	origin_url TEXT NOT NULL,
	id TEXT PRIMARY KEY
);

CREATE TABLE oauth_tokens (
	owner TEXT NOT NULL,
	client TEXT NOT NULL,
	id TEXT PRIMARY KEY,
	time INTEGER NOT NULL
);

CREATE TABLE usermodlog (
	entryid INTEGER PRIMARY KEY AUTOINCREMENT,
	userid TEXT NOT NULL,
	actorid TEXT NOT NULL,
	date INTEGER NOT NULL,
	ip TEXT NOT NULL,
	entry TEXT NOT NULL
);

CREATE TABLE ladder (
	entryid INTEGER PRIMARY KEY AUTOINCREMENT,
	formatid TEXT NOT NULL,
	userid TEXT NOT NULL,
	username TEXT NOT NULL,
	w INTEGER NOT NULL DEFAULT 0,
	l INTEGER NOT NULL DEFAULT 0,
	t INTEGER NOT NULL DEFAULT 0,
	gxe REAL NOT NULL DEFAULT 0,
	r REAL NOT NULL DEFAULT 1500,
	rd REAL NOT NULL DEFAULT 130,
	sigma REAL NOT NULL DEFAULT 0,
	rptime INTEGER NOT NULL,
	rpr REAL NOT NULL DEFAULT 1500,
	rprd REAL NOT NULL DEFAULT 130,
	rpsigma REAL NOT NULL DEFAULT 0,
	rpdata TEXT NOT NULL DEFAULT '',
	elo REAL NOT NULL DEFAULT 1000,
	col1 REAL NOT NULL DEFAULT 0,
	oldelo REAL NOT NULL DEFAULT 1000,
	first_played INTEGER NOT NULL DEFAULT 0,
	last_played INTEGER NOT NULL DEFAULT 0,
	UNIQUE (userid, formatid)
);

CREATE TABLE suspects (
	formatid TEXT PRIMARY KEY,
	start_date INTEGER NOT NULL,
	elo INTEGER,
	coil INTEGER,
	gxe INTEGER
);

CREATE TABLE replayprep (
	id TEXT PRIMARY KEY,
	format TEXT NOT NULL,
	players TEXT NOT NULL,
	private INTEGER NOT NULL DEFAULT 0,
	loghash TEXT NOT NULL,
	inputlog TEXT NOT NULL,
	rating INTEGER NOT NULL DEFAULT 0,
	uploadtime INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE replays (
	id TEXT PRIMARY KEY,
	format TEXT NOT NULL,
	players TEXT NOT NULL,
	log TEXT NOT NULL DEFAULT '',
	inputlog TEXT,
	uploadtime INTEGER NOT NULL DEFAULT 0,
	views INTEGER NOT NULL DEFAULT 0,
	formatid TEXT NOT NULL DEFAULT '',
	rating INTEGER,
	private INTEGER NOT NULL DEFAULT 0,
	password TEXT
);

CREATE TABLE replayplayers (
	playerid TEXT NOT NULL,
	formatid TEXT NOT NULL,
	id TEXT NOT NULL,
	rating INTEGER,
	uploadtime INTEGER NOT NULL,
	private INTEGER NOT NULL DEFAULT 0,
	password TEXT,
	format TEXT NOT NULL,
	players TEXT NOT NULL,
	PRIMARY KEY (id, playerid)
);

CREATE TABLE teams (
	teamid TEXT PRIMARY KEY,
	ownerid TEXT NOT NULL,
	team TEXT NOT NULL,
	format TEXT NOT NULL,
	title TEXT NOT NULL,
	private TEXT NOT NULL,
	views INTEGER NOT NULL DEFAULT 0
);
