import {EnvironmentError} from './environment-error';
import {TypeNarrowingError} from './type-narrowing-error';

export function env(key: string, fallback?: string): string {
  if (key in process.env) {
    const value = process.env[key];
    if (typeof value === 'undefined') {
      throw new TypeNarrowingError();
    }

    return value;
  }

  if (typeof fallback !== 'undefined') {
    return fallback;
  }

  throw new EnvironmentError(key);
}
