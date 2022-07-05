# D1 Console

**A console/REPL for [Cloudflare's D1 Database](https://blog.cloudflare.com/introducing-d1/) product.**

Supports all the features expected of a modern database client, including:

- multiline queries
- table-formatted query outputs
- command history
- the ability to save your Cloudflare credentials for later use (opt-in)

To get started, run `npx d1-console` (or use another package manager of your choice). To authenticate, you need:

- your account ID, can be found on any zone (domain) of your Cloudflare account
- an API token with the D1 Edit permission, which can be generated on the Cloudflare dashboard

Options:

- `--json` to run in JSON mode (no table graphics).
- `--json-all` to show the entire JSON response (including parameters such as query time).

For more info and to get help, join us on the [Cloudflare Developers 
Discord](https://discord.gg/cloudflaredev)!
