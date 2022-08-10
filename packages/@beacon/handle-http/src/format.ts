import util from 'util';

import {APIGatewayProxyResult} from 'aws-lambda';
import {Context} from 'aws-lambda/handler';

import {operations} from '@beacon/gateway-schema';
import {Logger} from '@beacon/logger';

import {HttpException} from './errors';
import {
  TypedHandlerEvent,
  TypedHandlerResponseBody,
  TypedHandlerResult,
} from './types';

export function formatSuccess<
  P extends string & keyof operations,
  S extends number & keyof operations[P]['responses'],
  R extends TypedHandlerResponseBody<P, S>
>(result: TypedHandlerResult<P, S, R>): APIGatewayProxyResult {
  return {
    ...result,
    body: 'body' in result ? JSON.stringify(result.body, null, 2) : '',
  };
}

export function formatFailure<P extends keyof operations>(
  err: unknown,
  event: TypedHandlerEvent<P>,
  context: Context,
  logger: Logger
): APIGatewayProxyResult {
  if (err instanceof HttpException) {
    return {
      body: JSON.stringify(err.render(event, context)),
      statusCode: err.code,
    };
  }
  if (err instanceof Error) {
    logger.error('Could not handle request', {err});
    return {
      body: JSON.stringify({
        message: err.message,
        name: err.name,
        requestIds: {
          awsRequestId: context.awsRequestId,
          requestId: event.requestContext.requestId,
          xAmznTraceId: event.headers.get('X-Amzn-Trace-Id'),
        },
        stack: err.stack,
      }),
      statusCode: 500,
    };
  }

  logger.error('Could not handle request', {
    err: new Error(`Unknown error${util.inspect(err, {depth: 3})}`),
  });

  return {
    body: JSON.stringify(err),
    statusCode: 500,
  };
}
