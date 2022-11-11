import ora from "ora";
import chalk from "chalk";
import {
	createDatabaseApi,
	databaseFromNameApi,
	deleteDatabaseApi,
	listDatabasesApi,
	queryDatabaseApi,
} from "./api";
import { table } from "table";

export const createDatabase = async (name: string) => {
	const spinner = ora("Creating database...").start();
	const reply = await createDatabaseApi(name);
	spinner.stop();
	if (reply.ok) {
		console.log(chalk.green(`Database ${chalk.bold(name)} created.`));
	} else {
		console.log(chalk.redBright("Failed to create database."));
	}
};
export const deleteDatabase = async (name: string) => {
	const spinner = ora("Deleting database...").start();
	const foundDatabase = await databaseFromNameApi(name);
	if (foundDatabase == null) {
		spinner.stop();
		console.log(chalk.redBright(`Database ${chalk.bold(name)} not found.`));
		return;
	}

	const reply = await deleteDatabaseApi(foundDatabase.uuid);
	spinner.stop();
	if (reply.ok) {
		console.log(chalk.green(`Database ${chalk.bold(name)} deleted.`));
	} else {
		console.log(chalk.redBright("Failed to delete database."));
	}
};
export const listDatabases = async () => {
	const spinner = ora("Fetching databases...").start();
	const reply = await listDatabasesApi();
	if (reply != null) {
		if (reply.length === 0) {
			console.log(
				chalk.redBright(
					"No databases found. Create one using the 'databases create' command."
				)
			);
			return;
		}

		let data = [];
		let headers = ["Name", "UUID"];
		data.push(headers);
		data = data.concat(reply.map((database) => [database.name, database.uuid]));
		const width = process.stdout.columns;
		const numberOfColumns = data[0].length + 1.5;
		const columnWidth = Math.floor(width / numberOfColumns);
		const config = {
			columnDefault: {
				width: columnWidth,
				wrapWord: true,
			},
		};

		spinner.stop();
		console.log(chalk.green("Databases:"));
		console.log(table(data, config));
	} else {
		spinner.stop();
		console.log(chalk.redBright("Failed to fetch databases."));
	}
};

export const queryDatabase = async (
	query: string,
	databaseUuid: string,
	useJson: boolean
) => {
	if (databaseUuid.length == 0) {
		console.log(
			chalk.redBright(
				"No database selected. Run USE <name> to select a database, or SHOW DATABASES to list your available databases."
			)
		);
		return;
	}

	const reply = await queryDatabaseApi(databaseUuid, query);
	if (!reply.success) {
		console.log(chalk.redBright(reply.error));
		return;
	}
	if (reply.results.length == 0) return;

	for (const result of reply.results.map((result: any) => result.results)) {
		if (result.length == 0) continue;

		if (useJson) {
			console.log(JSON.stringify(result, null, 2));
		} else {
			let data = [];

			let headers = [];
			for (let key of Object.keys(result[0])) {
				headers.push(chalk.bold(key));
			}
			data.push(headers);
			data = data.concat(result.map((row: any) => [...Object.values(row)]));

			const width = process.stdout.columns;
			const numberOfColumns = data[0].length + 1.5;
			const columnWidth = Math.floor(width / numberOfColumns);
			const config = {
				columnDefault: {
					width: columnWidth,
					wrapWord: true,
				},
			};
			console.log(table(data, config));
		}
	}
};
