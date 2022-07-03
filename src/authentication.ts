import fs from "fs";
import os from "os";
import fetch, { RequestInit } from "node-fetch";

const apiBase = "https://api.cloudflare.com/client/v4";

let dbUuid: string;
let apiToken: string;
let accountId: string;

export const checkAuthentication = async () => {
	const reply = await runFetch("/user/tokens/verify");
	return reply.ok;
};
export const runFetch = (endpoint: string, options?: RequestInit) =>
	fetch(apiBase + endpoint, {
		...options,
		headers: {
			...options?.headers,
			Authorization: `Bearer ${apiToken}`,
			"Content-Type": "application/json",
		},
	});

export const runQuery = async (query: string): Promise<any> => {
	const reply = await runFetch(
		`/accounts/${accountId}/d1/database/${dbUuid}/query`,
		{
			method: "POST",
			body: JSON.stringify({ sql: query }),
		}
	);
	return await reply.json();
};

export const listDbs = async () => {
	try {
		const perPage = 10;
		const databases = [];
		let page = 1;
		while (databases.length % perPage === 0) {
			const params = new URLSearchParams({
				per_page: perPage.toString(),
				page: page.toString(),
			});
			const response = await runFetch(
				`/accounts/${accountId}/d1/database?${params.toString()}`
			);
			const json = (await response.json()) as any;
			const results = json.result;
			for (const result of results) {
				databases.push(result);
			}
			page++;
		}
		return databases;
	} catch (e) {
		return [];
	}
};

export const readAuthentication = () => {
	try {
		const homedir = os.homedir();

		const authFile = fs.readFileSync(homedir + "/.d1/credentials.json");
		if (authFile && authFile.length > 0) {
			const auth = JSON.parse(authFile.toString());
			dbUuid = auth.dbUuid;
			apiToken = auth.apiToken;
			accountId = auth.accountId;
			return true;
		}
	} catch (e) {
		return false;
	}
};
export const writeAuthentication = () => {
	const auth = {
		dbUuid,
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
export const setAuthentication = (
	localApiToken: string,
	localAccountId: string
) => {
	apiToken = localApiToken;
	accountId = localAccountId;
};
export const setDb = (localDbUuid: string) => {
	dbUuid = localDbUuid;
};
