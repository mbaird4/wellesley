import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class DataContextService {
  private verified = false;
  private authRequired = false;

  async resolveProfile(): Promise<void> {
    try {
      const base =
        document.querySelector('base')?.getAttribute('href') || '/';
      const response = await fetch(`${base}data/dcfg.txt`);

      if (response.ok) {
        const text = (await response.text()).trim();

        if (text === 'v1' || text === 'v1-auth') {
          this.verified = true;
        }

        if (text === 'v1-auth') {
          this.authRequired = true;
        }
      }
    } catch {
      // Network error → standard profile
    }
  }

  /** Real data (not scrambled). */
  isVerified(): boolean {
    return this.verified;
  }

  /** Password gate needed (prod deploy). */
  isAuthRequired(): boolean {
    return this.authRequired;
  }
}
