import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type { UploadedFile } from './drive-upload.service';

@Component({
  selector: 'ws-drive-upload-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './drive-upload-toast.html',
})
export class DriveUploadToast {
  readonly files = input.required<UploadedFile[]>();
  readonly folderName = input<string>('');

  readonly dismissed = output<void>();
}
