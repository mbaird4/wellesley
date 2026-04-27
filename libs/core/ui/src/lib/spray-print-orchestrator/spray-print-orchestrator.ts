import type { ElementRef } from '@angular/core';
import { ChangeDetectionStrategy, Component, computed, inject, input, isDevMode, signal, viewChild } from '@angular/core';
import type { SprayDataPoint, Team } from '@ws/core/models';

import { DriveAuthService } from '../google-drive/drive-auth.service';
import { DrivePickerService } from '../google-drive/drive-picker.service';
import type { UploadedFile } from '../google-drive/drive-upload.service';
import { DriveUploadService } from '../google-drive/drive-upload.service';
import { DriveUploadToast } from '../google-drive/drive-upload-toast';
import { type PrintOptions, PrintOptionsModal } from '../print-options-modal/print-options-modal';
import { SprayChartCoachPrintView } from '../spray-chart-coach-print-view/spray-chart-coach-print-view';
import type { PrintPlayerSummary } from '../spray-chart-print-view/spray-chart-print-view';
import { SprayChartPrintView } from '../spray-chart-print-view/spray-chart-print-view';
import { SprayPacketQuickRef } from '../spray-packet-quick-ref/spray-packet-quick-ref';
import { SprayPdfService } from '../spray-pdf/spray-pdf.service';

export type ViewMode = 'split' | 'combined' | 'contact' | 'scouting';

@Component({
  selector: 'ws-spray-print-orchestrator',
  standalone: true,
  imports: [
    DriveUploadToast,
    PrintOptionsModal,
    SprayChartCoachPrintView,
    SprayChartPrintView,
    SprayPacketQuickRef,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './spray-print-orchestrator.html',
})
export class SprayPrintOrchestrator {
  private readonly pdfService = inject(SprayPdfService);
  private readonly driveAuth = inject(DriveAuthService);
  private readonly drivePicker = inject(DrivePickerService);
  private readonly driveUpload = inject(DriveUploadService);

  readonly teamData = input<Team | null>(null);
  readonly allPlayerSummaries = input.required<PrintPlayerSummary[]>();
  readonly lineupOrder = input<Record<string, number>>({});
  readonly printTitle = input('');
  readonly printSubtitle = input('');
  readonly selectedYears = input<string[]>([]);
  readonly cacheKey = input<string>('');
  readonly viewMode = input<ViewMode>('combined');
  readonly dataByYear = input.required<Map<number, SprayDataPoint[]>>();

  readonly showPrintModal = signal(false);
  readonly printDugout = signal(true);
  readonly printCoach = signal(true);
  readonly printQuickRef = signal(false);
  readonly printPreview = signal(false);
  readonly pdfCapturing = signal(false);
  readonly driveUploading = signal(false);
  readonly uploadResults = signal<UploadedFile[]>([]);
  readonly uploadFolderName = signal<string>('');
  readonly isDev = isDevMode();
  readonly printSortedPlayers = signal<PrintPlayerSummary[]>([]);

  readonly dugoutRef = viewChild<ElementRef<HTMLElement>>('dugoutRef');
  readonly coachRef = viewChild<ElementRef<HTMLElement>>('coachRef');
  readonly quickRefRef = viewChild<ElementRef<HTMLElement>>('quickRefRef');

  readonly printPlayers = computed(() => {
    const sorted = this.printSortedPlayers();

    return sorted.length > 0 ? sorted : this.allPlayerSummaries();
  });

  readonly captureWrapperClass = computed(() => {
    if (this.printPreview()) {
      return 'relative print-preview';
    }

    if (this.pdfCapturing() || this.driveUploading()) {
      return 'pdf-capture-host';
    }

    return '';
  });

  readonly busyMessage = computed(() => {
    if (this.driveUploading()) {
      return 'Uploading to Drive…';
    }

    if (this.pdfCapturing()) {
      return 'Generating PDFs…';
    }

    return '';
  });

  onPrint(): void {
    this.showPrintModal.set(true);
  }

  onPrintConfirm(opts: PrintOptions): void {
    this.printDugout.set(opts.dugout);
    this.printCoach.set(opts.coach);
    this.printQuickRef.set(opts.quickRef ?? false);

    if (opts.coachPlayers?.length) {
      this.printSortedPlayers.set(opts.coachPlayers);
    }

    this.showPrintModal.set(false);

    if (opts.mode === 'drive') {
      setTimeout(() => this.executeDriveUpload(), 0);

      return;
    }

    setTimeout(() => this.executeDownload(), 0);
  }

  dismissUploadToast(): void {
    this.uploadResults.set([]);
    this.uploadFolderName.set('');
  }

  onPrintCancel(): void {
    this.showPrintModal.set(false);
  }

  private collectTargets(): { ref: ElementRef<HTMLElement>; name: string }[] {
    const slug = this.filenameSlug();
    const yearsTag = this.selectedYears().join('-') || 'all';
    const out: { ref: ElementRef<HTMLElement>; name: string }[] = [];
    const dugout = this.dugoutRef();
    const coach = this.coachRef();
    const quick = this.quickRefRef();

    if (this.printDugout() && dugout) {
      out.push({ ref: dugout, name: `${slug}-dugout-${yearsTag}.pdf` });
    }

    if (this.printCoach() && coach) {
      out.push({ ref: coach, name: `${slug}-coach-${yearsTag}.pdf` });
    }

    if (this.printQuickRef() && quick) {
      out.push({ ref: quick, name: `${slug}-quickref-${yearsTag}.pdf` });
    }

    return out;
  }

  private async executeDownload(): Promise<void> {
    this.pdfCapturing.set(true);
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      const targets = this.collectTargets();

      await targets.reduce<Promise<void>>(async (prev, target) => {
        await prev;
        const blob = await this.pdfService.generatePdf(target.ref.nativeElement);

        this.pdfService.triggerDownload(blob, target.name);
      }, Promise.resolve());
    } catch (err) {
      console.error('PDF generation failed', err);
      alert('PDF download failed. See console for details.');
    } finally {
      this.pdfCapturing.set(false);
    }
  }

  private async executeDriveUpload(): Promise<void> {
    try {
      const token = await this.driveAuth.getAccessToken();
      const folder = await this.drivePicker.pickFolder(token);

      if (!folder) {
        return;
      }

      this.driveUploading.set(true);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const folderId = folder.id;
      const targets = this.collectTargets();
      const uploaded = await targets.reduce<Promise<UploadedFile[]>>(async (prevP, target) => {
        const acc = await prevP;
        const blob = await this.pdfService.generatePdf(target.ref.nativeElement);
        const result = await this.driveUpload.uploadPdf(blob, target.name, folderId, token);

        return [...acc, result];
      }, Promise.resolve([]));

      this.uploadFolderName.set(folder.name);
      this.uploadResults.set(uploaded);
    } catch (err) {
      console.error('Drive upload failed', err);
      alert(err instanceof Error ? err.message : 'Drive upload failed');
    } finally {
      this.driveUploading.set(false);
    }
  }

  private filenameSlug(): string {
    const team = this.teamData();
    const raw = team?.slug ?? this.printTitle() ?? 'spray-charts';

    return (
      raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'spray-charts'
    );
  }
}
