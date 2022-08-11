import {Headers} from '@remix-run/web-fetch';
import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from 'aws-lambda';

// Ideally all of these types would be generics that accept `operations` as the
// first type parameter, but I couldn't come up with a reasonable typedef for it
// so we have to import the real typedef directly.
import {operations} from '@beacon/gateway-schema';
import {Logger} from '@beacon/logger';

/**
 * This is pretty much just a duplicate of APIGatewayProxyHandler, except it
 * removes the callback form which we'll never use and makes typechecking a
 * whole lot harder.
 */
export type DefinitelyAsyncAPIGatewayProxyHandler = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

interface TypedEventHandleContext {
  lambdaContext: Context;
  logger: Logger;
}

interface ContentTypeJson {
  content: {'application/json': unknown};
}

interface ContentTypeUrlEncoded {
  content: {'application/x-www-form-urlencoded': unknown};
}

export type TypedHandlerRequestPathParameters<P extends keyof operations> =
  operations[P] extends {parameters: {path: unknown}}
    ? operations[P]['parameters']['path']
    : null;

export type TypedHandlerRequestBody<P extends keyof operations> =
  operations[P] extends {
    requestBody: ContentTypeJson;
  }
    ? operations[P]['requestBody']['content']['application/json']
    : operations[P] extends {requestBody: ContentTypeUrlEncoded}
    ? URLSearchParams
    : null;

export type TypedHandlerResponseBody<
  P extends keyof operations,
  S extends keyof operations[P]['responses'] = keyof operations[P]['responses']
> = operations[P]['responses'][S] extends ContentTypeJson
  ? operations[P]['responses'][S]['content']['application/json']
  : never;

export type TypedHandlerEvent<P extends keyof operations> = Omit<
  APIGatewayProxyEvent,
  | 'body'
  | 'pathParameters'
  | 'headers'
  | 'multiValueHeaders'
  | 'multiValueQueryStringParameters'
  | 'queryStringParameters'
> & {
  body: TypedHandlerRequestBody<P>;
  headers: Headers;
  pathParameters: TypedHandlerRequestPathParameters<P>;
  queryStringParameters: URLSearchParams;
  /**
   * The original, unparsed event body. Might be needed for some incoming
   * webhook situations where the entire body needs to be used to generate
   * validate a signature
   **/
  originalEvent: APIGatewayProxyEvent;
};

export type TypedHandlerResult<
  P extends string & keyof operations,
  S extends number & keyof operations[P]['responses'],
  R extends TypedHandlerResponseBody<P, S>
> = Omit<APIGatewayProxyResult, 'body' | 'statusCode'> & R extends never
  ? {statusCode: S}
  : {body: R; statusCode: S};

export type TypedHandler<
  P extends string & keyof operations,
  S extends number & keyof operations[P]['responses'] = number &
    keyof operations[P]['responses'],
  R extends TypedHandlerResponseBody<P, S> = TypedHandlerResponseBody<P, S>
> = (
  event: TypedHandlerEvent<P>,
  context: TypedEventHandleContext
) => Promise<TypedHandlerResult<P, S, R>>;
