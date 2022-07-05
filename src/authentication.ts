import fs from "fs";
import os from "os";
import fetch, { RequestInit } from "node-fetch";

const apiBase = "https://api.cloudflare.com/client/v4";

export let apiToken = "";
export let accountId = "";

export const checkAuthentication = async () => {
	const reply = await runFetch("/user/tokens/verify");
	return reply.ok;
};
export const runFetch = (endpoint: string, options?: RequestInit) => {
	return fetch(apiBase + endpoint, {
		...options,
		headers: {
			...options?.headers,
			Authorization: `Bearer ${apiToken}`,
			"Content-Type": "application/json",
		},
	});
};

export const readAuthentication = () => {
	try {
		const homedir = os.homedir();
		const authFile = fs.readFileSync(homedir + "/.d1/credentials.json");
		if (authFile && authFile.length > 0) {
			const auth = JSON.parse(authFile.toString());
			apiToken = auth.apiToken;
			accountId = auth.accountId;
			return true;
		} else {
			return false;
		}
	} catch (e) {
		return false;
	}
};
export const writeAuthentication = () => {
	const auth = {
		apiToken,
		accountId,
	};
	const homedir = os.homedir();
	if (!fs.existsSync(homedir + "/.d1")) {
		fs.mkdirSync(homedir + "/.d1");
	}
	fs.writeFileSync(homedir + "/.d1/credentials.json", JSON.stringify(auth));
};
export const deleteAuthentication = () => {
	const homedir = os.homedir();
	fs.unlinkSync(homedir + "/.d1/credentials.json");
};
export const setAuthentication = async (
	localApiToken: string,
	localAccountId: string
) => {
	apiToken = localApiToken;
	accountId = localAccountId;
};
