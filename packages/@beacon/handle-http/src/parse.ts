import {Headers} from '@remix-run/web-fetch';
import {APIGatewayProxyEvent} from 'aws-lambda';

import {operations} from '@beacon/gateway-schema';

import {TypedHandlerEvent, TypedHandlerRequestPathParameters} from './types';

export function safeJsonParse(obj: string) {
  try {
    return JSON.parse(obj);
  } catch (err) {
    return obj;
  }
}

export function safeUrlEncodedParse(body: string) {
  const params = new URLSearchParams(body);
  // Some clients (namely, the Dredd test runner), add "[]" to the end of field
  // names, which _is not_ expected by new URLSearchParams().
  params.forEach((value, key) => {
    if (key.endsWith('[]')) {
      params.set(key.slice(0, -2), value);
    }
  });
  return params;
}

export function parseHeaders({
  headers,
  multiValueHeaders,
}: APIGatewayProxyEvent): Headers {
  const h = new Headers();
  for (const [header, value] of Object.entries(headers)) {
    if (value) {
      h.set(header, value);
    }
  }

  for (const [key, value] of Object.entries(multiValueHeaders)) {
    // This might need a bit of experimentation, but the general idea is to
    // avoid adding headers a second time if they were already added by
    // `headers`.
    if (value && value.length > 1 && h.get(key) !== value[0]) {
      for (const item of value) {
        h.append(key, item);
      }
    }
  }

  return h;
}

export function parseURLSearchParams({
  multiValueQueryStringParameters,
  queryStringParameters,
}: APIGatewayProxyEvent): URLSearchParams {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(
    multiValueQueryStringParameters ?? {}
  )) {
    // The '' might not be right, but also probably won't affect
    // Check Run Reporter
    for (const v of value ?? []) {
      q.append(key, v || '');
    }
  }

  // As far as I can tell, we probably never need to look at single-value. Even
  // items with one value appear to show up as multi-value.
  for (const [key, value] of Object.entries(queryStringParameters ?? {})) {
    // Items that have multiple values would already have been added
    if (!q.has(key)) {
      // The '' might not be quite right, but I don't think it'll cause any
      // practical issues.
      q.set(key, value ?? '');
    }
  }

  return q;
}

export function parseBody({body}: APIGatewayProxyEvent, headers: Headers) {
  if (body === null) {
    return null;
  }

  if (
    headers
      .get('content-type')
      ?.includes('application/x-www-form-urlencoded') ??
    false
  ) {
    return safeUrlEncodedParse(body);
  }

  return safeJsonParse(body);
}

export function parseEvent<P extends keyof operations>(
  event: APIGatewayProxyEvent
): TypedHandlerEvent<P> {
  const headers = parseHeaders(event);
  return {
    ...event,
    body: parseBody(event, headers),
    headers,
    originalEvent: event,
    pathParameters:
      event.pathParameters as TypedHandlerRequestPathParameters<P>,
    queryStringParameters: parseURLSearchParams(event),
  };
}
