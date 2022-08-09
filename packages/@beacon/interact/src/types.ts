import {Logger} from '@beacon/logger';

export interface Context {
  logger: Logger;
}

export interface Interactor<T, R> {
  (args: T, context: Context): Promise<R>;
}
