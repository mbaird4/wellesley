import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

const PASSWORD_HASH =
  '0d3e8d6bfcf410ae73561671871f8b258d64529620c2dad88b5c46dbe4790af6';

@Component({
  imports: [
    RouterModule,
    FormsModule,
  ],
  selector: 'ws-root',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected title = 'Wellesley Softball Stats Hub';
  protected authenticated = sessionStorage.getItem('wellesley-auth') === 'true';
  protected password = '';
  protected error = false;

  protected async checkPassword() {
    const encoded = new TextEncoder().encode(this.password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (hex === PASSWORD_HASH) {
      sessionStorage.setItem('wellesley-auth', 'true');
      this.authenticated = true;
    } else {
      this.error = true;
    }
  }
}
