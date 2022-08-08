import stringify from 'fast-safe-stringify';

import {env} from '@beacon/env';

import {Logger, LogLevel, Meta} from './types';

const PARENT = Symbol('parent');
const PARENT_KEY = Symbol('parent_key');

function isErrorLike(val: unknown) {
  return (
    Boolean(val) &&
    typeof val === 'object' &&
    (val instanceof Error ||
      (Object.prototype.hasOwnProperty.call(val, 'message') &&
        Object.prototype.hasOwnProperty.call(val, 'stack')))
  );
}

/** Reference implementation of Logger */
export class ReferenceLogger implements Logger {
  private readonly transport: Console;

  private readonly meta: Meta;

  private readonly dev: boolean;

  constructor({
    meta = {},
    transport = console,
    // Assume that the only time this logger is used outside of cloudwatch is
    // inside Jest tests.
    dev = env('NODE_ENV', 'development') === 'test',
  }: {
    meta?: Meta;
    transport?: Console;
    dev?: boolean;
  } = {}) {
    this.dev = dev;
    this.meta = meta;
    this.transport = transport;
  }

  child(meta: Meta = {}): Logger {
    return new ReferenceLogger({
      dev: this.dev,
      meta: {...this.meta, ...meta},
      transport: this.transport,
    });
  }

  error(message: string): void;
  error(message: string, meta: Meta): void;
  error(message: string, meta?: Meta): void {
    meta ? this.log('error', message, meta) : this.log('error', message);
  }

  warn(message: string): void;
  warn(message: string, meta: Meta): void;
  warn(message: string, meta?: Meta): void {
    meta ? this.log('warn', message, meta) : this.log('warn', message);
  }

  info(message: string): void;
  info(message: string, meta: Meta): void;
  info(message: string, meta?: Meta): void {
    meta ? this.log('info', message, meta) : this.log('info', message);
  }

  debug(message: string): void;
  debug(message: string, meta: Meta): void;
  debug(message: string, meta?: Meta): void {
    if (process.env.ENABLE_DEBUG_LOGS) {
      meta ? this.log('debug', message, meta) : this.log('debug', message);
    }
  }

  trace(message: string): void;
  trace(message: string, meta: Meta): void;
  trace(message: string, meta?: Meta): void {
    meta ? this.log('trace', message, meta) : this.log('trace', message);
  }

  private log(level: LogLevel, message: string): void;
  private log(level: LogLevel, message: string, meta: Meta): void;
  private log(level: LogLevel, message: string, meta?: Meta): void {
    const input = {
      ...this.meta,
      ...meta,
      level,
      message,
    };

    let output;
    try {
      output = JSON.stringify(
        input,
        replacer,
        process.env.NODE_ENV === 'development' ? 2 : 0
      );
    } catch (err) {
      this.warn('JSON.stringify failed, falling back to fast-safe-stringify', {
        err,
      });

      output = stringify(
        input,
        replacer,
        process.env.NODE_ENV === 'development' ? 0 : 2
      );
    }

    this.transport[level](output);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, complexity
function replacer(this: any, key: string, value: any): any {
  if (
    key === '' &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'err' in value &&
    isErrorLike(value.err)
  ) {
    const {err, ...rest} = value;
    value = {
      ...err,
      message: err.message,
      stack: err.stack,
      ...rest,
    };
  }

  // eslint-disable-next-line no-invalid-this
  if (this[PARENT_KEY] === 'headers') {
    if (key === 'authorization') {
      return '<redacted>';
    }
  }

  // eslint-disable-next-line no-invalid-this
  if (this[PARENT_KEY] === 'user') {
    if (key === 'login' || key === 'displayName' || key === 'email') {
      return '<redacted>';
    }
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    // eslint-disable-next-line no-invalid-this
    value[PARENT] = this[PARENT];
    value[PARENT_KEY] = key;
  }

  return value;
}
