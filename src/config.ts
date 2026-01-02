export interface TransportConfig {
  transportMode: 'stdio' | 'http';
  httpPort: number;
  authTokens: string[];
}

export interface ApiConfig {
  apiUrl: string;
  apiToken: string;
}

export interface Config extends TransportConfig, ApiConfig {}

function getEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || '';
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
  };
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
