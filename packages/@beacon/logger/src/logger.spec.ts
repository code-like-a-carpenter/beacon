import FakeTimers from '@sinonjs/fake-timers';

import {ReferenceLogger} from './logger';
import {Logger} from './types';

describe('Logger', () => {
  let clock: FakeTimers.InstalledClock;
  let rootLogger: Logger;
  let spy: jest.SpyInstance;

  beforeEach(() => {
    spy = jest.spyOn(console, 'info').mockReturnValue(undefined);
    clock = FakeTimers.install();
  });

  afterEach(() => {
    clock.uninstall();
  });

  describe('CLI Logger', () => {
    beforeEach(() => {
      rootLogger = new ReferenceLogger({dev: true});
    });

    it('logs strings', () => {
      rootLogger.info('test');
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toMatchInlineSnapshot(
        `"{\\"level\\":\\"info\\",\\"message\\":\\"test\\"}"`
      );
    });

    it('logs strings and errors', () => {
      const e = new Error('something bad happened');
      e.stack = 'fake stack\nfake stack line 2';
      rootLogger.info('test', {err: e});
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toMatchInlineSnapshot(
        `"{\\"message\\":\\"test\\",\\"stack\\":\\"fake stack\\\\nfake stack line 2\\",\\"level\\":\\"info\\"}"`
      );
    });

    it('logs strings and objects', () => {
      rootLogger.info('test', {proof: true});
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toMatchInlineSnapshot(
        `"{\\"proof\\":true,\\"level\\":\\"info\\",\\"message\\":\\"test\\"}"`
      );
    });

    describe('with a child logger', () => {
      let childLogger: Logger;

      beforeEach(() => {
        childLogger = rootLogger.child({requestId: '12345'});
      });

      it('logs strings', () => {
        childLogger.info('test');
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0]).toMatchInlineSnapshot(
          `"{\\"requestId\\":\\"12345\\",\\"level\\":\\"info\\",\\"message\\":\\"test\\"}"`
        );
      });

      it('logs strings and errors', () => {
        const e = new Error('something bad happened');
        e.stack = 'fake stack\nfake stack line 2';
        childLogger.info('test', {err: e});
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0]).toMatchInlineSnapshot(
          `"{\\"message\\":\\"test\\",\\"stack\\":\\"fake stack\\\\nfake stack line 2\\",\\"requestId\\":\\"12345\\",\\"level\\":\\"info\\"}"`
        );
      });

      it('logs strings and objects', () => {
        childLogger.info('test', {proof: true});
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0]).toMatchInlineSnapshot(
          `"{\\"requestId\\":\\"12345\\",\\"proof\\":true,\\"level\\":\\"info\\",\\"message\\":\\"test\\"}"`
        );
      });

      it('logs initial and additional metadata', () => {
        childLogger.info('a');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0]).toMatchInlineSnapshot(`
          Array [
            "{\\"requestId\\":\\"12345\\",\\"level\\":\\"info\\",\\"message\\":\\"a\\"}",
          ]
        `);

        childLogger.info('a', {additional: true});
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[1]).toMatchInlineSnapshot(`
          Array [
            "{\\"requestId\\":\\"12345\\",\\"additional\\":true,\\"level\\":\\"info\\",\\"message\\":\\"a\\"}",
          ]
        `);

        const grandchildLogger = childLogger.child({moarMetadata: true});
        grandchildLogger.info('a', {additional: true});
        expect(spy).toHaveBeenCalledTimes(3);
        expect(spy.mock.calls[2]).toMatchInlineSnapshot(`
          Array [
            "{\\"requestId\\":\\"12345\\",\\"moarMetadata\\":true,\\"additional\\":true,\\"level\\":\\"info\\",\\"message\\":\\"a\\"}",
          ]
        `);
      });
    });
  });

  describe('Production Logger', () => {
    beforeEach(() => {
      rootLogger = new ReferenceLogger({dev: false});
    });

    it('does not log the authorization header', () => {
      const headers: Record<string, string> = {authorization: 'abc'};
      rootLogger.info('with request', {
        req: {
          connection: true,
          header(key: string): string {
            return headers[key];
          },
          headers,
        },
      });
      expect(spy).toHaveBeenCalled();
      expect(typeof spy.mock.calls[0][0]).toBe('string');
      expect(spy.mock.calls[0][0]).toMatch(/"authorization":\s*"<redacted>"/);
      expect(spy.mock.calls[0][0]).not.toMatch(/abc/);
    });

    it('redacts user PII', () => {
      rootLogger.info('with request', {
        user: {
          avatarUrl: 'https://example.com/avatar.png',
          displayName: 'Test User',
          email: 'test@example.com',
          externalId: '12345',
          login: 'test',
        },
      });
      expect(spy).toHaveBeenCalled();
      expect(JSON.parse(spy.mock.calls[0][0])).toMatchObject({
        level: 'info',
        message: 'with request',
        user: {
          avatarUrl: 'https://example.com/avatar.png',
          displayName: '<redacted>',
          email: '<redacted>',
          externalId: '12345',
          login: '<redacted>',
        },
      });
    });

    describe('formatting', () => {
      it('logs strings', () => {
        rootLogger.info('test');
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0]).toMatchInlineSnapshot(
          `"{\\"level\\":\\"info\\",\\"message\\":\\"test\\"}"`
        );
      });

      it('logs strings and objects', () => {
        rootLogger.info('test', {proof: true});
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0]).toMatchInlineSnapshot(
          `"{\\"proof\\":true,\\"level\\":\\"info\\",\\"message\\":\\"test\\"}"`
        );
      });

      it('logs strings and errors', () => {
        const e = new Error('something bad happened');
        e.stack = 'fake stack\nfake stack line 2';
        rootLogger.info('test', {err: e});
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0]).toMatchInlineSnapshot(
          `"{\\"message\\":\\"test\\",\\"stack\\":\\"fake stack\\\\nfake stack line 2\\",\\"level\\":\\"info\\"}"`
        );
      });

      it('converts keys to snake case', () => {
        rootLogger.info('test', {
          PascalCase: 2,
          camelCase: 1,
          'kebab-case': 3,
          snake_case: 4,
        });
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0]).toMatchInlineSnapshot(
          `"{\\"PascalCase\\":2,\\"camelCase\\":1,\\"kebab-case\\":3,\\"snake_case\\":4,\\"level\\":\\"info\\",\\"message\\":\\"test\\"}"`
        );
      });

      describe('with a child logger', () => {
        let childLogger: Logger;

        beforeEach(() => {
          childLogger = rootLogger.child({requestId: '12345'});
        });

        it('logs strings', () => {
          childLogger.info('test');
          expect(spy).toHaveBeenCalled();
          expect(spy.mock.calls[0][0]).toMatchInlineSnapshot(
            `"{\\"requestId\\":\\"12345\\",\\"level\\":\\"info\\",\\"message\\":\\"test\\"}"`
          );
        });

        it('logs strings and objects', () => {
          childLogger.info('test', {proof: true});
          expect(spy).toHaveBeenCalled();
          expect(spy.mock.calls[0][0]).toMatchInlineSnapshot(
            `"{\\"requestId\\":\\"12345\\",\\"proof\\":true,\\"level\\":\\"info\\",\\"message\\":\\"test\\"}"`
          );
        });

        it('logs original and additional metadata', () => {
          childLogger.info('a');
          expect(spy).toHaveBeenCalledTimes(1);
          expect(spy.mock.calls[0]).toMatchInlineSnapshot(`
            Array [
              "{\\"requestId\\":\\"12345\\",\\"level\\":\\"info\\",\\"message\\":\\"a\\"}",
            ]
          `);

          childLogger.info('a', {additional: true});
          expect(spy).toHaveBeenCalledTimes(2);
          expect(spy.mock.calls[1]).toMatchInlineSnapshot(`
            Array [
              "{\\"requestId\\":\\"12345\\",\\"additional\\":true,\\"level\\":\\"info\\",\\"message\\":\\"a\\"}",
            ]
          `);

          const grandchildLogger = childLogger.child({moarMetadata: true});
          grandchildLogger.info('a', {additional: true});
          expect(spy).toHaveBeenCalledTimes(3);
          expect(spy.mock.calls[2]).toMatchInlineSnapshot(`
            Array [
              "{\\"requestId\\":\\"12345\\",\\"moarMetadata\\":true,\\"additional\\":true,\\"level\\":\\"info\\",\\"message\\":\\"a\\"}",
            ]
          `);
        });
      });
    });
  });
});
