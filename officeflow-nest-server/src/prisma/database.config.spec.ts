import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getDatabaseAdapterConfig,
  getDatabaseUrl,
  getMigrationDatabaseUrl,
} from './database.config';

const AIVEN_URL =
  'mysql://user:p%40ss%3Aword@mysql.example.aivencloud.com:16414/defaultdb?ssl-mode=REQUIRED';
const PROJECT_CA_PATH = resolve(__dirname, '../../certs/ca.pem');

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

  it('translates the Aiven SSL mode and enables TLS for Aiven endpoints', () => {
    expect(new URL(getDatabaseUrl(AIVEN_URL)).searchParams.get('ssl')).toBe(
      'true',
    );
    expect(
      new URL(
        getDatabaseUrl('mysql://user:password@db.aivencloud.com/app'),
      ).searchParams.get('ssl'),
    ).toBe('true');
    expect(
      new URL(
        getDatabaseUrl(
          'mysql://user:password@db.example/app?ssl-mode=REQUIRED',
        ),
      ).searchParams.get('ssl'),
    ).toBe('true');
  });

  it('uses the project CA with hostname and certificate verification', () => {
    const config = getDatabaseAdapterConfig(AIVEN_URL);
    expect(config).toMatchObject({
      host: 'mysql.example.aivencloud.com',
      port: 16414,
      user: 'user',
      password: 'p@ss:word',
      database: 'defaultdb',
      connectTimeout: 10000,
      acquireTimeout: 20000,
      ssl: {
        ca: readFileSync(PROJECT_CA_PATH),
        servername: 'mysql.example.aivencloud.com',
        rejectUnauthorized: true,
      },
    });
    expect(config).not.toHaveProperty('allowPublicKeyRetrieval');
  });

  it('preserves pool, boolean and JSON driver options when adding the CA', () => {
    const url = new URL(AIVEN_URL);
    url.searchParams.set('connectionLimit', '5');
    url.searchParams.set('acquireTimeout', '30000');
    url.searchParams.set('resetAfterUse', 'false');
    url.searchParams.set('multipleStatements', 'false');
    url.searchParams.set('dateStrings', 'true');
    url.searchParams.set('timezone', '+07:00');
    url.searchParams.set('connectAttributes', '{"application":"officeflow"}');
    url.searchParams.set(
      'sessionVariables',
      '{"sql_mode":"STRICT_ALL_TABLES"}',
    );
    expect(getDatabaseAdapterConfig(url.toString())).toMatchObject({
      connectionLimit: 5,
      acquireTimeout: 30000,
      resetAfterUse: false,
      multipleStatements: false,
      dateStrings: true,
      timezone: '+07:00',
      connectAttributes: { application: 'officeflow' },
      sessionVariables: { sql_mode: 'STRICT_ALL_TABLES' },
    });
  });

  it('keeps local and non-Aiven connections as driver URLs without forcing TLS', () => {
    const original = 'mysql://user:password@127.0.0.1:3306/app';
    const config = getDatabaseAdapterConfig(original);
    expect(typeof config).toBe('string');
    expect(new URL(config as string).searchParams.has('ssl')).toBe(false);
  });

  it.each(['ssl=false', 'ssl-mode=DISABLED'])(
    'rejects disabled TLS on Aiven: %s',
    (option) => {
      expect(() =>
        getDatabaseAdapterConfig(
          `mysql://user:secret@db.aivencloud.com/app?${option}`,
        ),
      ).toThrow('Database TLS is required');
      expect(() =>
        getDatabaseAdapterConfig(
          `mysql://user:secret@db.aivencloud.com/app?${option}`,
        ),
      ).not.toThrow('secret');
    },
  );

  it('supports an explicit CA for other hosts while rejecting conflicting ssl=false', () => {
    expect(
      getDatabaseAdapterConfig(
        'mysql://user:password@db.example/app',
        PROJECT_CA_PATH,
      ),
    ).toMatchObject({
      ssl: { ca: readFileSync(PROJECT_CA_PATH), rejectUnauthorized: true },
    });
    expect(() =>
      getDatabaseAdapterConfig(
        'mysql://user:password@db.example/app?ssl=false',
        PROJECT_CA_PATH,
      ),
    ).toThrow('Database TLS CA cannot be combined with ssl=false');
  });

  it('reports malformed JSON options without leaking their content', () => {
    expect(() =>
      getDatabaseAdapterConfig(AIVEN_URL + '&connectAttributes=private-secret'),
    ).toThrow('DATABASE_URL has invalid connectAttributes JSON');
    expect(() =>
      getDatabaseAdapterConfig(AIVEN_URL + '&connectAttributes=private-secret'),
    ).not.toThrow('private-secret');
  });

  it('configures the same trusted CA for the Prisma migration connector', () => {
    const url = new URL(getMigrationDatabaseUrl(AIVEN_URL));
    expect(url.searchParams.get('sslcert')).toBe(PROJECT_CA_PATH);
    expect(url.searchParams.get('sslaccept')).toBe('strict');
    expect(url.password).toBe('p%40ss%3Aword');
    expect(url.pathname).toBe('/defaultdb');
    expect(
      new URL(
        getMigrationDatabaseUrl('mysql://user:password@127.0.0.1/app'),
      ).searchParams.has('sslcert'),
    ).toBe(false);
  });
});
