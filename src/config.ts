export interface TransportConfig {
  transportMode: 'stdio' | 'http';
  httpPort: number;
  authTokens: string[];
}

export interface ApiConfig {
  apiUrl: string;
  apiToken: string;
  timeoutMs: number;
  maxRequestsPerMinute: number;
}

export interface Config extends TransportConfig, ApiConfig {}

function getEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || '';
}

function getIntEnvVar(name: string, fallback: number): number {
  const value = parseInt(getEnvVar(name, false), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getTransportConfig(): TransportConfig {
  const transportMode = (getEnvVar('TRANSPORT_MODE', false) || 'stdio') as 'stdio' | 'http';
  const authTokensStr = getEnvVar('MCP_AUTH_TOKENS', transportMode === 'http');

  return {
    transportMode,
    httpPort: parseInt(getEnvVar('HTTP_PORT', false) || '3000', 10),
    authTokens: authTokensStr ? authTokensStr.split(',').map(t => t.trim()).filter(Boolean) : [],
  };
}

export function getApiConfig(): ApiConfig {
  return {
    apiUrl: getEnvVar('KRIPTTY_API_URL'),
    apiToken: getEnvVar('KRIPTTY_API_TOKEN'),
    timeoutMs: getIntEnvVar('KRIPTTY_TIMEOUT_MS', 60_000),
    // The admin API allows 60 requests per minute per IP; stay below it so other clients
    // on the same IP (e.g. the daily agents) keep some headroom.
    maxRequestsPerMinute: Math.min(getIntEnvVar('KRIPTTY_MAX_REQUESTS_PER_MINUTE', 50), 60),
  };
}

/** KRIPTTY_READ_ONLY=1 registers only the tools that never change anything in Kriptty. */
export function isReadOnly(): boolean {
  return /^(1|true|yes)$/i.test(getEnvVar('KRIPTTY_READ_ONLY', false));
}

let config: Config | null = null;

export function loadConfig(): Config {
  return {
    ...getTransportConfig(),
    ...getApiConfig(),
  };
}

export function getConfig(): Config {
  if (!config) {
    config = loadConfig();
  }
  return config;
}
