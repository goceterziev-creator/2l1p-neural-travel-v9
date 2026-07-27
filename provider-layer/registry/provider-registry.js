"use strict";

const { assertProviderType } = require("../contracts/provider-types");

class ProviderRegistry {
  constructor() {
    this.providersById = new Map();
    this.providersByType = new Map();
  }

  register(provider) {
    validateProvider(provider);

    if (this.providersById.has(provider.id)) {
      throw new Error(`Provider already registered: ${provider.id}`);
    }

    this.providersById.set(provider.id, provider);

    const providers = this.providersByType.get(provider.type) || [];
    providers.push(provider);
    this.providersByType.set(provider.type, providers);

    return provider;
  }

  get(idOrType) {
    const key = String(idOrType || "").trim();
    if (this.providersById.has(key)) return this.providersById.get(key);

    assertProviderType(key);
    const providers = this.providersByType.get(key) || [];
    if (!providers.length) {
      throw new Error(`No provider registered for type: ${key}`);
    }
    return providers[0];
  }

  list(type = "") {
    if (!type) return Array.from(this.providersById.values());
    assertProviderType(type);
    return [...(this.providersByType.get(type) || [])];
  }
}

function validateProvider(provider) {
  if (!provider || typeof provider !== "object") {
    throw new Error("Provider must be an object");
  }
  if (!provider.id || typeof provider.id !== "string") {
    throw new Error("Provider id is required");
  }
  assertProviderType(provider.type);
  if (!provider.version || typeof provider.version !== "string") {
    throw new Error(`Provider version is required for ${provider.id}`);
  }
  if (typeof provider.health !== "function") {
    throw new Error(`Provider health() is required for ${provider.id}`);
  }
  if (typeof provider.execute !== "function") {
    throw new Error(`Provider execute() is required for ${provider.id}`);
  }
}

function createProviderRegistry(providers = []) {
  const registry = new ProviderRegistry();
  providers.forEach((provider) => registry.register(provider));
  return registry;
}

module.exports = {
  ProviderRegistry,
  createProviderRegistry,
  validateProvider
};
