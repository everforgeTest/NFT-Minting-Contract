const { Tables } = require("../../Constants/Tables");
const { ContractResponseTypes } = require("../../Constants/ContractResponses");
const { SqliteDatabase } = require("../Common.Services/dbHandler");
const { SharedService } = require("../Common.Services/SharedService");

class NftService {
	constructor(dbPath) {
		this.dbPath = dbPath;
		this.db = new SqliteDatabase(dbPath);
	}

	_validateMint(data) {
		if (!data || typeof data !== "object") return "Missing data.";
		if (!data.name || typeof data.name !== "string" || !data.name.trim()) return "name is required.";
		if (data.name.length > 120) return "name is too long.";
		if (data.description != null && typeof data.description !== "string") return "description must be a string.";
		if (data.mediaUrl != null && typeof data.mediaUrl !== "string") return "mediaUrl must be a string.";
		return null;
	}

	async mint(userPubKeyHex, data) {
		const err = this._validateMint(data);
		if (err) {
			return { error: { code: ContractResponseTypes.BAD_REQUEST, message: err } };
		}

		this.db.open();
		try {
			const now = SharedService.getCurrentTimestamp();
			const res = await this.db.runQuery(
				`INSERT INTO ${Tables.NFT} (OwnerPubKey, Name, Description, MediaUrl, CreatedOn) VALUES (?, ?, ?, ?, ?)` ,
				[userPubKeyHex, data.name.trim(), data.description || "", data.mediaUrl || null, now]
			);
			return { success: { id: res.lastId } };
		} finally {
			this.db.close();
		}
	}

	async getById(id) {
		const nftId = parseInt(id, 10);
		if (!Number.isFinite(nftId) || nftId <= 0) {
			return { error: { code: ContractResponseTypes.BAD_REQUEST, message: "Invalid id." } };
		}
		this.db.open();
		try {
			const row = await this.db.getOne(`SELECT * FROM ${Tables.NFT} WHERE Id = ?`, [nftId]);
			if (!row) return { error: { code: ContractResponseTypes.NOT_FOUND, message: "NFT not found." } };
			return { success: row };
		} finally {
			this.db.close();
		}
	}

	async getByOwner(ownerPubKey) {
		if (!ownerPubKey || typeof ownerPubKey !== "string") {
			return { error: { code: ContractResponseTypes.BAD_REQUEST, message: "ownerPubKey is required." } };
		}
		this.db.open();
		try {
			const rows = await this.db.runSelectQuery(
				`SELECT * FROM ${Tables.NFT} WHERE OwnerPubKey = ? ORDER BY Id DESC`,
				[ownerPubKey.toLowerCase()],
			);
			return { success: rows };
		} finally {
			this.db.close();
		}
	}

	async getAll(page, pageSize) {
		const p = Number.isFinite(parseInt(page, 10)) ? parseInt(page, 10) : 1;
		const ps = Number.isFinite(parseInt(pageSize, 10)) ? parseInt(pageSize, 10) : 20;
		const safePage = p <= 0 ? 1 : p;
		const safeSize = ps <= 0 ? 20 : Math.min(ps, 100);
		const offset = (safePage - 1) * safeSize;

		this.db.open();
		try {
			const rows = await this.db.runSelectQuery(
				`SELECT * FROM ${Tables.NFT} ORDER BY Id DESC LIMIT ? OFFSET ?`,
				[safeSize, offset],
			);
			return { success: { page: safePage, pageSize: safeSize, data: rows } };
		} finally {
			this.db.close();
		}
	}
}

module.exports = { NftService };
