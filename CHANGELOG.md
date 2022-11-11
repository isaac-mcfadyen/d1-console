## 1.4.0

D1 Console has moved from a DIY CLI implementation to [`commander`](https://www.npmjs.com/package/commander), a popular Node.JS CLI framework.

Breaking changes:

- Commands such as `USE`, `SHOW DATABASES`, and `CREATE DATABASE` have been moved to dedicated subcommands (see `--help` for more information).
- Colors are back! :tada: (but can be disabled with the `--no-colors` flag if needed for any reason)
- To choose the database to query, a new flag `-d` or `--database` is now used instead of the `USE` command inside the REPL.
