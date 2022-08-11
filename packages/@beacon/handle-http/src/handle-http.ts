import {operations} from '@beacon/gateway-schema';
import {logger} from '@beacon/logger';
import {withTelemetry} from '@beacon/telemetry';

import {formatFailure, formatSuccess} from './format';
import {parseEvent} from './parse';
import {DefinitelyAsyncAPIGatewayProxyHandler, TypedHandler} from './types';

export function handleHttp<P extends keyof operations>(
  cb: TypedHandler<P>
): DefinitelyAsyncAPIGatewayProxyHandler {
  return withTelemetry({}, async (event, context) => {
    const l = logger.child({
      awsRequestId: context.awsRequestId,
      method: event.httpMethod,
      path: event.path,
      requestId: event.requestContext.requestId,
      userAgent: event.headers['User-Agent'] ?? event.headers['user-agent'],
      xAmznTraceId: event.headers['X-Amzn-Trace-Id'],
    });

    const betterEvent = parseEvent<P>(event);

    try {
      const result = await cb(betterEvent, {
        lambdaContext: context,
        logger: l,
      });
      return formatSuccess(result);
    } catch (err) {
      return formatFailure(err, betterEvent, context, logger);
    }
  });
}
