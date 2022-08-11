import {trace, SpanKind, SpanStatusCode} from '@opentelemetry/api';

import {Context, Interactor} from './types';

/**
 * Simple function to ensure all interactors conform to a certain interface.
 */
export async function interact<T, R>(
  interactor: Interactor<T, R>,
  args: T,
  context: Context
): Promise<R> {
  return trace
    .getTracer('default')
    .startActiveSpan(
      interactor.name ?? 'unknown interactor',
      {kind: SpanKind.INTERNAL},
      async (span) => {
        try {
          return await interactor(args, context);
        } catch (err) {
          const error =
            err instanceof Error
              ? err
              : new Error(typeof err === 'string' ? err : undefined);
          span.setStatus({code: SpanStatusCode.ERROR, message: error.message});
          span.recordException(error);
          throw err;
        } finally {
          span.end();
        }
      }
    );
}
