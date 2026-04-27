import { Injectable } from '@angular/core';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';

const LETTER_WIDTH_IN = 8.5;
const LETTER_HEIGHT_IN = 11;
const PAGE_MARGIN_IN = 0.3;
const CAPTURE_SCALE = 2;
const BREAK_EPSILON = 0.5;

interface AtomicBlock {
  top: number;
  bottom: number;
}

interface Slice {
  startY: number;
  endY: number;
}

@Injectable({
  providedIn: 'root',
})
export class SprayPdfService {
  async generatePdf(element: HTMLElement): Promise<Blob> {
    const canvas = await html2canvas(element, {
      scale: CAPTURE_SCALE,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    const pdf = new jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait' });
    const usableWidth = LETTER_WIDTH_IN - PAGE_MARGIN_IN * 2;
    const usableHeight = LETTER_HEIGHT_IN - PAGE_MARGIN_IN * 2;
    const pxPerInch = canvas.width / usableWidth;
    const pageHeightPx = Math.floor(usableHeight * pxPerInch);
    const { atomicBlocks, forcedBreaks } = this.collectBreakHints(element);
    const slices = this.buildSlices(0, canvas.height, pageHeightPx, atomicBlocks, forcedBreaks, []);

    slices.forEach((slice, pageIndex) => {
      const sliceHeight = slice.endY - slice.startY;
      const pageCanvas = document.createElement('canvas');

      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;

      const ctx = pageCanvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, slice.startY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
      }

      const imgData = pageCanvas.toDataURL('image/jpeg', 0.92);
      const sliceHeightIn = sliceHeight / pxPerInch;

      if (pageIndex > 0) {
        pdf.addPage();
      }

      pdf.addImage(imgData, 'JPEG', PAGE_MARGIN_IN, PAGE_MARGIN_IN, usableWidth, sliceHeightIn);
    });

    const blob = pdf.output('blob');

    return blob;
  }

  triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private collectBreakHints(element: HTMLElement): { atomicBlocks: AtomicBlock[]; forcedBreaks: number[] } {
    const parentTop = element.getBoundingClientRect().top;
    const toCanvasY = (clientY: number): number => (clientY - parentTop) * CAPTURE_SCALE;

    const atomicBlocks = Array.from(element.querySelectorAll<HTMLElement>('.break-inside-avoid')).map((el) => {
      const rect = el.getBoundingClientRect();

      return { top: toCanvasY(rect.top), bottom: toCanvasY(rect.bottom) };
    });

    const forcedBreaks = Array.from(element.querySelectorAll<HTMLElement>('.break-before-page'))
      .map((el) => toCanvasY(el.getBoundingClientRect().top))
      .filter((y) => y > BREAK_EPSILON);

    return { atomicBlocks, forcedBreaks };
  }

  private buildSlices(currentY: number, totalHeight: number, pageHeightPx: number, blocks: AtomicBlock[], forcedBreaks: number[], acc: Slice[]): Slice[] {
    if (currentY >= totalHeight - BREAK_EPSILON) {
      return acc;
    }

    const maxEndY = Math.min(currentY + pageHeightPx, totalHeight);
    const nextForced = forcedBreaks.filter((y) => y > currentY + BREAK_EPSILON && y <= maxEndY + BREAK_EPSILON).sort((a, b) => a - b)[0];
    const candidate = nextForced ?? maxEndY;
    const safeEnd = this.pullBackPastBlocks(candidate, blocks, currentY);
    const endY = Math.min(Math.max(safeEnd, currentY + 1), totalHeight);

    return this.buildSlices(endY, totalHeight, pageHeightPx, blocks, forcedBreaks, [...acc, { startY: currentY, endY }]);
  }

  private pullBackPastBlocks(candidate: number, blocks: AtomicBlock[], currentY: number): number {
    return [...blocks]
      .sort((a, b) => b.top - a.top)
      .reduce((end, block) => {
        const straddles = block.top < end - BREAK_EPSILON && block.bottom > end + BREAK_EPSILON;
        const canPullBack = block.top > currentY + BREAK_EPSILON;

        return straddles && canPullBack ? block.top : end;
      }, candidate);
  }
}
