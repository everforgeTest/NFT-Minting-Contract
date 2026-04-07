const { ServiceTypes } = require("./Constants/ServiceTypes");
const { NftController } = require("./Controllers/Nft.Controller");
const { UpgradeController } = require("./Controllers/Upgrade.Controller");

class Controller {
	async handleRequest(user, message, isReadOnly) {
		let result = { error: { code: 400, message: "Invalid request." } };

		if (message && message.Data && !message.data) message.data = message.Data;

		if (message && message.Service === ServiceTypes.NFT) {
			const c = new NftController(message);
			result = await c.handleRequest(user);
		} else if (message && (message.Service === ServiceTypes.UPGRADE || message.service === ServiceTypes.UPGRADE)) {
			message.userPubKey = user.pubKey;
			const c = new UpgradeController(message);
			result = await c.handleRequest(user);
		}

		await user.send(isReadOnly ? result : (message && message.promiseId ? { promiseId: message.promiseId, ...result } : result));
	}
}

module.exports = { Controller };
