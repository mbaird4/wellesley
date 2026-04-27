import { Injectable } from '@angular/core';

export interface UploadedFile {
  id: string;
  name: string;
  webViewLink: string;
}

interface DriveFileResponse {
  id: string;
  name: string;
  webViewLink: string;
}

const UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';

@Injectable({
  providedIn: 'root',
})
export class DriveUploadService {
  async uploadPdf(blob: Blob, filename: string, folderId: string, token: string): Promise<UploadedFile> {
    const metadata = {
      name: filename,
      mimeType: 'application/pdf',
      parents: [folderId],
    };
    const body = new FormData();

    body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    body.append('file', blob);

    const response = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    });

    if (!response.ok) {
      const text = await response.text();

      throw new Error(`Drive upload failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as DriveFileResponse;

    return { id: data.id, name: data.name, webViewLink: data.webViewLink };
  }
}
