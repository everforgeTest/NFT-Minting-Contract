const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const settings = require("../settings.json").settings;
const { Tables } = require("../Constants/Tables");

class DBInitializer {
	static db = null;

	static async init() {
		if (!fs.existsSync(settings.dbPath)) {
			this.db = new sqlite3.Database(settings.dbPath);
			await this.#runQuery("PRAGMA foreign_keys = ON");

			await this.#runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.CONTRACTVERSION} (
				Id INTEGER,
				Version FLOAT NOT NULL,
				Description TEXT,
				CreatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,
				LastUpdatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY("Id" AUTOINCREMENT)
			)`);

			await this.#runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.SQLSCRIPTMIGRATIONS} (
				Id INTEGER,
				Sprint TEXT NOT NULL,
				ScriptName TEXT NOT NULL,
				ExecutedTimestamp TEXT,
				ConcurrencyKey TEXT CHECK (ConcurrencyKey LIKE '0x%' AND length(ConcurrencyKey) = 18),
				PRIMARY KEY("Id" AUTOINCREMENT)
			)`);

			await this.#runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.NFT} (
				Id INTEGER,
				OwnerPubKey TEXT NOT NULL,
				Name TEXT NOT NULL,
				Description TEXT,
				MediaUrl TEXT,
				CreatedOn TEXT NOT NULL,
				PRIMARY KEY("Id" AUTOINCREMENT)
			)`);

			await this.#runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.NFT_ATTRIBUTES} (
				Id INTEGER,
				NftId INTEGER NOT NULL,
				TraitType TEXT NOT NULL,
				Value TEXT NOT NULL,
				PRIMARY KEY("Id" AUTOINCREMENT),
				FOREIGN KEY(NftId) REFERENCES ${Tables.NFT}(Id) ON DELETE CASCADE
			)`);

			this.db.close();
			this.db = null;
		}

		// Run migration scripts (optional structure)
		if (fs.existsSync(settings.dbPath)) {
			this.db = new sqlite3.Database(settings.dbPath);

			const lastRow = await this.#getRecord(
				`SELECT Sprint FROM ${Tables.SQLSCRIPTMIGRATIONS} ORDER BY Sprint DESC LIMIT 1`,
				[],
			);
			const lastExecutedSprint = lastRow ? lastRow.Sprint : "Sprint_00";

			if (fs.existsSync(settings.dbScriptsFolderPath)) {
				const scriptFolders = fs
					.readdirSync(settings.dbScriptsFolderPath)
					.filter(folder => folder.startsWith("Sprint_") && folder >= lastExecutedSprint)
					.sort();

				for (const sprintFolder of scriptFolders) {
					const sprintFolderPath = path.join(settings.dbScriptsFolderPath, sprintFolder);
					const sqlFiles = fs
						.readdirSync(sprintFolderPath)
						.filter(file => file.match(/^\d+_.+\.sql$/))
						.sort();

					for (const sqlFile of sqlFiles) {
						const already = await this.#getRecord(
							`SELECT * FROM ${Tables.SQLSCRIPTMIGRATIONS} WHERE Sprint = ? AND ScriptName = ?`,
							[sprintFolder, sqlFile],
						);
						if (already) continue;

						const scriptPath = path.join(sprintFolderPath, sqlFile);
						const sqlScript = fs.readFileSync(scriptPath, "utf8");
						const sqlStatements = sqlScript
							.split(";")
							.map(stmt => stmt.split(/\?\
/).map(line => (line.trim().startsWith("--") ? "" : line)).join("\
"))
							.filter(stmt => stmt.trim() !== "");

						for (const stmt of sqlStatements) {
							await this.#runQuery(stmt);
						}

						await this.#runQuery(
							`INSERT INTO ${Tables.SQLSCRIPTMIGRATIONS} (Sprint, ScriptName, ExecutedTimestamp) VALUES (?, ?, datetime('now'))`,
							[sprintFolder, sqlFile],
						);
					}
				}
			}

			this.db.close();
			this.db = null;
		}
	}

	static #runQuery(query, params) {
		return new Promise((resolve, reject) => {
			this.db.run(query, params || [], function (err) {
				if (err) return reject(err);
				resolve({ lastId: this.lastID, changes: this.changes });
			});
		});
	}

	static #getRecord(query, params) {
		return new Promise((resolve, reject) => {
			this.db.get(query, params || [], (err, row) => {
				if (err) return reject(err);
				resolve(row);
			});
		});
	}
}

module.exports = { DBInitializer };
