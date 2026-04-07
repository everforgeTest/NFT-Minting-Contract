// Run as:
// node index.js <contractUrl> <zipFilePath> <version> <description>
// Uses HotPocket Ed25519 keys (generated locally) and signs zip content using tweetnacl.

const fs = require("fs");
const path = require("path");
const nacl = require("tweetnacl");
const HotPocket = require("hotpocket-js-client");
const ContractService = require("./contract-service");

function toHex(buf) {
	return Buffer.from(buf).toString("hex");
}

async function main() {
	const contractUrl = process.argv[2];
	const zipPath = process.argv[3];
	const version = process.argv[4];
	const description = process.argv[5] || "";

	if (!contractUrl || !zipPath || !version) {
		console.log("Usage: node index.js <contractUrl> <zipFilePath> <version> <description>");
		process.exit(1);
	}

	const zipAbs = path.resolve(zipPath);
	const zipBuffer = fs.readFileSync(zipAbs);

	// Maintainer keypair (generate once and reuse by copying printed pubkey into contract .env)
	const maintainerKeys = await HotPocket.generateKeys();
	const pubKeyHex = Buffer.from(maintainerKeys.publicKey).toString("hex");
	console.log("Maintainer public key (set this in contract .env as MAINTAINER_PUBKEY):", pubKeyHex);

	const signature = nacl.sign.detached(new Uint8Array(zipBuffer), maintainerKeys.privateKey);

	const cs = new ContractService([contractUrl]);
	cs.userKeyPair = maintainerKeys; // use the same key for HotPocket handshake
	await cs.init();

	const submitData = {
		Service: "Upgrade",
		Action: "UpgradeContract",
		data: {
			version: parseFloat(version),
			description: description,
			zipBase64: zipBuffer.toString("base64"),
			zipSignatureHex: toHex(signature)
		}
	};

	console.log("Uploading contract zip:", path.basename(zipAbs));
	cs.submitInputToContract(submitData)
		.then(r => {
			console.log("Upgrade success:", r);
		})
		.catch(e => {
			console.log("Upgrade failed:", e);
		})
		.finally(() => process.exit(0));
}

main();
