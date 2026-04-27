import { Injectable } from '@angular/core';
import { GOOGLE_CLIENT_ID, GOOGLE_DRIVE_SCOPE } from '@ws/core/util';

interface CachedToken {
  token: string;
  expiresAt: number;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  error?: string;
}

interface TokenClient {
  callback: (resp: TokenResponse) => void;
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface GoogleAccountsOAuth2 {
  initTokenClient: (cfg: { client_id: string; scope: string; callback: (resp: TokenResponse) => void }) => TokenClient;
  revoke: (token: string, callback?: () => void) => void;
}

export interface GoogleGlobal {
  accounts: { oauth2: GoogleAccountsOAuth2 };
}

declare global {
  interface Window {
    google?: unknown;
  }
}

const TOKEN_STORAGE_KEY = 'wellesley.driveToken';
const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

@Injectable({
  providedIn: 'root',
})
export class DriveAuthService {
  private scriptPromise: Promise<void> | null = null;
  private tokenClient: TokenClient | null = null;

  async getAccessToken(): Promise<string> {
    const cached = this.readCachedToken();

    if (cached) {
      return cached;
    }

    await this.loadGisScript();

    const google = window.google as GoogleGlobal | undefined;

    if (!google) {
      throw new Error('Google Identity Services failed to load');
    }

    return new Promise<string>((resolve, reject) => {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPE,
        callback: (resp) => {
          if (resp.error) {
            reject(new Error(`Drive auth failed: ${resp.error}`));

            return;
          }

          this.writeCachedToken(resp.access_token, resp.expires_in);
          resolve(resp.access_token);
        },
      });

      this.tokenClient.requestAccessToken();
    });
  }

  signOut(): void {
    const cached = this.readCachedToken();

    sessionStorage.removeItem(TOKEN_STORAGE_KEY);

    const google = window.google as GoogleGlobal | undefined;

    if (cached && google) {
      google.accounts.oauth2.revoke(cached);
    }
  }

  private loadGisScript(): Promise<void> {
    if (this.scriptPromise) {
      return this.scriptPromise;
    }

    this.scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_SRC}"]`);

      if (existing) {
        resolve();

        return;
      }

      const script = document.createElement('script');

      script.src = GIS_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    });

    return this.scriptPromise;
  }

  private readCachedToken(): string | null {
    try {
      const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);

      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as CachedToken;

      if (parsed.expiresAt > Date.now() + 60_000) {
        return parsed.token;
      }
    } catch {
      /* ignore */
    }

    return null;
  }

  private writeCachedToken(token: string, expiresInSec: number): void {
    try {
      const cached: CachedToken = {
        token,
        expiresAt: Date.now() + expiresInSec * 1000,
      };

      sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(cached));
    } catch {
      /* ignore */
    }
  }
}
