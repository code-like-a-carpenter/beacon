import type {Context} from 'aws-lambda';

import {operations} from '@beacon/gateway-schema';

import {TypedHandlerEvent} from './types';

/**
 * Base class that handle() can use to render error messages
 */
export abstract class HttpException extends Error {
  public abstract readonly code: number;

  /**
   * Override name property so we get the real constructor name instead of just
   * "Error"
   */
  get name() {
    return this.constructor.name;
  }

  /** renderer */
  render<P extends string & keyof operations>(
    event: TypedHandlerEvent<P>,
    context: Context
  ) {
    return {
      message: this.message,
      name: this.name,
      requestIds: {
        /**
         * Lambda Request ID - This is the id for the request between API
         * Gateway and the lambda
         */
        awsRequestId: context.awsRequestId,
        /**
         * API Gateway Request ID - This is the one that'll show up in the
         * user's headers
         */
        requestId: event.requestContext.requestId,
        /**
         * Amazon Trace ID - I guess this is for giving to AWS Support? No one
         * really seems to know what it is
         */
        xAmznTraceId: event.headers.get('X-Amzn-Trace-Id'),
      },
      stack: this.stack,
    };
  }
}

/** Client Error */
export class ClientError extends HttpException {
  code = 400;
}

/** Bad Request */
export class BadRequest extends ClientError {
  code = 400;
}

/** Forbidden */
export class Forbidden extends ClientError {
  code = 403;
}

/** Method not allowed */
export class MethodNotAllowed extends ClientError {
  code = 405;
}

/** Not Found */
export class NotFound extends ClientError {
  code = 404;
}
