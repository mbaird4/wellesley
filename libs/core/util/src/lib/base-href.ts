let cached: string | null = null;

export function getBaseHref(): string {
  if (cached === null) {
    cached = document.querySelector('base')?.getAttribute('href') || '/';
  }

  return cached;
}
