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
import AsciiTable from "ascii-table";

const evalFunction = async (
	cmd: string,
	context: any,
	filename: string,
	callback: Function
) => {
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
		const results = reply.result[0].results;

		if (results.length > 0) {
			const table = new AsciiTable();
			table.setHeading(...Object.keys(results[0]));

			for (const row of results) {
				table.addRow(...Object.values(row));
			}
			console.log(table.toString());
		}
		callback(null);
	} else {
		log(reply.result[0].error, Color.RED);
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
