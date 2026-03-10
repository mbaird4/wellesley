import { trackPitcherPerformance } from './pitcher-tracking';

describe('trackPitcherPerformance', () => {
  it('tracks a single pitcher across a full inning', () => {
    const plays = trackPitcherPerformance(
      [
        {
          inning: '1st',
          plays: ['A. Batter grounded out to ss.', 'B. Batter singled to lf.', 'C. Batter struck out swinging.', 'D. Batter flied out to cf.'],
        },
      ],
      ['J. Pitcher']
    );

    expect(plays).toHaveLength(4);
    plays.forEach((p) => {
      expect(p.activePitcher).toBe('J. Pitcher');
      expect(p.inning).toBe('1st');
      expect(p.isPlateAppearance).toBe(true);
    });

    expect(plays[0].batterResult).toBe('out');
    expect(plays[1].batterResult).toBe('single');
    expect(plays[1].hitsOnPlay).toBe(1);
    expect(plays[2].batterResult).toBe('out');
    expect(plays[3].batterResult).toBe('out');
  });

  it('handles a mid-inning pitcher change', () => {
    const plays = trackPitcherPerformance(
      [
        {
          inning: '3rd',
          plays: ['A. Batter singled to cf.', 'B. Smith to p.', 'C. Batter grounded out to 2b.', 'D. Batter struck out looking.'],
        },
      ],
      ['J. Starter', 'B. Smith']
    );

    // The defensive change (play index 1) itself is filtered out (not a PA)
    expect(plays).toHaveLength(3);
    expect(plays[0].activePitcher).toBe('J. Starter');
    expect(plays[0].batterResult).toBe('single');
    expect(plays[1].activePitcher).toBe('B. Smith');
    expect(plays[1].batterResult).toBe('out');
    expect(plays[2].activePitcher).toBe('B. Smith');
  });

  it('handles multiple pitcher changes across innings', () => {
    const plays = trackPitcherPerformance(
      [
        {
          inning: '1st',
          plays: ['A. Batter walked.', 'B. Batter struck out swinging.', 'C. Batter grounded into double play.'],
        },
        {
          inning: '2nd',
          plays: ['D. Batter flied out to rf.', 'E. Relief to p.', 'F. Batter singled to ss.', 'G. Batter popped up to 1b.'],
        },
        {
          inning: '3rd',
          plays: ['H. Closer to p for E. Relief.', 'I. Batter homered to lf.', 'J. Batter grounded out to 3b.'],
        },
      ],
      ['A. Starter', 'E. Relief', 'H. Closer']
    );

    // Filter only PAs
    const pas = plays.filter((p) => p.isPlateAppearance);

    // 1st inning: 3 PAs by A. Starter
    expect(pas[0].activePitcher).toBe('A. Starter');
    expect(pas[1].activePitcher).toBe('A. Starter');
    expect(pas[2].activePitcher).toBe('A. Starter');

    // 2nd inning: 1 PA by A. Starter, then E. Relief takes over
    expect(pas[3].activePitcher).toBe('A. Starter');
    expect(pas[4].activePitcher).toBe('E. Relief');
    expect(pas[5].activePitcher).toBe('E. Relief');

    // 3rd inning: H. Closer
    expect(pas[6].activePitcher).toBe('H. Closer');
    expect(pas[6].batterResult).toBe('homer');
    expect(pas[6].runsScored).toBe(1);
    expect(pas[7].activePitcher).toBe('H. Closer');
  });

  it('counts runs scored on hits with runners', () => {
    const plays = trackPitcherPerformance(
      [
        {
          inning: '1st',
          plays: ['A. Batter doubled to lf; B. Runner scored; C. Runner scored.'],
        },
      ],
      ['J. Pitcher']
    );

    expect(plays).toHaveLength(1);
    expect(plays[0].runsScored).toBe(2);
    expect(plays[0].hitsOnPlay).toBe(1);
    expect(plays[0].batterResult).toBe('double');
  });

  it('handles homer with runners on — counts all runs', () => {
    const plays = trackPitcherPerformance(
      [
        {
          inning: '5th',
          plays: ['A. Batter homered to cf; B. Runner scored; C. Runner scored.'],
        },
      ],
      ['J. Pitcher']
    );

    expect(plays).toHaveLength(1);
    // Homer: batter scores (1) + 2 runners score = 3
    expect(plays[0].runsScored).toBe(3);
    expect(plays[0].hitsOnPlay).toBe(1);
  });

  it('tracks wild pitch as non-PA event', () => {
    const plays = trackPitcherPerformance(
      [
        {
          inning: '2nd',
          plays: ['Wild pitch; A. Runner advanced to second.'],
        },
      ],
      ['J. Pitcher']
    );

    expect(plays).toHaveLength(1);
    expect(plays[0].isPlateAppearance).toBe(false);
    expect(plays[0].activePitcher).toBe('J. Pitcher');
  });

  it('returns empty array for empty innings', () => {
    const plays = trackPitcherPerformance([], ['J. Pitcher']);

    expect(plays).toHaveLength(0);
  });

  it('uses "Unknown" when no pitchers provided', () => {
    const plays = trackPitcherPerformance(
      [
        {
          inning: '1st',
          plays: ['A. Batter struck out swinging.'],
        },
      ],
      []
    );

    expect(plays).toHaveLength(1);
    expect(plays[0].activePitcher).toBe('Unknown');
  });

  it('handles walk with scoring runner', () => {
    const plays = trackPitcherPerformance(
      [
        {
          inning: '4th',
          plays: ['A. Batter walked; B. Runner scored.'],
        },
      ],
      ['J. Pitcher']
    );

    expect(plays).toHaveLength(1);
    expect(plays[0].batterResult).toBe('walk');
    expect(plays[0].runsScored).toBe(1);
    expect(plays[0].hitsOnPlay).toBe(0);
  });
});
