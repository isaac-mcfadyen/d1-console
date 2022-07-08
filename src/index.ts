import repl, { Recoverable } from "node:repl";
import os from "os";
import {
	checkAuthentication,
	deleteAuthentication,
	readAuthentication,
	setAuthentication,
	writeAuthentication,
} from "./authentication.js";
import { Color, log, openRl, question, rl } from "./userInterface.js";
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

const evalFunction = async (
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

		if (command.toUpperCase().startsWith("USE ")) {
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
		} else if (command.toUpperCase().startsWith("CREATE DATABASE ")) {
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
		} else if (command.toUpperCase().startsWith("DROP DATABASE ")) {
			const dbName = command
				.split(new RegExp("DROP DATABASE ", "i"))[1]
				.trim()
				.replace(/;/g, "")
				.replace(/\n/g, "");

			log(
				`Are you sure you want to delete the database "${dbName}"? THIS IS PERMANENT AND CANNOT BE UNDONE.`,
				Color.RED
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
		} else if (cmd.toUpperCase().startsWith("SHOW DATABASES")) {
			const loadingSpinner = ora("Fetching databases...").start();
			const dbs = await listDatabases();
			if (dbs != null) {
				loadingSpinner.succeed("Fetched databases");
				log("Available databases: ", Color.BLUE);
				for (const db of dbs) {
					log(`${db.name}`, Color.BLUE);
				}
				continue;
			} else {
				loadingSpinner.fail("Failed to fetch databases, please try again.");
				continue;
			}
		} else {
			if (currentDb.uuid.length <= 0) {
				log(
					"No database selected. Run USE <name>; to select a database.",
					Color.RED
				);
				continue;
			}

			const reply = await queryDatabase(
				currentDb.uuid,
				command.replace(/\n/g, "")
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
				log(reply.error, Color.RED);
				continue;
			}
		}
	}

	queryRepl.resume();
	callback(null);
};

log("Welcome to D1 Console!", Color.BLUE);

openRl();

const hasSavedAuth = readAuthentication();
if (hasSavedAuth) {
	const validAuth = await checkAuthentication();
	if (validAuth) {
		log("Using saved authentication.", Color.GREEN);
	} else {
		log(
			"Saved authentication invalid, removing saved credentials. Please try relaunching.",
			Color.RED
		);
		deleteAuthentication();
		process.exit(1);
	}
} else {
	log(
		"No saved authentication found. Please enter authentication details:",
		Color.RED
	);
	const apiToken = await question("API Token: ");
	const accountId = await question("Account ID: ");

	if (
		!/^[a-zA-Z0-9_-]*$/gm.test(apiToken) ||
		!/^[a-zA-Z0-9_-]*$/gm.test(accountId)
	) {
		log("Invalid API Token or Account ID.", Color.RED);
		process.exit(1);
	}

	setAuthentication(apiToken, accountId);

	const validAuth = await checkAuthentication();
	if (validAuth) {
		log("Authentication successful.", Color.GREEN);
	} else {
		log("Authentication failed.", Color.RED);
		process.exit(1);
	}

	log(
		"Do you want to save these authentication details for later use?",
		Color.BLUE
	);
	const saveAuth = await question("(Y/n): ");
	if (saveAuth.toLowerCase() === "y") {
		writeAuthentication();
		log("Saved authentication details.", Color.GREEN);
	} else {
		log("Authentication details will NOT be saved.", Color.GREEN);
	}
}
rl.close();

log("To create a D1 database, use CREATE DATABASE <name>;", Color.BLUE);
log(
	"To list the available databases on your account, use SHOW DATABASES;",
	Color.BLUE
);
log(
	"If you know the name of the database you would like to query, run USE <name>;",
	Color.BLUE
);
log("To delete an existing D1 database, use DROP DATABASE <name>;", Color.BLUE);
log("To show this help again, type HELP;", Color.BLUE);

const queryRepl = repl.start({
	prompt: "D1 > ",
	eval: evalFunction,
	input: process.stdin,
	output: process.stdout,
});
const homedir = os.homedir();
queryRepl.setupHistory(homedir + "/.d1/history", () => {});
