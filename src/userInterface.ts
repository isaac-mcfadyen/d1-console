import readline from "node:readline";

export enum Color {
	RED,
	GREEN,
	BLUE,
}

export const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

export const question = (query: string): Promise<string> => {
	return new Promise((resolve) => {
		rl.question(query, (input) => resolve(input));
	});
};

export const log = (message: string, color: Color) => {
	const colors = {
		[Color.RED]: "\x1b[31m",
		[Color.GREEN]: "\x1b[32m",
		[Color.BLUE]: "\x1b[34m",
	};
	const selectedColor = colors[color];
	console.log(selectedColor + message + "\x1b[0m");
};
