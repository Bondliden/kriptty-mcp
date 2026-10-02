import { getConfig } from '../config.js';
import { VERSION } from '../version.js';

// Response shapes of the Kriptty admin API (antbot, AdminApiController, routes/api.php → /api/admin).
// Only GET /users wraps its payload in { data }; every other endpoint returns the object or array as is.
// Booleans stored as tinyint arrive as 0/1.

export interface User {
  id: number;
  name: string;
  email: string;
  admin: number | boolean;
  role: number;
  exchange_id: number | null;
  timezone: string | null;
  last_seen: string | null;
  two_factor_confirmed?: number | boolean | null;
  created_at: string;
  updated_at: string;
  // The API also serializes two_factor_secret and two_factor_recovery_codes: never read or print them.
}

export interface Role {
  id: number;
  name: string;
}

export interface Exchange {
  id: number;
  user_id: number;
  name: string;
  slug: string | null;
  exchange: string;
  risk_mode: number | string;
  is_testnet: number | boolean | null;
  api_error: number | boolean | null;
  usd_balance: string | null;
  usdt_balance: string | null;
  btc_balance: string | null;
  eth_balance: string | null;
  initial_usdt_balance: string | null;
  initial_balance_recorded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExchangeSymbol {
  id: number;
  name: string;
  nice_name: string;
}

export interface Position {
  symbol: string;
  side: string;
  size: number;
  entry_price: number;
  liq_price: number;
  position_value: number;
  unrealised_pnl: number;
  leverage: number | string | null;
  updated_at: string;
}

/** Raw bot row: no relations and no is_running (it is an accessor, not a column). */
export interface Bot {
  id: number;
  user_id: number;
  name: string;
  symbol_id: number;
  market_type: string;
  grid_mode: string;
  grid_id: number | null;
  exchange_id: number;
  assigned_balance: number;
  leverage: number;
  lm: string;
  lwe: number;
  sm: string;
  swe: number;
  pid: number | null;
  show_logs: number | boolean;
  is_on_trend: number | boolean;
  is_on_routines: number | boolean;
  oh_mode: number | boolean;
  trend_5m?: string | null;
  trend_15m?: string | null;
  trend_30m?: string | null;
  trend_1h?: string | null;
  started_at: string | null;
  stopped_at: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /bots/{id}/status: `running` checks the process on the server (ps -p pid). */
export interface BotStatus {
  running: boolean;
  pid: number | null;
  started_at: string | null;
  symbol: string | null;
  lm: string;
  lwe: number;
  sm: string;
  swe: number;
  leverage: number;
}

export interface BotActionResult {
  success: boolean;
  already_running?: boolean;
  bot: Bot;
}

export interface BotUpdateResult {
  bot: Bot;
  restarted: boolean | null;
}

export interface BotCreateData {
  user_id: number;
  name: string;
  exchange_id: number;
  symbol_id: number;
  market_type: string;
  grid_mode: string;
  grid_id: number | null;
  lm: string;
  lwe: number;
  sm: string;
  swe: number;
  leverage: number;
  assigned_balance: number;
  oh_mode: boolean;
  show_logs: boolean;
  is_on_trend: boolean;
  is_on_routines: boolean;
}

/** Fields accepted by PUT /bots/{id} (validated server-side; anything else is ignored). */
export interface BotUpdateData {
  name?: string;
  symbol_id?: number;
  symbol?: string;
  lm?: string;
  lwe?: number;
  sm?: string;
  swe?: number;
  leverage?: number;
  grid_mode?: string;
  grid_id?: number;
  assigned_balance?: number;
  is_on_trend?: boolean;
  is_on_routines?: boolean;
  show_logs?: boolean;
  restart?: boolean;
}

export interface GridSummary {
  id: number;
  name: string;
  description: string | null;
  user_id: number;
  updated_at: string;
  bots_count: number;
}

export interface GridDetail {
  id: number;
  name: string;
  description: string | null;
  user_id: number;
  config: unknown;
  updated_at: string;
}

/** Stored routines keep whatever types they were saved with (older ones use strings, e.g. "0.07"). */
export interface RoutineAction {
  grid_mode: string;
  grid_id: number | string;
  lm: string;
  lwe: number | string;
  sm: string;
  swe: number | string;
}

export interface Routine {
  id: string;
  user_id: number;
  bot_group_id?: number | null;
  name: string;
  type: string;
  action: RoutineAction;
  triggered_at: string | null;
  triggered_by: string | null;
  end_scheduled_at?: string | null;
  is_end_scheduled?: number | boolean;
  created_at: string;
  updated_at: string;
}

export interface Trade {
  id: number;
  exchange_id: number;
  position_id: number;
  order_oid: string | null;
  symbol: string;
  order_id: string;
  side: string;
  qty: string | null;
  order_price: number | null;
  order_type: string;
  exec_type: string;
  closed_size: string | null;
  cum_entry_value: string | null;
  avg_entry_price: string | null;
  cum_exit_value: string | null;
  avg_exit_price: string | null;
  closed_pnl: string | null;
  fill_count: number | null;
  leverage: number | null;
  created_at: string;
  updated_at: string;
}

/** Laravel LengthAwarePaginator serialized as is (no meta/links wrapper). */
export interface LaravelPage<T> {
  current_page: number;
  data: T[];
  from: number | null;
  last_page: number;
  per_page: number | string;
  to: number | null;
  total: number;
  next_page_url: string | null;
  prev_page_url: string | null;
}

export interface TradeListParams {
  symbol?: string;
  from_date?: string;
  to_date?: string;
  per_page?: number;
  page?: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message?: string
  ) {
    super(message || `API Error: ${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

const USER_AGENT = `kriptty-mcp/${VERSION}`;
const MAX_ERROR_BODY = 300;
// A 429 is rejected before reaching the controller, so retrying is safe for any method.
// Only wait when the window is about to reset; otherwise report it instead of stalling the tool call.
const MAX_RETRY_WAIT_SECONDS = 30;
const MAX_RATE_LIMIT_RETRIES = 2;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.append(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export class KripttyApiClient {
  private baseUrl: string;
  private token: string;
  private timeoutMs: number;
  private maxRequestsPerMinute: number;
  private sentAt: number[] = [];

  constructor() {
    const config = getConfig();
    this.baseUrl = config.apiUrl.replace(/\/$/, '');
    this.token = config.apiToken;
    this.timeoutMs = config.timeoutMs;
    this.maxRequestsPerMinute = config.maxRequestsPerMinute;
  }

  /** Sliding one-minute window so this process never exceeds its share of the API rate limit. */
  private async throttle(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.sentAt = this.sentAt.filter(t => now - t < 60_000);
      if (this.sentAt.length < this.maxRequestsPerMinute) {
        this.sentAt.push(now);
        return;
      }
      await sleep(60_000 - (now - this.sentAt[0]) + 50);
    }
  }

  private scrub(text: string): string {
    return this.token ? text.split(this.token).join('***') : text;
  }

  private describeErrorBody(body: string): string {
    try {
      const parsed = JSON.parse(body) as { message?: string; errors?: Record<string, string[]> };
      const details = parsed.errors
        ? Object.entries(parsed.errors).map(([field, messages]) => `${field}: ${messages.join(' ')}`).join('; ')
        : '';
      const text = [parsed.message, details].filter(Boolean).join(' ');
      if (text) {
        return this.scrub(text).slice(0, MAX_ERROR_BODY);
      }
    } catch {
      // not JSON (e.g. an HTML error page): fall through
    }
    return this.scrub(body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, MAX_ERROR_BODY);
  }

  private async request<T>(method: string, endpoint: string, body?: unknown, attempt: number = 0): Promise<T> {
    await this.throttle();

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/json',
      'User-Agent': USER_AGENT,
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ApiError(0, 'Network error', `${method} ${endpoint} failed: ${this.scrub(reason)}`);
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after') ?? '60');
      const wait = Number.isFinite(retryAfter) ? retryAfter : 60;
      if (attempt < MAX_RATE_LIMIT_RETRIES && wait <= MAX_RETRY_WAIT_SECONDS) {
        await sleep((wait + 1) * 1000);
        return this.request<T>(method, endpoint, body, attempt + 1);
      }
      throw new ApiError(429, 'Too Many Requests',
        `${method} ${endpoint} failed: rate limit reached (the admin API allows 60 requests per minute per IP). Retry in ${wait} s.`);
    }

    const text = await response.text();
    if (!response.ok) {
      throw new ApiError(
        response.status,
        response.statusText,
        `${method} ${endpoint} failed: ${response.status} ${response.statusText}. ${this.describeErrorBody(text)}`
      );
    }
    if (!text) {
      return null as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError(response.status, 'Invalid JSON',
        `${method} ${endpoint} returned a non-JSON body: ${this.describeErrorBody(text)}`);
    }
  }

  // Users
  async listUsers(): Promise<{ data: User[] }> {
    return this.request('GET', '/users');
  }

  async getUser(id: number): Promise<User> {
    return this.request('GET', `/users/${id}`);
  }

  async createUser(data: { name: string; email: string; password: string; role: number; admin: boolean }): Promise<User> {
    return this.request('POST', '/users', data);
  }

  async updateUserEmail(id: number, email: string): Promise<User> {
    return this.request('PUT', `/users/${id}/email`, { email });
  }

  async updateUserName(id: number, name: string): Promise<User> {
    return this.request('PUT', `/users/${id}/name`, { name });
  }

  async updateUserPassword(id: number, password: string): Promise<{ success: boolean }> {
    return this.request('PUT', `/users/${id}/password`, { password });
  }

  async updateUserAdmin(id: number, admin: boolean): Promise<User> {
    return this.request('PUT', `/users/${id}/admin`, { admin });
  }

  async updateUserRole(id: number, role: number): Promise<User> {
    return this.request('PUT', `/users/${id}/role`, { role });
  }

  async listRoles(): Promise<Role[]> {
    return this.request('GET', '/roles');
  }

  // Exchanges
  async listExchanges(userId: number): Promise<Exchange[]> {
    return this.request('GET', `/users/${userId}/exchanges`);
  }

  async getExchange(id: number): Promise<Exchange> {
    return this.request('GET', `/exchanges/${id}`);
  }

  async createExchange(data: {
    user_id: number;
    name: string;
    exchange: string;
    risk_mode: string;
    api_key: string;
    api_secret: string;
    api_frase?: string;
  }): Promise<Exchange> {
    return this.request('POST', '/exchanges', data);
  }

  async updateExchange(id: number, data: {
    name?: string;
    exchange?: string;
    risk_mode?: string;
    api_key?: string;
    api_secret?: string;
    api_frase?: string;
  }): Promise<Exchange> {
    return this.request('PUT', `/exchanges/${id}`, data);
  }

  async refreshExchange(id: number): Promise<{ success: boolean; exchange: Exchange }> {
    return this.request('POST', `/exchanges/${id}/refresh`);
  }

  async listExchangeSymbols(exchangeId: number, q?: string): Promise<ExchangeSymbol[]> {
    return this.request('GET', `/exchanges/${exchangeId}/symbols${query({ q })}`);
  }

  async listPositions(exchangeId: number): Promise<Position[]> {
    return this.request('GET', `/exchanges/${exchangeId}/positions`);
  }

  // Bots
  async listBots(params: { user_id?: number; exchange_id?: number }): Promise<Bot[]> {
    return this.request('GET', `/bots${query(params)}`);
  }

  async getBot(id: number): Promise<Bot> {
    return this.request('GET', `/bots/${id}`);
  }

  async createBot(data: BotCreateData): Promise<Bot> {
    return this.request('POST', '/bots', data);
  }

  async updateBot(id: number, data: BotUpdateData): Promise<BotUpdateResult> {
    return this.request('PUT', `/bots/${id}`, data);
  }

  async startBot(id: number): Promise<BotActionResult> {
    return this.request('POST', `/bots/${id}/start`);
  }

  async stopBot(id: number): Promise<BotActionResult> {
    return this.request('POST', `/bots/${id}/stop`);
  }

  async restartBot(id: number): Promise<BotActionResult> {
    return this.request('POST', `/bots/${id}/restart`);
  }

  async getBotStatus(id: number): Promise<BotStatus> {
    return this.request('GET', `/bots/${id}/status`);
  }

  // Grids (Passivbot configurations, read-only)
  async listGrids(userId?: number): Promise<GridSummary[]> {
    return this.request('GET', `/grids${query({ user_id: userId })}`);
  }

  async getGrid(id: number): Promise<GridDetail> {
    return this.request('GET', `/grids/${id}`);
  }

  // Routines
  async listRoutines(): Promise<Routine[]> {
    return this.request('GET', '/routines');
  }

  async getRoutine(id: string): Promise<Routine> {
    return this.request('GET', `/routines/${encodeURIComponent(id)}`);
  }

  async createRoutine(data: { user_id: number; name: string; type: string; action: RoutineAction }): Promise<Routine> {
    return this.request('POST', '/routines', data);
  }

  async updateRoutine(id: string, data: { name?: string; action?: RoutineAction }): Promise<Routine> {
    return this.request('PUT', `/routines/${encodeURIComponent(id)}`, data);
  }

  async runRoutine(id: string): Promise<{ success: boolean; routine: Routine }> {
    return this.request('POST', `/routines/${encodeURIComponent(id)}/run`);
  }

  // Trades
  async listTrades(exchangeId: number, params: TradeListParams): Promise<LaravelPage<Trade>> {
    return this.request('GET', `/exchanges/${exchangeId}/trades${query({ ...params })}`);
  }

  async getTrade(id: number): Promise<Trade> {
    return this.request('GET', `/trades/${id}`);
  }

  async listTradeSymbols(exchangeId: number): Promise<string[]> {
    return this.request('GET', `/exchanges/${exchangeId}/trade-symbols`);
  }

  /** GET /exchanges/{id}/pnl-stats returns the raw trades of the period (year/month on created_at), not aggregates. */
  async listPnlTrades(exchangeId: number, params: { year?: number; month?: number }): Promise<Trade[]> {
    return this.request('GET', `/exchanges/${exchangeId}/pnl-stats${query(params)}`);
  }
}

let client: KripttyApiClient | null = null;

export function getApiClient(): KripttyApiClient {
  if (!client) {
    client = new KripttyApiClient();
  }
  return client;
}
