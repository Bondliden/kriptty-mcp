# kriptty-mcp

MCP server for the Kriptty admin API (antbot, `routes/api.php` → `/api/admin`, branch `agentes-api`). Exposes 38 tools for managing users, exchanges, bots, grids, routines, and trades through the [Model Context Protocol](https://modelcontextprotocol.io/).

This is a fork of [kosta-poland/kriptty-mcp](https://github.com/kosta-poland/kriptty-mcp) whose client calls match the routes and response shapes of the deployed admin API (see [Changes from upstream](#changes-from-upstream)).

Supports two transport modes:
- **stdio** — for local clients (Claude Desktop, Claude Code)
- **Streamable HTTP** — for remote clients (n8n, custom integrations)

## Available Tools

Tools marked with \* only read; they are the only ones registered when `KRIPTTY_READ_ONLY=1`.

### Users (9)
`list_users`\* `get_user`\* `create_user` `update_user_email` `update_user_name` `update_user_password` `update_user_admin` `update_user_role` `list_roles`\*

### Exchanges (8)
`list_exchange_parameters`\* `list_exchanges`\* `get_exchange`\* `create_exchange` `update_exchange` `refresh_exchange` `list_exchange_symbols`\* `list_positions`\*

### Bots (9)
`list_bot_parameters`\* `list_bots`\* `get_bot`\* `create_bot` `update_bot` `start_bot` `stop_bot` `restart_bot` `get_bot_status`\*

### Grids (2)
`list_grids`\* `get_grid`\*

### Routines (6)
`list_routine_parameters`\* `list_routines`\* `get_routine`\* `create_routine` `update_routine` `run_routine`

### Trades (4)
`list_trades`\* `get_trade`\* `list_trade_symbols`\* `get_pnl_stats`\*

## Installation

The fork is not published to npm. Build it from source:

```bash
git clone https://github.com/Bondliden/kriptty-mcp.git
cd kriptty-mcp
npm ci
npm run build
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `KRIPTTY_API_URL` | Yes | — | Kriptty admin API base URL (e.g. `https://your-api.domain.com/api/admin`) |
| `KRIPTTY_API_TOKEN` | Yes | — | Admin API token (`ADMIN_API_TOKEN` on the server) |
| `KRIPTTY_READ_ONLY` | No | — | `1` registers only the read tools |
| `KRIPTTY_MAX_REQUESTS_PER_MINUTE` | No | `50` | Client-side limit (the API allows 60 per minute per IP, shared with any other client on the same IP) |
| `KRIPTTY_TIMEOUT_MS` | No | `60000` | Timeout per API request |
| `TRANSPORT_MODE` | No | `stdio` | Transport mode: `stdio` or `http` |
| `HTTP_PORT` | No | `3000` | HTTP server port (only used when `TRANSPORT_MODE=http`) |
| `MCP_AUTH_TOKENS` | When `http` | — | Comma-separated Bearer tokens for HTTP auth |

When the API answers 429, the client waits for `Retry-After` and retries (up to twice, if the wait is 30 s or less); otherwise the tool reports when to retry.

## Connecting to Claude Desktop

Add to your `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "kriptty": {
      "command": "node",
      "args": ["/path/to/kriptty-mcp/dist/index.js"],
      "env": {
        "KRIPTTY_API_URL": "https://your-api.domain.com/api/admin",
        "KRIPTTY_API_TOKEN": "your-admin-api-token"
      }
    }
  }
}
```

Restart Claude Desktop after changing it.

## Connecting to Claude Code

```bash
claude mcp add kriptty -e KRIPTTY_API_URL=https://your-api.domain.com/api/admin -e KRIPTTY_API_TOKEN=your-admin-api-token -- node /path/to/kriptty-mcp/dist/index.js
```

## Connecting to n8n (HTTP mode)

### 1. Start the server in HTTP mode

```bash
TRANSPORT_MODE=http \
HTTP_PORT=3000 \
MCP_AUTH_TOKENS=your-secret-token \
KRIPTTY_API_URL=https://your-api.domain.com/api/admin \
KRIPTTY_API_TOKEN=your-admin-api-token \
node dist/index.js
```

The server exposes:
- `POST /mcp` — MCP request endpoint
- `GET /mcp` — SSE stream endpoint
- `DELETE /mcp` — session termination
- `GET /health` — health check (no auth)

### 2. Configure n8n

1. Create an AI Agent workflow in n8n
2. Add an **MCP Client** tool node to the agent
3. Set **SSE Endpoint** to `http://your-server:3000/mcp`
4. Under **Authentication**, select **Bearer Auth** and enter a token matching one of your `MCP_AUTH_TOKENS`

## Read-only smoke test

```bash
npm run build
npm run smoke -- --trades-exchange <exchange_id>
```

It starts the server with `KRIPTTY_READ_ONLY=1`, checks that only read tools are exposed, and calls each of them (about 25 GET requests, paced under the rate limit). Credentials come from the environment or from the `kriptty` entry of Claude Desktop's config; the token is never printed. Optional flags: `--user`, `--exchange`, `--bot`, `--grid`, `--trades-exchange` (an account with synced trades).

## Changes from upstream

Upstream 1.0.3 called endpoints that the admin API does not have and expected every response wrapped in `{ data }`. Only `GET /users` does that; the rest return the object or array as is.

| Tool | Upstream call | Admin API |
|---|---|---|
| `list_exchanges` | `GET /exchanges?user_id=` (405) | `GET /users/{id}/exchanges` |
| `update_user_*` | `PATCH /users/{id}` (405) | `PUT /users/{id}/email`, `/name`, `/password`, `/admin`, `/role` |
| `update_exchange`, `update_bot`, `update_routine` | `PATCH` (405) | `PUT` |
| `list_trades` | `GET /trades?exchange_id=` (404) | `GET /exchanges/{id}/trades` (Laravel paginator, no `meta`) |
| `list_trade_symbols` | `GET /trades/symbols` (404) | `GET /exchanges/{id}/trade-symbols` |
| `get_pnl_stats` | `GET /trades/stats/pnl` (404) | `GET /exchanges/{id}/pnl-stats` returns raw trades; aggregated here |
| `list_*_parameters` | `/bot-parameters`, `/exchange-parameters`, `/routine-parameters` (404) | built from antbot's enums + `GET /grids` |
| `list_roles` | hard-coded | `GET /roles` |

Other changes:

- New tools for the endpoints the agents use: `list_grids`, `get_grid`, `list_exchange_symbols`, `list_positions`.
- Removed `swap_bot_we` and `simple_swap_bot_we`: the API has no such endpoints (`update_bot` with `lwe`/`swe` covers them).
- Bots have no `is_running` field in JSON: the listing derives it from `started_at` + `pid` (same rule as the model), and `get_bot` adds the live process check of `/bots/{id}/status`. Listings are one line per bot and resolve symbol names.
- `update_bot` follows the API validation (wallet exposure 0–2, leverage 1–20, `symbol` by name, `restart`); `market_type` and `oh_mode` are not accepted by the API and were removed.
- `create_bot` takes the owner from the exchange (POST /bots does not set `user_id`) and refuses a symbol that already has a bot in that account.
- `update_routine` merges the action with the stored one (the API replaces the whole JSON).
- `list_trades` accepts short symbol names (`BTCUSDT`) and maps them to the exchange symbol (`BTCUSDT_UMCBL`); `sort_by`/`sort_order` were removed (the API always sorts newest first) and `page` was added.
- User output never includes the 2FA fields that the API serializes.
- Client-side rate limiting, 429 retries with `Retry-After`, request timeout, short error messages with the token scrubbed, tool annotations (`readOnlyHint`, `destructiveHint`) and `KRIPTTY_READ_ONLY`.

### Known issues in the admin API (server side)

- `POST /exchanges` fails: `Exchange::$fillable` lacks `user_id`, so `Exchange::create($request->all())` drops it (and `is_testnet`).
- `POST /exchanges/{id}/refresh` and `POST /routines/{id}/run` are stubs: they return the stored record without syncing or executing anything.
- `GET /users` and `GET /users/{id}` serialize `two_factor_secret` and `two_factor_recovery_codes` (`User::$hidden` only lists `password` and `remember_token`).
- `POST /bots` and `POST /routines` do no validation.

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Build
npm run build

# Run production build
npm start
```

## License

ISC
