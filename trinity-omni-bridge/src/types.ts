export interface Env {
  TRINITY_API_KEY: string;
  TRINITY_MCP_URL?: string;
  TRINITY_ENV?: string;
  BRIDGE_AUTH_TOKEN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  GITHUB_TOKEN?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  META_APP_ID?: string;
  META_APP_SECRET?: string;
}

export interface InvokeRequest {
  provider: string;
  action: string;
  payload?: Record<string, unknown>;
  notifyTelegram?: boolean;
}

export interface InvokeResponse {
  ok: boolean;
  provider: string;
  action: string;
  result?: unknown;
  error?: string;
  timestamp: string;
}

export interface ProviderMetadata {
  id: string;
  name: string;
  description: string;
  actions: string[];
  configured: boolean;
}

export interface BridgeAdapter {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly actions: string[];
  isConfigured(env: Env): boolean;
  execute(action: string, payload: Record<string, unknown>, env: Env): Promise<unknown>;
  handleWebhook?(req: Request, env: Env): Promise<Response>;
}
