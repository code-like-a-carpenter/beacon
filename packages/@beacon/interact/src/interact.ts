import {SpanKind} from '@opentelemetry/api';

import {runWithNewSpan} from '@beacon/telemetry';

import {Context, Interactor} from './types';

/**
 * Simple function to ensure all interactors conform to a certain interface.
 */
export async function interact<T, R>(
  interactor: Interactor<T, R>,
  args: T,
  context: Context
): Promise<R> {
  const logger = context.logger.child({interactor: interactor.name});

  return runWithNewSpan(
    {kind: SpanKind.INTERNAL, name: interactor.name ?? 'unknown interactor'},
    () => interactor(args, {...context, logger})
  );
}
