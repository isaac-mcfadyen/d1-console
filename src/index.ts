import repl, { Recoverable } from "node:repl";
import os from "os";
import {
	checkAuthentication,
	deleteAuthentication,
	readAuthentication,
	setAuthentication,
	setDb,
	writeAuthentication,
	runQuery,
	listDbs,
} from "./authentication.js";
import { validateQuery } from "./queries.js";
import { Color, log, question, rl } from "./userInterface.js";
import { table } from "table";

let lastCommand = "";

const evalFunction = async (
	cmd: string,
	context: any,
	filename: string,
	callback: Function
) => {
	if (cmd.trim().replace(/\n/g, "") === lastCommand) {
		console.log("Type a semicolon to execute the query.");
	}
	lastCommand = cmd.trim().replace(/\n/g, "");

	// Check if the last character is not a semicolon.
	const strippedCommand = cmd.trim();
	if (!strippedCommand.endsWith(";")) {
		// If not, allow multiline.
		callback(new Recoverable(new Error()));
		return;
	}

	const validation = validateQuery(cmd);
	if (!validation.valid) {
		log("Error: " + validation.error || "Invalid query.", Color.RED);
		callback(null);
		return;
	}

	queryRepl.pause();

	const reply = await runQuery(strippedCommand);
	if (reply.success) {
		const results = reply.result[0]?.results || [];

		if (process.argv[2] === "--json") {
			console.log(JSON.stringify(results, null, 2));
		} else if (process.argv[2] === "--json-all") {
			console.log(JSON.stringify(reply.result[0], null, 2));
		} else {
			if (results.length > 0) {
				let data = [];

				let headers = [];
				for (let key of Object.keys(results[0])) {
					headers.push("\x1b[1m" + key + "\x1b[0m");
				}
				data.push(headers);

				for (const result of results) {
					let row = [];
					for (let value of Object.values(result)) {
						row.push(value);
					}
					data.push(row);
				}

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
		callback(null);
	} else {
		log(reply.result[0].error || "Error querying D1.", Color.RED);
		callback(null);
	}

	queryRepl.resume();
};

log("Welcome to the D1 console!", Color.BLUE);

const hasSavedAuth = readAuthentication();
if (hasSavedAuth) {
	log("Using saved authentication.", Color.GREEN);

	const validAuth = await checkAuthentication();
	if (validAuth) {
		log("Authentication successful.", Color.GREEN);
	} else {
		log("Saved authentication invalid, removing saved credentials.", Color.RED);
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

log("Please enter the number of the database you want to use:", Color.BLUE);
const dbs = await listDbs();
for (const index in dbs) {
	log(index + ": " + dbs[index].name, Color.BLUE);
}
const dbNumber = Number(await question("Database Number: "));

// Check if it's a number and within range.
if (isNaN(dbNumber) || dbNumber < 0 || dbNumber >= dbs.length) {
	log("Invalid database number.", Color.RED);
	process.exit(1);
}

const dbName = dbs[dbNumber].name;
const dbUuid = dbs[dbNumber].uuid;
log('Using database with name "' + dbName + '"', Color.GREEN);
setDb(dbUuid);

log("Connecting to database...", Color.BLUE);

rl.close();

const queryRepl = repl.start({
	prompt: dbs[dbNumber].name + " > ",
	eval: evalFunction,
	input: process.stdin,
	output: process.stdout,
});
const homedir = os.homedir();
queryRepl.setupHistory(homedir + "/.d1/history", () => {});
