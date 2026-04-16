import { buildCanonicalNameMap } from './name-normalization';

describe('buildCanonicalNameMap', () => {
  it('expands a single-variant truncated spray name using the roster canonical', () => {
    // "K. Copperthi" is the only variant in spray data (from old Sidearm 12-char truncation).
    // Without the roster canonical as a candidate, the single-member group would be skipped
    // and the name would never be expanded to "K. Copperthite".
    const rosterJerseyMap = { 'copperthite, kathryn': 16 };
    const result = buildCanonicalNameMap(['K. Copperthi'], rosterJerseyMap);

    expect(result.get('K. Copperthi')).toBe('K. Copperthite');
  });

  it('still merges multiple truncated variants across years', () => {
    const rosterJerseyMap = { 'santiago, emily': 7 };
    const result = buildCanonicalNameMap(['E. Santi', 'E. Santiag', 'E. Santiago'], rosterJerseyMap);

    expect(result.get('E. Santi')).toBe('E. Santiago');
    expect(result.get('E. Santiag')).toBe('E. Santiago');
    expect(result.has('E. Santiago')).toBe(false);
  });

  it('leaves names unchanged when spray variant already matches the roster canonical', () => {
    const rosterJerseyMap = { 'dolan, riley': 12 };
    const result = buildCanonicalNameMap(['R. Dolan'], rosterJerseyMap);

    expect(result.has('R. Dolan')).toBe(false);
  });

  it('expands hyphenated last names', () => {
    const rosterJerseyMap = { 'blankenheim-brown, peyton': 17 };
    const result = buildCanonicalNameMap(['P. Blankenhe'], rosterJerseyMap);

    expect(result.get('P. Blankenhe')).toBe('P. Blankenheim-Brown');
  });
});
