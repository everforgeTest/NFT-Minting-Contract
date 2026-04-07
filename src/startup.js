const HotPocket = require("hotpocket-nodejs-contract");
const { Controller } = require("./controller");
const { DBInitializer } = require("./Data.Deploy/initDB");
const { SharedService } = require("./Services/Common.Services/SharedService");

const contract = async ctx => {
	console.log("NFT Mint contract is running.");

	SharedService.context = ctx;
	const isReadOnly = ctx.readonly;

	try {
		await DBInitializer.init();
	} catch (e) {
		console.error("DB init error:", e);
	}

	const controller = new Controller();

	for (const user of ctx.users.list()) {
		for (const input of user.inputs) {
			const buf = await ctx.users.read(input);
			let message;
			try {
				message = JSON.parse(buf);
			} catch (e) {
				message = null;
			}

			if (!message) {
				await user.send({ error: { code: 400, message: "Invalid JSON." } });
				continue;
			}

			await controller.handleRequest(user, message, isReadOnly);
		}
	}
};

const hpc = new HotPocket.Contract();
hpc.init(contract, HotPocket.clientProtocols.JSON, true);
