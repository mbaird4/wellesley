/** Returns an array of integers from 1 to `length`. */
export function range(length: number): number[] {
  return Array.from({ length }, (_, i) => i + 1);
}
