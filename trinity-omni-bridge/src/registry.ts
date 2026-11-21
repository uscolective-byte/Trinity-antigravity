import { BridgeAdapter, Env, ProviderMetadata } from "./types";

export class AdapterRegistry {
  private adapters = new Map<string, BridgeAdapter>();

  register(adapter: BridgeAdapter): this {
    this.adapters.set(adapter.id.toLowerCase(), adapter);
    return this;
  }

  get(id: string): BridgeAdapter | undefined {
    return this.adapters.get(id.toLowerCase());
  }

  list(env: Env): ProviderMetadata[] {
    return Array.from(this.adapters.values()).map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      actions: a.actions,
      configured: a.isConfigured(env),
    }));
  }

  has(id: string): boolean {
    return this.adapters.has(id.toLowerCase());
  }
}
