import readline from "node:readline";

export enum Color {
	RED,
	GREEN,
	BLUE,
	NONE,
}

export let rl: readline.Interface;

export const openRl = () => {
	rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
};
export const question = (query: string): Promise<string> => {
	return new Promise((resolve) => {
		rl.question(query, (input) => resolve(input));
	});
};
