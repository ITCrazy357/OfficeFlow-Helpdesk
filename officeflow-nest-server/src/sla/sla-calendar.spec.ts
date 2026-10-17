import {
  addSlaMinutes,
  calculateTicketDeadlines,
  elapsedSlaMinutes,
} from './sla-calendar';
import {
  DEFAULT_SLA_POLICY,
  type SlaPolicyConfig,
  validateSlaPolicy,
} from './sla-policy';

const business: SlaPolicyConfig = {
  ...DEFAULT_SLA_POLICY,
  mode: 'BUSINESS',
  timezone: 'Asia/Ho_Chi_Minh',
  workingDays: [1, 2, 3, 4, 5],
  workingHours: [
    { start: '08:00', end: '12:00' },
    { start: '13:00', end: '17:00' },
  ],
};

describe('SLA working calendar', () => {
  it.each([
    ['2026-10-16T11:00:00+07:00', '2026-10-16T14:00:00+07:00', 120],
    ['2026-10-16T16:00:00+07:00', '2026-10-19T09:00:00+07:00', 120],
    ['2026-10-16T12:00:00+07:00', '2026-10-16T13:00:00+07:00', 0],
    ['2026-10-16T11:59:30+07:00', '2026-10-16T13:00:30+07:00', 1],
  ])('measures elapsed working minutes %s to %s', (start, end, expected) => {
    expect(elapsedSlaMinutes(new Date(start), new Date(end), business)).toBe(
      expected,
    );
  });

  it('measures holidays, legacy/calendar clocks, DST, midnight intervals and reversed spans', () => {
    const start = new Date('2026-10-16T16:00:00+07:00');
    const end = new Date('2026-10-19T09:00:00+07:00');
    expect(
      elapsedSlaMinutes(start, end, { ...business, holidays: ['2026-10-19'] }),
    ).toBe(60);
    expect(elapsedSlaMinutes(start, end, null)).toBe(3900);
    expect(
      elapsedSlaMinutes(start, end, { ...business, mode: 'CALENDAR' }),
    ).toBe(3900);
    expect(elapsedSlaMinutes(end, start, business)).toBe(0);
    expect(
      elapsedSlaMinutes(
        new Date('2026-03-08T05:00:00Z'),
        new Date('2026-03-09T04:00:00Z'),
        {
          ...business,
          timezone: 'America/New_York',
          workingDays: [7],
          workingHours: [{ start: '00:00', end: '24:00' }],
        },
      ),
    ).toBe(23 * 60);
  });
  it.each([
    ['URGENT', '2026-10-19T12:00:00+07:00'],
    ['HIGH', '2026-10-19T17:00:00+07:00'],
    ['MEDIUM', '2026-10-21T17:00:00+07:00'],
    ['LOW', '2026-10-27T17:00:00+07:00'],
  ] as const)(
    'uses the agreed default %s workday target',
    (priority, expected) => {
      expect(
        calculateTicketDeadlines(
          new Date('2026-10-19T08:00:00+07:00'),
          priority,
          DEFAULT_SLA_POLICY,
        ).dueAt,
      ).toEqual(new Date(expected));
    },
  );
  it.each([
    ['2026-10-16T11:00:00+07:00', 120, '2026-10-16T14:00:00+07:00'],
    ['2026-10-16T12:00:00+07:00', 30, '2026-10-16T13:30:00+07:00'],
    ['2026-10-16T08:00:00+07:00', 480, '2026-10-16T17:00:00+07:00'],
    ['2026-10-16T16:00:00+07:00', 240, '2026-10-19T11:00:00+07:00'],
    ['2026-10-17T10:00:00+07:00', 60, '2026-10-19T09:00:00+07:00'],
    ['2026-10-19T09:00:00+07:00', -120, '2026-10-16T16:00:00+07:00'],
    ['2026-10-19T08:00:00+07:00', -60, '2026-10-16T16:00:00+07:00'],
    ['2026-10-16T11:00:30+07:00', 60, '2026-10-16T13:00:30+07:00'],
  ])('calculates %s plus %i working minutes', (start, minutes, expected) => {
    expect(addSlaMinutes(new Date(start), minutes, business)).toEqual(
      new Date(expected),
    );
  });

  it('skips exact holiday dates without guessing annual holidays', () => {
    expect(
      addSlaMinutes(new Date('2026-10-16T16:00:00+07:00'), 120, {
        ...business,
        holidays: ['2026-10-19'],
      }),
    ).toEqual(new Date('2026-10-20T09:00:00+07:00'));
  });

  it('preserves local hours across daylight saving changes', () => {
    const policy = {
      ...business,
      timezone: 'America/New_York',
      workingHours: [{ start: '09:00', end: '17:00' }],
    };
    expect(
      addSlaMinutes(new Date('2026-03-06T21:00:00Z'), 120, policy),
    ).toEqual(new Date('2026-03-09T14:00:00Z'));
  });

  it('calculates response and resolution warnings using working time', () => {
    const policy = {
      ...business,
      warningMinutes: 60,
      targets: {
        ...business.targets,
        HIGH: { responseMinutes: 120, resolutionMinutes: 480 },
      },
    };
    expect(
      calculateTicketDeadlines(
        new Date('2026-10-16T16:00:00+07:00'),
        'HIGH',
        policy,
      ),
    ).toEqual({
      firstResponseDueAt: new Date('2026-10-19T09:00:00+07:00'),
      dueAt: new Date('2026-10-19T16:00:00+07:00'),
      responseWarningAt: new Date('2026-10-19T08:00:00+07:00'),
      resolutionWarningAt: new Date('2026-10-19T15:00:00+07:00'),
    });
  });

  it('supports 24/7 policies without consulting working hours', () => {
    expect(
      addSlaMinutes(new Date('2026-10-17T00:00:00Z'), 1440, {
        ...business,
        mode: 'CALENDAR',
      }),
    ).toEqual(new Date('2026-10-18T00:00:00Z'));
  });

  it.each([
    { ...business, timezone: 'invalid/zone' },
    { ...business, workingDays: [] },
    {
      ...business,
      workingHours: [
        { start: '08:00', end: '17:00' },
        { start: '13:00', end: '17:00' },
      ],
    },
    { ...business, holidays: ['2026-02-30'] },
    { ...business, workingHours: [{ start: '8am', end: '17:00' }] },
    {
      ...business,
      targets: {
        ...business.targets,
        HIGH: { responseMinutes: 481, resolutionMinutes: 480 },
      },
    },
  ])('rejects an invalid calendar/target', (policy) => {
    expect(() => validateSlaPolicy(policy)).toThrow();
  });
});
