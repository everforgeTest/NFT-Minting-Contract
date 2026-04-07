const HotPocket = require("hotpocket-js-client");
const bson = require("bson");
const crypto = require("crypto");

class ContractService {
	constructor(servers) {
		this.servers = servers;
		this.userKeyPair = null;
		this.client = null;
		this.isConnectionSucceeded = false;
		this.promiseMap = new Map();
	}

	async init() {
		if (!this.userKeyPair) this.userKeyPair = await HotPocket.generateKeys();
		if (!this.client) {
			this.client = await HotPocket.createClient(this.servers, this.userKeyPair, {
				protocol: HotPocket.protocols.bson
			});
		}

		this.client.on(HotPocket.events.disconnect, () => {
			this.isConnectionSucceeded = false;
		});

		this.client.on(HotPocket.events.contractOutput, r => {
			r.outputs.forEach(o => {
				const output = bson.deserialize(o);
				const pId = output.promiseId;
				const entry = this.promiseMap.get(pId);
				if (!entry) return;
				if (output.error) entry.rejecter(output.error);
				else entry.resolver(output.success);
				this.promiseMap.delete(pId);
			});
		});

		if (!this.isConnectionSucceeded) {
			if (!(await this.client.connect())) return false;
			this.isConnectionSucceeded = true;
		}
		return true;
	}

	submitInputToContract(inpObj) {
		const promiseId = this.#getUniqueId();
		const payload = bson.serialize({ promiseId: promiseId, ...inpObj });

		this.client.submitContractInput(payload).then(input => {
			input && input.submissionStatus && input.submissionStatus.then(s => {
				if (s.status !== "accepted") {
					throw new Error(`Ledger_Rejection: ${s.reason}`);
				}
			});
		});

		return new Promise((resolve, reject) => {
			this.promiseMap.set(promiseId, { resolver: resolve, rejecter: reject });
		});
	}

	#getUniqueId() {
		return crypto.randomBytes(10).toString("hex");
	}
}

module.exports = ContractService;
