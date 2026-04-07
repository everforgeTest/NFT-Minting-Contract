const { NftService } = require("../Services/Domain.Services/NftService");
const settings = require("../settings.json").settings;

class NftController {
	constructor(message) {
		this.message = message;
		this.service = new NftService(settings.dbPath);
	}

	async handleRequest(user) {
		switch (this.message.Action) {
			case "Mint":
				return await this.service.mint((user.pubKey || "").toLowerCase(), this.message.data);
			case "GetById":
				return await this.service.getById(this.message.data && this.message.data.id);
			case "GetByOwner":
				return await this.service.getByOwner(this.message.data && this.message.data.ownerPubKey);
			case "GetAll":
				return await this.service.getAll(
					this.message.data && this.message.data.page,
					this.message.data && this.message.data.pageSize,
				);
			default:
				return { error: { code: 400, message: "Invalid action." } };
		}
	}
}

module.exports = { NftController };
