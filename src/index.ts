import repl, { Recoverable } from "node:repl";
import os from "os";
import {
	accountId,
	apiToken,
	checkAuthentication,
	readAuthentication,
	setAuthentication,
	writeAuthentication,
} from "./authentication.js";
import { table } from "table";
import { databaseFromNameApi, queryDatabaseApi } from "./api.js";
import chalk from "chalk";
import { Command } from "commander";
import {
	createDatabase,
	deleteDatabase,
	listDatabases,
	queryDatabase,
} from "./userInterface.js";

let useJson = false;
let databaseUuid = "";
let databaseName = "";
let lastCommand = "";
let queryRepl: repl.REPLServer;

declare global {
	var VERSION: string;
}

const evalFunction = async (
	cmd: string,
	context: any,
	filename: string,
	callback: Function
) => {
	// Multiline query functionality.
	if (cmd.trim().replace(/\n/g, "") === lastCommand) {
		console.log("Type a semicolon to execute the query.");
	}
	lastCommand = cmd.trim().replace(/\n/g, "");
	const strippedCommand = cmd.trim();
	if (!strippedCommand.endsWith(";")) {
		// If not, allow multiline.
		callback(new Recoverable(new Error()));
		return;
	}
	lastCommand = "";

	if (queryRepl != null) {
		queryRepl.pause();
	}

	// Split the command on semicolons.
	const commands = strippedCommand
		.split(";")
		.map((c) => c.replace(/\n/g, "").trim())
		.filter((c) => c.length > 0);

	let queuedCommands = [];
	for (const command of commands) {
		const upperCommand = command.toUpperCase();

		if (
			!upperCommand.startsWith("USE") &&
			!upperCommand.startsWith("CREATE DATABASE") &&
			!upperCommand.startsWith("DROP DATABASE") &&
			!upperCommand.startsWith("SHOW DATABASES") &&
			!upperCommand.startsWith("HELP")
		) {
			queuedCommands.push(command);
		} else {
			// Run any queued commands.
			const joinedCommands = queuedCommands.join(";");
			if (joinedCommands.length > 0) {
				await queryDatabase(joinedCommands, databaseUuid, useJson);
				queuedCommands = [];
			}

			if (upperCommand.startsWith("USE")) {
				const databaseName = command.match(/USE\s+(.*)/);
				if (databaseName == null) {
					console.error(chalk.redBright("Invalid USE statement."));
					return;
				}
				const foundDatabase = await databaseFromNameApi(databaseName[1]);

				if (foundDatabase != null) {
					databaseUuid = foundDatabase.uuid;
					console.log(
						chalk.greenBright(`Switched to database ${foundDatabase.name}`)
					);
					queryRepl.setPrompt(`${foundDatabase.name} > `);
				}
			} else if (upperCommand.startsWith("CREATE DATABASE")) {
				const databaseName = command.match(/CREATE DATABASE\s+(.*)/);
				if (databaseName == null) {
					console.error(chalk.redBright("Invalid CREATE DATABASE statement."));
					return;
				}
				await createDatabase(databaseName[1]);
			} else if (upperCommand.startsWith("DROP DATABASE")) {
				const databaseName = command.match(/DROP DATABASE\s+(.*)/);
				if (databaseName == null) {
					console.error(chalk.redBright("Invalid DROP DATABASE statement."));
					return;
				}
				await deleteDatabase(databaseName[1]);
			} else if (upperCommand.startsWith("SHOW DATABASES")) {
				await listDatabases();
			} else if (upperCommand.startsWith("HELP")) {
				console.log(chalk.bold("Available commands: "));
				console.log(
					`${chalk.bold(
						"CREATE DATABASE <name>"
					)} - Create a new D1 database. ${chalk.bold(
						"THIS CANNOT BE UNDONE!"
					)}`
				);
				console.log(
					`${chalk.bold("DROP DATABASE <name>")} - Delete a D1 database.`
				);
				console.log(
					`${chalk.bold("USE <name>")} - Switch to a different database.`
				);
				console.log(
					`${chalk.bold("SHOW DATABASES")} - List your D1 databases.`
				);
				console.log(`${chalk.bold("HELP")} - Show this help message.`);
			}
		}

		// If this is the last command, run queued commands.
		if (command == commands[commands.length - 1]) {
			const joinedCommands = queuedCommands.join(";");
			if (joinedCommands.length > 0) {
				await queryDatabase(joinedCommands, databaseUuid, useJson);
			}
		}
	}

	if (queryRepl != null) {
		queryRepl.resume();
	}

	callback(null);
};

// Global options.
const program = new Command();
program
	.description(
		"D1 Console - A console/REPL for Cloudflare's D1 Database product"
	)
	.version(VERSION, "-v, --version", "Print the version of D1 Console.")
	.helpOption("-h, --help", "Show help for D1 Console.")
	.addHelpCommand(false);

// Disable colors flag.
program
	.option("--disable-colors", "Disable all prompt colors.")
	.hook("preSubcommand", async (thisCommand, actionCommand) => {
		if (
			thisCommand.opts()["disableColors"] != null &&
			thisCommand.opts()["disableColors"]
		) {
			chalk.level = 0;
		}
	});

