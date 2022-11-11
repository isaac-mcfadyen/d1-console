# D1 Console

**A console/REPL for [Cloudflare's D1 Database](https://blog.cloudflare.com/introducing-d1/) product.**

[NPM](https://www.npmjs.com/package/d1-console) | [GitHub](https://github.com/isaac-mcfadyen/d1-console)

Supports all the features expected of a modern database client, including:

- multiline queries
- table-formatted query outputs
- command history
- the ability to save your Cloudflare credentials for later use (opt-in)

## Usage

- First, run `d1-console login --account-id <ID> --api-token <TOKEN>` to save your credentials for later use. To generate an API token, go to the [API Tokens page](https://dash.cloudflare.com/profile/api-tokens) on the Cloudflare dashboard. Your account ID can be found on any zone (domain) of your Cloudflare account.
- You can now create a database using `d1-console databases create <NAME>`.
- To query your new D1 database, you can use the `d1-console -d <NAME>` command.

## CI/CD

- If you wish to use D1 Console in CI/CD pipelines, the flag `--execute` can be used to immediately execute a command passed in (e.g. `--execute "SELECT * FROM USERS;"`, make sure to include a semicolon at the end). In addition, D1 Console will now prefer `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` environment variables over the saved authentication (if any).

## Community

For more information, to get help, or just to chat about D1 and D1 Console, join us on the [Cloudflare Developers
Discord](https://discord.gg/cloudflaredev)!
