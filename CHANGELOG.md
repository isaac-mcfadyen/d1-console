## 1.4.7
- Fixed error when using lowercased in-REPL commands.

## 1.4.6
- Updated incorrect warning message on CREATE/DROP DATABASE commands.
- Removed unused validation function - validation of disallowed queries is now handled by D1.

## 1.4.5

- Added `--silent` flag to silence welcome banner and version information, intended for running in CI/CD.
- Changed error messages to log to `stderr` rather than `stdout`.

## 1.4.4

- Fixed bug causing inability to login to D1 Console via the new `login` command.

## 1.4.3

- Fixed issue where all queries resulted in an error.

## 1.4.2

- Added the commands within the REPL (such as `USE`, `CREATE DATABASE`, etc) back _in addition_ to the new subcommands.
- Queries seperated with a semicolon now correctly execute as a batch which supports automatic transactions (BEGIN and ROLLBACK) still fail.
- Queries can now be joined with REPL commands by joining them with a semicolon (for example, `USE <dbname>; SELECT * FROM <table>; USE <otherdb>; SELECT * FROM <othertable>;`).

## 1.4.1

- Fixed small bug with a query passed to `--execute` with no semicolon causing D1 Console to silently discard the command.

## 1.4.0

D1 Console has moved from a DIY CLI implementation to [`commander`](https://www.npmjs.com/package/commander), a popular Node.JS CLI framework.

- Commands such as `USE`, `SHOW DATABASES`, and `CREATE DATABASE` have been moved to dedicated subcommands (see `--help` for more information).
- Colors are back! :tada: (but can be disabled with the `--no-colors` flag if needed for any reason)
- To choose the database to query, a new flag `-d` or `--database` is now used instead of the `USE` command inside the REPL.
- If you wish to use D1 Console in CI/CD pipelines, the flag `--execute` can be used to immediately execute a command. In addition, D1 Console will now prefer `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` environment variables over the saved authentication (if any).