// Parse auth.
readAuthentication();

// Database management subcommands.
const databaseSubcommands = program
	.command("databases")
	.description("Create, list, and delete D1 databases.");

databaseSubcommands
	.command("create")
	.argument("<name>", "The name of the database to create.")
	.description("Create a new D1 database.")
	.hook("preAction", async () => {
		console.log(chalk.bold("D1 Console " + VERSION));
	})
	.action(createDatabase);

databaseSubcommands
	.command("list")
	.description("List your D1 databases.")
	.hook("preAction", async () => {
		console.log(chalk.bold("D1 Console " + VERSION));
	})
	.action(listDatabases);

databaseSubcommands
	.command("delete")
	.argument("name", "The name of the database to delete.")
	.description("Delete a D1 database.")
	.hook("preAction", async () => {
		console.log(chalk.bold("D1 Console " + VERSION));
	})
	.action(deleteDatabase);

// Other subcommands.
program
	.command("login")
	.requiredOption(
		"--api-token <apiToken>",
		"Cloudflare API Token (can be found on https://dash.cloudflare.com/profile/api-tokens)"
	)
	.requiredOption(
		"--account-id <accountId>",
		"Cloudflare Account ID (can be found on any domain in your account)"
	)
	.description("Login to Cloudflare D1 using an API token and account ID.")
	.hook("preAction", async () => {
		console.log(chalk.bold("D1 Console " + VERSION));
	})
	.action(async (params) => {
		await setAuthentication(params.apiToken, params.accountId);

		const validCredentials = await checkAuthentication();
		if (!validCredentials) {
			console.error(
				chalk.redBright(
					"Invalid credentials! Check your API token and account ID for typos, and try wrapping in quotes if there are any special characters."
				)
			);
			process.exit(1);
		}

		writeAuthentication();
		console.log(chalk.greenBright("Successfully logged in to Cloudflare D1!"));
	});
program
	.command("whoami")
	.description("View your current login credentials.")
	.hook("preAction", async () => {
		console.log(chalk.bold("D1 Console " + VERSION));
	})
	.action(async () => {
		const validCredentials = readAuthentication();
		if (validCredentials) {
			console.log(
				chalk.greenBright(
					`Logged in as ${accountId} with API token ${apiToken}`
				)
			);
		} else {
			console.error(chalk.redBright("Not logged in to Cloudflare D1."));
			process.exit(1);
		}
	});
program
	.command("query", {
		isDefault: true,
	})
	.description("Start a D1 query REPL.")
	.option("-d, --database <database>", "The name of the D1 database to query")
	.option(
		"--execute <query>",
		"Immediately run a command or a series of commands seperated with a semicolon. Useful for CI/CD pipelines."
	)
	.option("--json", "Output results as JSON instead of as a table.")
	.option("--silent", "Don't show the D1 Console banner at startup.")
	.action(async (params) => {
		const isLoud = params.silent == null || !params.silent;
		if (isLoud) {
			console.log(chalk.bold("D1 Console " + VERSION));
			console.log(chalk.bold("Welcome to D1 Console!"));
			console.log(
				chalk.cyanBright(
					"Enter a query followed by a semicolon to run it on the database. Multiple queries seperated by a semicolon will be run as a transaction (batch)."
				)
			);
			console.log(chalk.cyanBright("For more information, enter HELP;"));
		}

		useJson = params.json || false;

		readAuthentication();
		const validCredentials = await checkAuthentication();
		if (!validCredentials) {
			console.error(chalk.redBright("Invalid authentication. "));
			console.error(
				chalk.cyanBright(
					"Run 'd1-console login' to store your Cloudflare API token and account ID. Your account ID can be found on any domain in your account, and you can create an API token here: https://dash.cloudflare.com/profile/api-tokens"
				)
			);
			process.exit(1);
		}

		if (params.database != null) {
			// Find the database ID by name.
			const foundDatabase = await databaseFromNameApi(params.database);
			if (foundDatabase == null) {
				console.error(
					chalk.redBright(`Cannot find database with name ${params.database}`)
				);
				process.exit(1);
			}

			if (isLoud) {
				console.log(
					chalk.greenBright(
						`Now querying database ${foundDatabase.name} (${foundDatabase.uuid})`
					)
				);
			}
			databaseUuid = foundDatabase.uuid;
			databaseName = foundDatabase.name;
		}

		if (params.execute) {
			if (databaseName == null) {
				console.error(
					chalk.redBright(
						"When using the --execute flag, you must also specify a database with the -d or --database flag."
					)
				);
				process.exit(1);
			}

			let query = params.execute as string;
			if (!query.endsWith(";")) {
				query += ";";
			}
			evalFunction(query, null, "", () => {});
			return;
		}

		queryRepl = repl.start({
			prompt: `${databaseName.length > 0 ? databaseName : "D1"} > `,
			eval: evalFunction,
			input: process.stdin,
			output: process.stdout,
		});
		const homedir = os.homedir();
		queryRepl.setupHistory(homedir + "/.d1/history", () => {});
	});

await program.parseAsync(process.argv);
