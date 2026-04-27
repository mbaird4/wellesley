import { Injectable } from '@angular/core';
import { GOOGLE_API_KEY } from '@ws/core/util';

export interface DriveFolder {
  id: string;
  name: string;
}

interface PickerDocument {
  id: string;
  name: string;
}

interface PickerData {
  action: string;
  docs?: PickerDocument[];
}

interface PickerView {
  setMimeTypes(types: string): PickerView;
  setSelectFolderEnabled(enabled: boolean): PickerView;
}

interface PickerInstance {
  setVisible(visible: boolean): void;
}

interface PickerBuilder {
  addView(view: PickerView): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setCallback(cb: (data: PickerData) => void): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  build(): PickerInstance;
}

interface GoogleApi {
  load(name: string, cb: () => void): void;
}

interface PickerNamespace {
  ViewId: { FOLDERS: string };
  DocsView: new (viewId: string) => PickerView;
  PickerBuilder: new () => PickerBuilder;
  Action: { PICKED: string; CANCEL: string };
}

interface GoogleGlobalWithPicker {
  picker?: PickerNamespace;
}

declare global {
  interface Window {
    gapi?: GoogleApi;
  }
}

const GAPI_SCRIPT_SRC = 'https://apis.google.com/js/api.js';

@Injectable({
  providedIn: 'root',
})
export class DrivePickerService {
  private gapiPromise: Promise<void> | null = null;
  private pickerLoaded = false;

  async pickFolder(accessToken: string): Promise<DriveFolder | null> {
    await this.loadPicker();

    const picker = (window.google as GoogleGlobalWithPicker | undefined)?.picker;

    if (!picker) {
      throw new Error('Google Picker failed to load');
    }

    return new Promise<DriveFolder | null>((resolve, reject) => {
      try {
        const view = new picker.DocsView(picker.ViewId.FOLDERS).setSelectFolderEnabled(true).setMimeTypes('application/vnd.google-apps.folder');

        const instance = new picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(accessToken)
          .setDeveloperKey(GOOGLE_API_KEY)
          .setTitle('Choose a folder for spray-chart PDFs')
          .setCallback((data) => {
            if (data.action === picker.Action.PICKED && data.docs?.[0]) {
              const doc = data.docs[0];
              const folder: DriveFolder = { id: doc.id, name: doc.name };

              resolve(folder);
            } else if (data.action === picker.Action.CANCEL) {
              resolve(null);
            }
          })
          .build();

        instance.setVisible(true);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  private loadPicker(): Promise<void> {
    if (this.pickerLoaded) {
      return Promise.resolve();
    }

    return this.loadGapi().then(() => {
      return new Promise<void>((resolve) => {
        window.gapi?.load('picker', () => {
          this.pickerLoaded = true;
          resolve();
        });
      });
    });
  }

  private loadGapi(): Promise<void> {
    if (this.gapiPromise) {
      return this.gapiPromise;
    }

    this.gapiPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${GAPI_SCRIPT_SRC}"]`);

      if (existing && window.gapi) {
        resolve();

        return;
      }

      const script = document.createElement('script');

      script.src = GAPI_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load gapi'));
      document.head.appendChild(script);
    });

    return this.gapiPromise;
  }
}
