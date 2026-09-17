import { ConsoleLogger } from '@nestjs/common';

describe('Structured HTTP logging output', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['log', 'warn', 'error'] as const)(
    'serializes %s payload as a single JSON line with nested message fields',
    (level) => {
      const stream = level === 'error' ? process.stderr : process.stdout;
      const write = jest.spyOn(stream, 'write').mockReturnValue(true);
      const logger = new ConsoleLogger('HttpTest', { json: true });
      const payload = {
        event: 'http_request_completed',
        requestId: 'test-id',
        statusCode: 200,
        durationMs: 12,
      };

      logger[level](payload);

      expect(write).toHaveBeenCalledTimes(1);
      const output = String(write.mock.calls[0][0]);
      expect(output.endsWith('\n')).toBe(true);
      expect(output.trim().split('\n')).toHaveLength(1);
      const parsed: unknown = JSON.parse(output);
      expect(parsed).toMatchObject({
        level,
        context: 'HttpTest',
        message: payload,
      });
    },
  );
});
