const fs = require("fs");

function loadEnvFile(filePath) {
	let env = {};
	let content = "";
	try {
		content = fs.readFileSync(filePath, "utf8");
	} catch (e) {
		return env;
	}

	content.split(/\?\
/).forEach(line => {
		if (!line) return;
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) return;
		const idx = trimmed.indexOf("=");
		if (idx < 0) return;
		const key = trimmed.slice(0, idx).trim();
		let val = trimmed.slice(idx + 1);
		val = val.trim();
		if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
			val = val.slice(1, -1);
		}
		env[key] = val;
	});

	return env;
}

const envFromFile = loadEnvFile(".env");

module.exports = {
	get: key => {
		return process.env[key] || envFromFile[key];
	}
};
