import { runFetch } from "./authentication.js";

export const validateQuery = (query: string) => {
	if (
		query.includes("PRAGMA") &&
		!query.includes("PRAGMA table_list") &&
		!query.includes("PRAGMA table_info") &&
		!query.includes("PRAGMA foreign_keys")
	) {
		return {
			valid: false,
			error:
				"D1 only supports PRAGMA table_list, table_info, and foreign_keys.",
		};
	}

	if (
		query.includes("BEGIN") ||
		query.includes("ROLLBACK") ||
		query.includes("COMMIT")
	) {
		return {
			valid: false,
			error:
				"D1 operates in auto-commit mode and does not support transactions.",
		};
	}

	return { valid: true };
};
