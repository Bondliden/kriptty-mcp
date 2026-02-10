# kriptty-mcp

MCP server for the Kriptty admin API. Exposes 37 tools for managing users, exchanges, bots, routines, and trades through the [Model Context Protocol](https://modelcontextprotocol.io/).

Supports two transport modes:
- **stdio** — for local clients (Claude Desktop, Claude Code)
- **Streamable HTTP** — for remote clients (n8n, custom integrations)

## Available Tools

### Users (9)
`list_users` `get_user` `create_user` `update_user_email` `update_user_name` `update_user_password` `update_user_admin` `update_user_role` `list_roles`

### Exchanges (7)
`list_exchange_parameters` `list_exchanges` `get_exchange` `create_exchange` `update_exchange` `refresh_exchange`

### Bots (11)
`list_bot_parameters` `list_bots` `get_bot` `create_bot` `update_bot` `start_bot` `stop_bot` `restart_bot` `swap_bot_we` `simple_swap_bot_we` `get_bot_status`

### Routines (6)
`list_routine_parameters` `list_routines` `get_routine` `create_routine` `update_routine` `run_routine`

### Trades (4)
`list_trades` `get_trade` `list_trade_symbols` `get_pnl_stats`

## Installation

```bash
npm install -g kriptty-mcp
```

Or run directly with npx:

```bash
npx kriptty-mcp
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `KRIPTTY_API_URL` | Yes | — | Kriptty admin API base URL (e.g. `https://your-api.domain.com/api/admin`) |
| `KRIPTTY_API_TOKEN` | Yes | — | Admin API token |
| `TRANSPORT_MODE` | No | `stdio` | Transport mode: `stdio` or `http` |
| `HTTP_PORT` | No | `3000` | HTTP server port (only used when `TRANSPORT_MODE=http`) |
| `MCP_AUTH_TOKENS` | When `http` | — | Comma-separated Bearer tokens for HTTP auth |

## Connecting to Claude Desktop

Add to your `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "kriptty": {
      "command": "npx",
      "args": ["-y", "kriptty-mcp"],
      "env": {
        "KRIPTTY_API_URL": "https://your-api.domain.com/api/admin",
        "KRIPTTY_API_TOKEN": "your-admin-api-token"
      }
    }
  }
}
```

## Connecting to Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "kriptty": {
      "command": "npx",
      "args": ["-y", "kriptty-mcp"],
      "env": {
        "KRIPTTY_API_URL": "https://your-api.domain.com/api/admin",
        "KRIPTTY_API_TOKEN": "your-admin-api-token"
      }
    }
  }
}
```

Or add via the CLI:

```bash
claude mcp add kriptty -- npx -y kriptty-mcp
```

## Connecting to n8n (HTTP mode)

### 1. Start the server in HTTP mode

```bash
TRANSPORT_MODE=http \
HTTP_PORT=3000 \
MCP_AUTH_TOKENS=your-secret-token \
KRIPTTY_API_URL=https://your-api.domain.com/api/admin \
KRIPTTY_API_TOKEN=your-admin-api-token \
npx kriptty-mcp
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
