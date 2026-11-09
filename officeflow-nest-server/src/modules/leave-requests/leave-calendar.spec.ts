import {
  leaveDate,
  leaveMonth,
  leaveToday,
  leaveWorkingDays,
} from './leave-calendar';
import { DEFAULT_SLA_POLICY } from '../sla/sla-policy';

describe('Leave calendar', () => {
  it('excludes weekends and exact holidays, including a cross-year request', () => {
    const days = leaveWorkingDays('2026-12-31', '2027-01-04', 'FULL_DAY', {
      ...DEFAULT_SLA_POLICY,
      holidays: ['2027-01-01'],
    });
    expect(days).toEqual([
      { date: new Date('2026-12-31T00:00:00Z'), halfDays: 2 },
      { date: new Date('2027-01-04T00:00:00Z'), halfDays: 2 },
    ]);
  });
  it.each(['MORNING', 'AFTERNOON'] as const)(
    'counts %s as exactly one half-day',
    (period) => {
      expect(
        leaveWorkingDays(
          '2026-10-19',
          '2026-10-19',
          period,
          DEFAULT_SLA_POLICY,
        )[0].halfDays,
      ).toBe(1);
      expect(() =>
        leaveWorkingDays(
          '2026-10-19',
          '2026-10-20',
          period,
          DEFAULT_SLA_POLICY,
        ),
      ).toThrow('same date');
    },
  );
  it.each(['2026-02-30', '2026-13-01', '2026-1-01', '0001-01-01', 'invalid'])(
    'rejects impossible or unsupported date %s',
    (date) => {
      expect(() => leaveDate(date)).toThrow();
    },
  );
  it('accepts leap days, rejects empty working calendars and bounds iteration', () => {
    expect(leaveDate('2028-02-29').toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
    expect(() =>
      leaveWorkingDays('2026-10-19', '2026-10-19', 'FULL_DAY', {
        ...DEFAULT_SLA_POLICY,
        workingDays: [],
      }),
    ).toThrow('not configured');
    expect(() =>
      leaveWorkingDays(
        '2026-10-19',
        '2027-10-20',
        'FULL_DAY',
        DEFAULT_SLA_POLICY,
      ),
    ).toThrow('366');
    expect(() =>
      leaveWorkingDays(
        '2026-10-18',
        '2026-10-17',
        'FULL_DAY',
        DEFAULT_SLA_POLICY,
      ),
    ).toThrow('366');
    expect(() =>
      leaveWorkingDays(
        '2026-10-17',
        '2026-10-18',
        'FULL_DAY',
        DEFAULT_SLA_POLICY,
      ),
    ).toThrow('no working days');
  });
  it('uses the configured timezone at midnight and validates month ranges', () => {
    expect(
      leaveToday('Asia/Ho_Chi_Minh', new Date('2026-10-18T17:00:00Z')),
    ).toBe('2026-10-19');
    expect(leaveMonth('2028-02').end.toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
    expect(() => leaveMonth('2026-13')).toThrow();
    expect(() => leaveMonth('2026-1')).toThrow();
  });
});
