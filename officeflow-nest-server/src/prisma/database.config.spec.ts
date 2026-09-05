import { getDatabaseUrl } from './database.config';

describe('database connection configuration', () => {
  it('uses longer connection and pool timeouts by default', () => {
    const url = new URL(getDatabaseUrl('mysql://user:password@db:3306/app'));

    expect(url.searchParams.get('connectTimeout')).toBe('10000');
    expect(url.searchParams.get('acquireTimeout')).toBe('20000');
  });

  it('preserves credentials, database, TLS and other URL options', () => {
    const original = new URL(
      'mysql://user:p%40ss%3Aword@db.example.com:16414/app?ssl=true&sslCa=%2Fetc%2Fdb%2Fca.pem&connectionLimit=5',
    );
    const url = new URL(getDatabaseUrl(original.toString()));

    expect(url.protocol).toBe(original.protocol);
    expect(url.username).toBe(original.username);
    expect(url.password).toBe(original.password);
    expect(url.host).toBe(original.host);
    expect(url.pathname).toBe(original.pathname);
    for (const [key, value] of original.searchParams) {
      expect(url.searchParams.get(key)).toBe(value);
    }
  });

  it('keeps explicitly configured driver timeouts', () => {
    const url = new URL(
      getDatabaseUrl(
        'mariadb://user:password@db/app?connectTimeout=15000&acquireTimeout=30000',
      ),
    );

    expect(url.searchParams.get('connectTimeout')).toBe('15000');
    expect(url.searchParams.get('acquireTimeout')).toBe('30000');
  });

  it('adds only the missing timeout', () => {
    const url = new URL(
      getDatabaseUrl('mysql://user:password@db/app?connectTimeout=5000'),
    );

    expect(url.searchParams.get('connectTimeout')).toBe('5000');
    expect(url.searchParams.get('acquireTimeout')).toBe('20000');
  });

  it('reports invalid configuration without leaking the URL', () => {
    expect(() => getDatabaseUrl('')).toThrow('DATABASE_URL is not set');
    expect(() => getDatabaseUrl('secret-password')).toThrow(
      'DATABASE_URL must be a valid connection URL',
    );
  });
});
