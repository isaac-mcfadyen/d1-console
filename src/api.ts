import { accountId, apiToken, runFetch } from "./authentication";

export const createDatabaseApi = async (name: string) => {
	return await runFetch(`/accounts/${accountId}/d1/database`, {
		method: "POST",
		body: JSON.stringify({ name }),
	});
};
export const deleteDatabaseApi = async (dbId: string) => {
	return await runFetch(`/accounts/${accountId}/d1/database/${dbId}`, {
		method: "DELETE",
	});
};
export const listDatabasesApi = async (): Promise<
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
			databases.push(...results);
			page++;
			if (results.length < perPage) {
				break;
			}
		}
		return databases;
	} catch (e) {
		return null;
	}
};
export const databaseFromNameApi = async (name: string) => {
	const allDBs = await listDatabasesApi();
	const matchingDB = (allDBs || []).find(
		(db: { uuid: string; name: string }) => db.name === name
	);
	return matchingDB;
};

export const queryDatabaseApi = async (
	dbId: string,
	query: string
): Promise<
	{ success: true; results: any } | { success: false; error: any }
> => {
	try {
		const reply = await runFetch(
			`/accounts/${accountId}/d1/database/${dbId}/query`,
			{
				method: "POST",
				body: JSON.stringify({ sql: query }),
			}
		);
		if (reply.ok) {
			const jsonData = (await reply.json()) as any;
			return { success: true, results: jsonData.result[0].results || [] };
		} else {
			try {
				const jsonData = (await reply.json()) as any;
				return { success: false, error: jsonData.errors[0].message };
			} catch (e) {
				return { success: false, error: reply.statusText };
			}
		}
	} catch (e: any) {
		return { success: false, error: e.message };
	}
};
