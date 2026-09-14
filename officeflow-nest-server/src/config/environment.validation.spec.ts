import { describe, expect, it } from '@jest/globals';
import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  it('converts PORT to a number', () => {
    const config = validateEnvironment({
      DATABASE_URL: 'mysql://test:test@localhost:3306/test',
      NODE_ENV: 'test',
      PORT: '5001',
      JWT_ACCESS_SECRET: 'x'.repeat(32),
    });

    expect(config.PORT).toBe(5001);
  });

  it('rejects an invalid PORT', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'mysql://test:test@localhost:3306/test',
        NODE_ENV: 'test',
        PORT: 'abc',
        JWT_ACCESS_SECRET: 'x'.repeat(32),
      }),
    ).toThrow('PORT');
  });

  it('rejects an empty PORT', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'mysql://test:test@localhost:3306/test',
        NODE_ENV: 'test',
        PORT: '',
        JWT_ACCESS_SECRET: 'x'.repeat(32),
      }),
    ).toThrow('PORT');
  });

  it('rejects PORT = 0', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'mysql://test:test@localhost:3306/test',
        NODE_ENV: 'test',
        PORT: '0',
        JWT_ACCESS_SECRET: 'x'.repeat(32),
      }),
    ).toThrow('PORT');
  });

  it('rejects PORT greater than 65535', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'mysql://test:test@localhost:3306/test',
        NODE_ENV: 'test',
        PORT: '65536',
        JWT_ACCESS_SECRET: 'x'.repeat(32),
      }),
    ).toThrow('PORT');
  });

  it('rejects a decimal PORT', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'mysql://test:test@localhost:3306/test',
        NODE_ENV: 'test',
        PORT: '3000.5',
        JWT_ACCESS_SECRET: 'x'.repeat(32),
      }),
    ).toThrow('PORT');
  });

  it('rejects an invalid NODE_ENV', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'mysql://test:test@localhost:3306/test',
        NODE_ENV: 'invalid',
        PORT: '5001',
        JWT_ACCESS_SECRET: 'x'.repeat(32),
      }),
    ).toThrow('NODE_ENV');
  });

  it('uses defaults when configuration is absent', () => {
    expect(
      validateEnvironment({
        DATABASE_URL: 'mysql://test:test@localhost:3306/test',
        JWT_ACCESS_SECRET: 'x'.repeat(32),
      }),
    ).toMatchObject({
      NODE_ENV: 'development',
      PORT: 5001,
    });
  });

  it.each(['1', '65535'])('accepts boundary PORT %s', (port) => {
    expect(
      validateEnvironment({
        DATABASE_URL: 'mysql://test:test@localhost:3306/test',
        PORT: port,
        JWT_ACCESS_SECRET: 'x'.repeat(32),
      }).PORT,
    ).toBe(Number(port));
  });

  it('rejects missing JWT_ACCESS_SECRET', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'mysql://test:test@localhost:3306/test',
        NODE_ENV: 'test',
        PORT: '5001',
      }),
    ).toThrow('JWT_ACCESS_SECRET');
  });

  it('rejects JWT_ACCESS_SECRET shorter than 32 bytes', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'mysql://test:test@localhost:3306/test',
        NODE_ENV: 'test',
        PORT: '5001',
        JWT_ACCESS_SECRET: 'x'.repeat(31),
      }),
    ).toThrow('JWT_ACCESS_SECRET');
  });

  it('accepts JWT_ACCESS_SECRET with 32 bytes', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'mysql://test:test@localhost:3306/test',
        NODE_ENV: 'test',
        PORT: '5001',
        JWT_ACCESS_SECRET: 'x'.repeat(32),
      }),
    ).not.toThrow();
  });

  it('preserves the original JWT_ACCESS_SECRET', () => {
    const secret = 'my-super-secret-key-123456789012345';

    const config = validateEnvironment({
      DATABASE_URL: 'mysql://test:test@localhost:3306/test',
      NODE_ENV: 'test',
      PORT: '5001',
      JWT_ACCESS_SECRET: secret,
    });

    expect(config.JWT_ACCESS_SECRET).toBe(secret);
  });

  it('does not expose JWT_ACCESS_SECRET value in error message', () => {
    const secret = 'super-secret-value';

    const run = () =>
      validateEnvironment({
        DATABASE_URL: 'mysql://test:test@localhost:3306/test',
        NODE_ENV: 'test',
        PORT: '5001',
        JWT_ACCESS_SECRET: secret,
      });

    expect(run).toThrow(
      new Error('JWT_ACCESS_SECRET must contain at least 32 bytes'),
    );
  });
  it.each([undefined, null, 123, '', '   '])(
    'rejects missing or invalid DATABASE_URL: %s',
    (databaseUrl) => {
      expect(() =>
        validateEnvironment({
          JWT_ACCESS_SECRET: 'x'.repeat(32),
          DATABASE_URL: databaseUrl,
        }),
      ).toThrow('DATABASE_URL is required');
    },
  );

  it.each([
    ['invalid-secret-url', 'DATABASE_URL must be a valid MySQL URL'],
    [
      'https://host/db',
      'DATABASE_URL must use mysql:// and include a host and database name',
    ],
    [
      'mysql://host',
      'DATABASE_URL must use mysql:// and include a host and database name',
    ],
    [
      'mysql://host/',
      'DATABASE_URL must use mysql:// and include a host and database name',
    ],
    [
      'mysql:///db',
      'DATABASE_URL must use mysql:// and include a host and database name',
    ],
  ])(
    'rejects invalid database URL %s with a safe message',
    (databaseUrl, message) => {
      expect(() =>
        validateEnvironment({
          JWT_ACCESS_SECRET: 'x'.repeat(32),
          DATABASE_URL: databaseUrl,
        }),
      ).toThrow(new Error(message));
    },
  );

  it('preserves database credentials, TLS and explicit timeouts unchanged', () => {
    const databaseUrl =
      'mysql://user:p%40ss@host:3306/db?ssl=true&sslCa=%2Fcerts%2Fca.pem&connectTimeout=15000&acquireTimeout=30000';
    expect(
      validateEnvironment({
        JWT_ACCESS_SECRET: 'x'.repeat(32),
        DATABASE_URL: databaseUrl,
      }).DATABASE_URL,
    ).toBe(databaseUrl);
  });

  it('validates JWT length in UTF-8 bytes rather than character count', () => {
    const secret = 'é'.repeat(16);
    expect(
      validateEnvironment({
        JWT_ACCESS_SECRET: secret,
        DATABASE_URL: 'mysql://test:test@localhost:3306/test',
      }).JWT_ACCESS_SECRET,
    ).toBe(secret);
  });

  it('does not include database credentials in validation errors', () => {
    expect(() =>
      validateEnvironment({
        JWT_ACCESS_SECRET: 'x'.repeat(32),
        DATABASE_URL: 'https://user:private-password@host/db',
      }),
    ).toThrow(
      new Error(
        'DATABASE_URL must use mysql:// and include a host and database name',
      ),
    );
  });
});
