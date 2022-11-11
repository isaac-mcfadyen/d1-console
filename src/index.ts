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
import {
	createDatabase,
	databaseFromName,
	deleteDatabase,
	listDatabases,
	queryDatabase,
} from "./api.js";
import ora from "ora";
import chalk from "chalk";
import { Command } from "commander";

let databaseUuid = "";
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
	const commands = strippedCommand.split(";");
	for (const command of commands.map((cmd) => cmd.trim())) {
		if (command.length === 0) continue;

		const finalCommand = command
			.split("\n")
			.map((e) => e.trim())
			.join(" ");
		const reply = await queryDatabase(databaseUuid, finalCommand);
		if (reply.success) {
			const results = reply.result[0].results || [];

			if (results.length > 0) {
				let data = [];

				let headers = [];
				for (let key of Object.keys(results[0])) {
					headers.push(chalk.bold(key));
				}
				data.push(headers);
				data = data.concat(results.map((row: any) => [...Object.values(row)]));

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
			} else {
				if (command.includes("SELECT")) {
					console.log("No results found.");
				}
			}

			continue;
		} else {
			console.log(reply.error);
			continue;
		}
	}

	if (queryRepl != null) {
		queryRepl.resume();
	}

	callback(null);
};

console.log(chalk.bold("D1 Console " + VERSION));

// Parse auth.
readAuthentication();

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

// Database management subcommands.
const databaseSubcommands = program
	.command("databases")
	.description("Create, list, and delete D1 databases.");

databaseSubcommands
	.command("create")
	.argument("<name>", "The name of the database to create.")
	.description("Create a new D1 database.")
	.action(async (name) => {
		const spinner = ora("Creating database...").start();
		const reply = await createDatabase(name);
		spinner.stop();
		if (reply.ok) {
			console.log(chalk.green(`Database ${chalk.bold(name)} created.`));
		} else {
			console.log(chalk.redBright("Failed to create database."));
		}
	});

databaseSubcommands
	.command("list")
	.description("List your D1 databases.")
	.action(async () => {
		const spinner = ora("Fetching databases...").start();
		const reply = await listDatabases();
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
			data = data.concat(
				reply.map((database) => [database.name, database.uuid])
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

			spinner.stop();
			console.log(chalk.green("Databases:"));
			console.log(table(data, config));
		} else {
			spinner.stop();
			console.log(chalk.redBright("Failed to fetch databases."));
		}
	});

databaseSubcommands
	.command("delete")
	.argument("name", "The name of the database to delete.")
	.description("Delete a D1 database.")
	.action(async (name) => {
		const spinner = ora("Deleting database...").start();
		const foundDatabase = await databaseFromName(name);
		if (foundDatabase == null) {
			spinner.stop();
			console.log(chalk.redBright(`Database ${chalk.bold(name)} not found.`));
			return;
		}

		const reply = await deleteDatabase(foundDatabase.uuid);
		spinner.stop();
		if (reply.ok) {
			console.log(chalk.green(`Database ${chalk.bold(name)} deleted.`));
		} else {
			console.log(chalk.redBright("Failed to delete database."));
		}
	});

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
	.action(async (apiToken, accountId) => {
		await setAuthentication(apiToken, accountId);

		const validCredentials = await checkAuthentication();
		if (!validCredentials) {
			console.log(
				chalk.redBright(
					"Invalid credentials! Check your API token and account ID."
				)
			);
		}

		writeAuthentication();
		console.log(chalk.greenBright("Successfully logged in to Cloudflare D1!"));
	});
program
	.command("whoami")
	.description("View your current login credentials.")
	.action(async () => {
		const validCredentials = readAuthentication();
		if (validCredentials) {
			console.log(
				chalk.greenBright(
					`Logged in as ${accountId} with API token ${apiToken}`
				)
			);
		} else {
			console.log(chalk.redBright("Not logged in to Cloudflare D1."));
		}
	});
program
	.command("query", {
		isDefault: true,
	})
	.description("Start a D1 query REPL.")
	.requiredOption(
		"-d, --database <database>",
		"The name of the D1 database to query"
	)
	.option(
		"--execute <query>",
		"Immediately run a command or a series of commands seperated with a semicolon. Useful for CI/CD pipelines."
	)
	.action(async (params) => {
		readAuthentication();
		const validCredentials = await checkAuthentication();
		if (!validCredentials) {
			console.log(
				chalk.redBright(
					"Invalid authentication. Run 'login' to update your API token and/or account ID."
				)
			);
			return;
		}

		// Find the database ID by name.
		const foundDatabase = await databaseFromName(params.database);
		if (foundDatabase == null) {
			console.log(
				chalk.redBright(`Cannot find database with name ${params.database}`)
			);
			return;
		}
		console.log(
			chalk.greenBright(
				`Now querying database ${foundDatabase.name} (${foundDatabase.uuid})`
			)
		);
		databaseUuid = foundDatabase.uuid;

		if (params.execute) {
			const query = params.execute;
			evalFunction(query, null, "", () => {});
			return;
		}

		queryRepl = repl.start({
			prompt: foundDatabase.name + " > ",
			eval: evalFunction,
			input: process.stdin,
			output: process.stdout,
		});
	});

await program.parseAsync(process.argv);
