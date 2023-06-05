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
		console.error(chalk.redBright("Failed to create database."));
		process.exit(1);
	}
};
export const deleteDatabase = async (name: string) => {
	const spinner = ora("Deleting database...").start();
	const foundDatabase = await databaseFromNameApi(name);
	if (foundDatabase == null) {
		spinner.stop();
		console.error(chalk.redBright(`Database ${chalk.bold(name)} not found.`));
		return;
	}

	const reply = await deleteDatabaseApi(foundDatabase.uuid);
	spinner.stop();
	if (reply.ok) {
		console.log(chalk.green(`Database ${chalk.bold(name)} deleted.`));
	} else {
		console.error(chalk.redBright("Failed to delete database."));
	}
};
export const listDatabases = async () => {
	const spinner = ora("Fetching databases...").start();
	const reply = await listDatabasesApi();
	if (reply != null) {
		if (reply.length === 0) {
			console.error(
				chalk.redBright(
					"No databases found. Create one using the 'databases create' command."
				)
			);
			process.exit(1);
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
		console.error(chalk.redBright("Failed to fetch databases."));
		process.exit(1);
	}
};

export const queryDatabase = async (
	query: string,
	databaseUuid: string,
	useJson: boolean
) => {
	if (databaseUuid.length == 0) {
		console.error(
			chalk.redBright(
				"No database selected. Run USE <name> to select a database, or SHOW DATABASES to list your available databases. If running in CI/CD, use -d flag to select a database."
			)
		);
		return;
	}

	const reply = await queryDatabaseApi(databaseUuid, query);
	if (!reply.success) {
		console.error(chalk.redBright(reply.error));
		return;
	}
	if (reply.results.length == 0) return;

	if (useJson) {
		console.log(JSON.stringify(reply.results, null, 2));
	} else {
		let data = [];

		let headers = [];
		for (let key of Object.keys(reply.results[0])) {
			headers.push(chalk.bold(key));
		}
		data.push(headers);
		data = data.concat(
			reply.results.map((row: any) => [...Object.values(row)])
		);

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
};
