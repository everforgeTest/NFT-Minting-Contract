const nacl = require("tweetnacl");
const { ContractResponseTypes } = require("../Constants/ContractResponses");
const settings = require("../settings.json").settings;
const Env = require("../Utils/Env");
const { UpgradeService } = require("../Services/Common.Services/UpgradeService");

function hexToUint8(hex) {
	if (!hex || typeof hex !== "string") return null;
	const clean = hex.toLowerCase().startsWith("0x") ? hex.slice(2) : hex;
	if (!/^[0-9a-f]+$/.test(clean)) return null;
	if (clean.length % 2 !== 0) return null;
	return new Uint8Array(Buffer.from(clean, "hex"));
}

function isMaintainer(userPubKeyHex) {
	const expected = (Env.get("MAINTAINER_PUBKEY") || "").toLowerCase();
	if (!expected) return false;
	if (!userPubKeyHex) return false;
	return userPubKeyHex.toLowerCase() === expected;
}

class UpgradeController {
	constructor(message) {
		this.message = message;
		this.service = new UpgradeService(settings.dbPath);
	}

	async handleRequest(user) {
		try {
			if (this.message.Action !== "UpgradeContract") {
				return { error: { code: ContractResponseTypes.BAD_REQUEST, message: "Invalid action." } };
			}

			const userPub = (user.pubKey || "").toLowerCase();
			if (!isMaintainer(userPub)) {
				return { error: { code: ContractResponseTypes.UNAUTHORIZED, message: "Unauthorized" } };
			}

			const data = this.message.data || {};
			const zipBase64 = data.zipBase64;
			const zipSignatureHex = data.zipSignatureHex;
			const version = data.version;
			const description = data.description || "";

			if (!zipBase64 || !zipSignatureHex || version == null) {
				return {
					error: { code: ContractResponseTypes.BAD_REQUEST, message: "Missing upgrade fields." }
				};
			}

			const zipBuffer = Buffer.from(zipBase64, "base64");
			const sig = hexToUint8(zipSignatureHex);
			const pubKey = hexToUint8(userPub);

			if (!sig || !pubKey) {
				return { error: { code: ContractResponseTypes.BAD_REQUEST, message: "Invalid signature or pubkey format." } };
			}

			const ok = nacl.sign.detached.verify(new Uint8Array(zipBuffer), sig, pubKey);
			if (!ok) {
				return { error: { code: ContractResponseTypes.UNAUTHORIZED, message: "Signature verification failed." } };
			}

			return await this.service.upgradeContract(zipBuffer, version, description);
		} catch (e) {
			return {
				error: {
					code: ContractResponseTypes.INTERNAL_SERVER_ERROR,
					message: e && e.message ? e.message : "Upgrade failed."
				}
			};
		}
	}
}

module.exports = { UpgradeController };
