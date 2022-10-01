import repl, { Recoverable } from "node:repl";
import os from "os";
import {
	checkAuthentication,
	deleteAuthentication,
	readAuthentication,
	setAuthentication,
	writeAuthentication,
} from "./authentication.js";
import { openRl, question, rl } from "./userInterface.js";
import { table } from "table";
import {
	createDatabase,
	databaseFromName,
	deleteDatabase,
	listDatabases,
	queryDatabase,
} from "./api.js";
import ora from "ora";

let currentDb = { uuid: "", name: "" };
let lastCommand = "";

declare global {
	var VERSION: string;
}

const helpMessage = `To get the current version of d1-console, use VERSION;
To create a D1 database, use CREATE DATABASE <name>;
To list the available databases on your account, use SHOW DATABASES;
If you know the name of the database you would like to query, run USE <name>;
To delete an existing D1 database, use DROP DATABASE <name>;
To show this help again, type HELP;
To learn more about d1-console, type ABOUT;
To exit d1-console, type EXIT;`,
	evalFunction = async (
		cmd: string,
		context: any,
		filename: string,
		callback: Function
	) => {
		// Allow multiline, and prompt if this is an empty line.
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

		queryRepl.pause();

		// Split the command on semicolons.
		const commands = strippedCommand.split(";");
		for (const command of commands.map((cmd) => cmd.trim())) {
			if (command.length === 0) continue;

			const commandUppercased = command.toUpperCase();
			const commandIs = (query: string): boolean =>
				commandUppercased.startsWith(query);

			if (commandIs("USE ")) {
				const dbName = command
					.split(new RegExp("USE ", "i"))[1]
					.trim()
					.replace(/;/g, "")
					.replace(/\n/g, "");
				const loadingSpinner = ora(`Connecting to ${dbName}`).start();
				const db = await databaseFromName(dbName);
				if (db != null) {
					currentDb = db;
					loadingSpinner.succeed(`Now querying ${db.name}`);
					queryRepl.setPrompt(`${db.name} > `);
					continue;
				} else {
					loadingSpinner.fail(`Could not find database ${dbName}`);
					continue;
				}
			} else if (commandIs("CREATE DATABASE ")) {
				const dbName = command
					.split(new RegExp("CREATE DATABASE ", "i"))[1]
					.trim()
					.replace(/;/g, "")
					.replace(/\n/g, "");
				const loadingSpinner = ora(`Creating database ${dbName}`).start();
				const db = await createDatabase(dbName);
				if (db.success) {
					loadingSpinner.succeed(`Created database ${dbName}`);
					continue;
				} else {
					loadingSpinner.fail("Failed to create database, please try again.");
					continue;
				}
			} else if (commandIs("DROP DATABASE ")) {
				const dbName = command
					.split(new RegExp("DROP DATABASE ", "i"))[1]
					.trim()
					.replace(/;/g, "")
					.replace(/\n/g, "");

				console.log(
					`Are you sure you want to delete the database "${dbName}"? THIS IS PERMANENT AND CANNOT BE UNDONE.`
				);
				queryRepl.question("Type 'yes' to continue: ", async (answer) => {
					lastCommand = "";
					queryRepl.pause();
					if (answer.toLowerCase() === "yes") {
						const loadingSpinner = ora(`Deleting database ${dbName}`).start();
						const db = await databaseFromName(dbName);
						if (db == null) {
							loadingSpinner.fail("Database does not exist.");
							callback(null);
							return;
						}
						deleteDatabase(db.uuid);
						loadingSpinner.succeed(`Deleted database ${dbName}`);
					}
					queryRepl.resume();
				});
				continue;
			} else if (commandIs("SHOW DATABASES")) {
				const loadingSpinner = ora("Fetching databases...").start();
				const dbs = await listDatabases();
				if (dbs != null) {
					loadingSpinner.succeed("Fetched databases");
					console.log("Available databases: ");
					if (dbs.length === 0) console.log("None");
					for (const db of dbs) {
						console.log(`${db.name}`);
					}
					continue;
				} else {
					loadingSpinner.fail("Failed to fetch databases, please try again.");
					continue;
				}
			} else if (commandIs("VERSION")) {
				console.log(VERSION);
			} else if (commandIs("EXIT")) {
				console.log("Exiting D1 Console...");
				queryRepl.close();
				process.exit(0);
			} else if (commandIs("ABOUT")) {
				console.log(
					`A console/REPL for Cloudflare's D1 Database product.

Supports all the features expected of a modern database client, including:
 • multiline queries
 • table-formatted query outputs
 • command history
 • the ability to save your Cloudflare credentials for later use (opt-in)

d1-console is built and maintained by Isaac McFadyen, and utilizes the safe-buffer package by Feross Aboukhadijeh, and the fetch-blob, formdata-polyfill and node-domexception packages by Jimmy Wärting.`
				);
			} else if (commandIs("HELP")) {
				console.log(helpMessage);
			} else {
				if (currentDb.uuid.length <= 0) {
					console.log(
						"No database selected. Run USE <name>; to select a database."
					);
					continue;
				}

				const reply = await queryDatabase(
					currentDb.uuid,
					command
						.split("\n")
						.map((e) => e.trim())
						.join(" ")
				);
				if (reply.success) {
					const results = reply.result[0].results || [];

					if (process.argv[2] === "--json") {
						console.log(JSON.stringify(results, null, 2));
					} else if (process.argv[2] === "--json-all") {
						console.log(JSON.stringify(reply.result, null, 2));
					} else {
						if (results.length > 0) {
							let data = [];

							let headers = [];
							for (let key of Object.keys(results[0])) {
								headers.push("\x1b[1m" + key + "\x1b[0m");
							}
							data.push(headers);
							data = data.concat(
								results.map((row: any) => [...Object.values(row)])
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
						} else {
							if (command.includes("SELECT")) {
								console.log("No results found.");
							}
						}
					}
					continue;
				} else {
					console.log(reply.error);
					continue;
				}
			}
		}

		queryRepl.resume();
		callback(null);
	};

console.log("Welcome to D1 Console!");

openRl();

const hasSavedAuth = readAuthentication();
if (hasSavedAuth) {
	const validAuth = await checkAuthentication();
	if (validAuth) {
		console.log("Using saved authentication.");
	} else {
		console.log(
			"Saved authentication invalid, removing saved credentials. Please try relaunching."
		);
		deleteAuthentication();
		process.exit(1);
	}
} else {
	console.log(
		"No saved authentication found. Please enter authentication details:"
	);
	const apiToken = await question("API Token: ");
	const accountId = await question("Account ID: ");

	if (
		!/^[a-zA-Z0-9_-]*$/gm.test(apiToken) ||
		!/^[a-zA-Z0-9_-]*$/gm.test(accountId)
	) {
		console.log("Invalid API Token or Account ID.");
		process.exit(1);
	}

	setAuthentication(apiToken, accountId);

	const validAuth = await checkAuthentication();
	if (validAuth) {
		console.log("Authentication successful.");
	} else {
		console.log("Authentication failed.");
		process.exit(1);
	}

	console.log(
		"Do you want to save these authentication details for later use?"
	);
	const saveAuth = await question("(Y/n): ");
	if (saveAuth.toLowerCase() === "y") {
		writeAuthentication();
		console.log("Saved authentication details.");
	} else {
		console.log("Authentication details will NOT be saved.");
	}
}
rl.close();

console.log(helpMessage);

const queryRepl = repl.start({
	prompt: "D1 > ",
	eval: evalFunction,
	input: process.stdin,
	output: process.stdout,
});
const homedir = os.homedir();
queryRepl.setupHistory(homedir + "/.d1/history", () => {});

if (process.argv[2] == "--execute") {
	await evalFunction(process.argv[3], null, "", () => {
		console.log("Executed commands, exiting.");
	});
	process.exit(0);
}
