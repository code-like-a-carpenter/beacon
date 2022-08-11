import {Context, Interactor} from './types';

/**
 * Simple function to ensure all interactors conform to a certain interface.
 */
export async function interact<T, R>(
  interactor: Interactor<T, R>,
  args: T,
  context: Context
): Promise<R> {
  return interactor(args, context);
}
