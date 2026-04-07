function ok(data) {
	return { success: data };
}

function error(code, message) {
	return { error: { code: code, message: message } };
}

module.exports = { ok, error };
