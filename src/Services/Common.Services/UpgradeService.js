const { FileService } = require("./FileService");
const { Tables } = require("../../Constants/Tables");
const { ContractResponseTypes } = require("../../Constants/ContractResponses");
const settings = require("../../settings.json").settings;
const { SqliteDatabase } = require("./dbHandler");

class UpgradeService {
	constructor(dbPath) {
		this.dbPath = dbPath;
		this.db = new SqliteDatabase(dbPath);
	}

	async upgradeContract(zipBuffer, version, description) {
		let resObj = {};
		this.db.open();
		try {
			const row = await this.db.getOne(
				`SELECT Version FROM ${Tables.CONTRACTVERSION} ORDER BY Id DESC LIMIT 1`,
				[],
			);
			const currentVersion = row && row.Version != null ? parseFloat(row.Version) : 1.0;
			const incomingVersion = parseFloat(version);

			if (!Number.isFinite(incomingVersion)) {
				resObj.error = { code: ContractResponseTypes.BAD_REQUEST, message: "Invalid version." };
				return resObj;
			}

			if (incomingVersion <= currentVersion) {
				resObj.error = {
					code: ContractResponseTypes.FORBIDDEN,
					message: `Incoming version (${incomingVersion}) must be greater than current version (${currentVersion}).`
				};
				return resObj;
			}

			FileService.writeFile(settings.newContractZipFileName, zipBuffer);

			const shellScriptContent = `#!/bin/bash

echo "I am the post script"

! command -v unzip &>/dev/null && apt-get update && apt-get install --no-install-recommends -y unzip

zip_file="${settings.newContractZipFileName}"

unzip -o -d ./ "$zip_file" >>/dev/null

echo "Zip file '$zip_file' has been successfully unzipped and its contents have been written to the current directory."

rm "$zip_file" >>/dev/null
`;
			FileService.writeFile(settings.postExecutionScriptName, shellScriptContent);
			FileService.changeMode(settings.postExecutionScriptName, 0o777);

			await this.db.runQuery(
				`INSERT INTO ${Tables.CONTRACTVERSION} (Version, Description, CreatedOn, LastUpdatedOn) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
				[incomingVersion, description || ""],
			);

			resObj.success = { message: "Contract upgraded", version: incomingVersion };
			return resObj;
		} catch (e) {
			resObj.error = {
				code: ContractResponseTypes.INTERNAL_SERVER_ERROR,
				message: e && e.message ? e.message : "Failed to upgrade contract."
			};
			return resObj;
		} finally {
			this.db.close();
		}
	}
}

module.exports = { UpgradeService };
