import { useState, useCallback, useRef, useEffect } from "react";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
}

interface OverridableTokenClientConfig {
  readonly prompt?: string;
}

interface TokenClient {
  requestAccessToken(config?: OverridableTokenClientConfig): void;
}

declare global {
  var google: {
    accounts: {
      oauth2: {
        initTokenClient(config: TokenClientConfig): TokenClient;
      };
    };
  };
}

const TOKEN_KEY = "mamimu_token";
const REFRESH_BEFORE_MS = 60_000;

function loadToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { token, expiresAt } = JSON.parse(raw);
    if (Date.now() < expiresAt) return token;
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    localStorage.removeItem(TOKEN_KEY);
  }
  return null;
}

function saveToken(token: string, expiresIn: number): number {
  const expiresAt = Date.now() + (expiresIn - 300) * 1000;
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt }));
  return expiresAt;
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export interface UseGoogleAuthOptions {
  clientId: string;
  scope: string;
  onInitialToken: (token: string) => void;
  onStatus: (status: string) => void;
}

export function useGoogleAuth({ clientId, scope, onInitialToken, onStatus }: UseGoogleAuthOptions) {
  const [token, setToken] = useState<string | null>(loadToken);

  const tokenClientRef = useRef<TokenClient | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef(token);
  const recoveringRef = useRef(false);
  const onStatusRef = useRef(onStatus);
  const onInitialTokenRef = useRef(onInitialToken);

  // Keep refs in sync during render (safe: refs are never read during render)
  tokenRef.current = token;
  onStatusRef.current = onStatus;
  onInitialTokenRef.current = onInitialToken;

  const handleTokenResponse = useCallback((res: TokenResponse) => {
    recoveringRef.current = false;
    if (res.access_token) {
      setToken(res.access_token);
      const expiresAt = saveToken(res.access_token, res.expires_in);
      const delay = expiresAt - Date.now() - REFRESH_BEFORE_MS;
      if (delay > 0) {
        refreshTimerRef.current = setTimeout(() => {
          tokenClientRef.current?.requestAccessToken({ prompt: "" });
        }, delay);
      }
      if (!tokenRef.current) {
        onStatusRef.current("Signed in");
        onInitialTokenRef.current(res.access_token);
      }
    } else if (tokenRef.current) {
      clearToken();
      setToken(null);
      onStatusRef.current("Session expired. Sign in again.");
    } else {
      onStatusRef.current("Authentication failed");
    }
  }, []);

  const ensureTokenClient = useCallback(() => {
    if (!tokenClientRef.current) {
      tokenClientRef.current = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope,
        callback: handleTokenResponse,
      });
    }
    return tokenClientRef.current;
  }, [clientId, scope, handleTokenResponse]);

  const login = useCallback(() => {
    ensureTokenClient().requestAccessToken();
  }, [ensureTokenClient]);

  const recoverAuth = useCallback(() => {
    if (tokenClientRef.current && !recoveringRef.current) {
      recoveringRef.current = true;
      tokenClientRef.current.requestAccessToken({ prompt: "" });
      return;
    }
    clearToken();
    setToken(null);
    onStatusRef.current("Session expired. Sign in again.");
  }, []);

  useEffect(() => {
    if (token) {
      try {
        const raw = localStorage.getItem(TOKEN_KEY);
        if (raw) {
          const { expiresAt } = JSON.parse(raw);
          const delay = expiresAt - Date.now() - REFRESH_BEFORE_MS;
          if (delay > 0) {
            ensureTokenClient();
            refreshTimerRef.current = setTimeout(() => {
              tokenClientRef.current?.requestAccessToken({ prompt: "" });
            }, delay);
          }
        }
      } catch {
        // ignore
      }
    }
  }, []);

  return { token, login, recoverAuth };
}
