import type { AdvertisingProvider } from "@ai-ads/shared";

export type ProviderAccount = {
  externalAccountId: string;
  name: string;
  accountStatus: string | null;
  currency: string | null;
  timezone: string | null;
  isManager: boolean | null;
  managerReference: string | null;
  businessContext: string | null;
};

export type ProviderCredentials = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  scopes: string[];
  identityReference: string | null;
};

export type ProviderAuthorization = {
  authorizationUrl: string;
  pkceVerifier: string | null;
};

export type ProviderAuthorizationInput = {
  state: string;
  redirectUri: string;
};

export interface AdvertisingProviderAdapter {
  readonly id: AdvertisingProvider;
  readonly displayName: string;
  readonly requiredConfiguration: readonly string[];
  readonly requestedScopes: readonly string[];
  readonly configured: boolean;
  createAuthorization(input: ProviderAuthorizationInput): ProviderAuthorization;
  exchangeAuthorizationCode(input: {
    code: string;
    redirectUri: string;
    pkceVerifier: string | null;
  }): Promise<ProviderCredentials>;
  validateAuthorization(credentials: ProviderCredentials): Promise<ProviderCredentials>;
  listAccessibleAccounts(credentials: ProviderCredentials): Promise<ProviderAccount[]>;
  getAccountDetails(
    externalAccountId: string,
    credentials: ProviderCredentials,
    managerReference?: string | null,
  ): Promise<ProviderAccount>;
  refreshCredentialsIfSupported(
    credentials: ProviderCredentials,
  ): Promise<ProviderCredentials | null>;
  verifyConnection(credentials: ProviderCredentials): Promise<ProviderAccount[]>;
  revokeAuthorizationIfSupported(credentials: ProviderCredentials): Promise<boolean>;
}

export class ProviderError extends Error {
  constructor(
    readonly code: string,
    readonly retryable = false,
  ) {
    super("The advertising provider could not complete the request.");
    this.name = "ProviderError";
  }
}
