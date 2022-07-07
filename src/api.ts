import { accountId, apiToken, runFetch } from "./authentication";

export const createDatabase = async (name: string): Promise<any> => {
	const reply = await runFetch(`/accounts/${accountId}/d1/database`, {
		method: "POST",
		body: JSON.stringify({ name }),
	});
	return await reply.json();
};
export const deleteDatabase = async (dbId: string) => {
	await runFetch(`/accounts/${accountId}/d1/database/${dbId}`, {
		method: "DELETE",
	});
};
export const listDatabases = async (): Promise<
	{ uuid: string; name: string }[] | null
> => {
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
		return null;
	}
};
export const databaseFromName = async (name: string) => {
	const allDBs = await listDatabases();
	const matchingDB = (allDBs || []).find(
		(db: { uuid: string; name: string }) => db.name === name
	);
	return matchingDB;
};

export const queryDatabase = async (
	dbId: string,
	query: string
): Promise<any> => {
	const reply = await runFetch(
		`/accounts/${accountId}/d1/database/${dbId}/query`,
		{
			method: "POST",
			body: JSON.stringify({ sql: query }),
		}
	);
	return await reply.json();
};
