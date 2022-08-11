import {Attributes, SpanKind, SpanOptions} from '@opentelemetry/api';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  DynamoDBStreamEvent,
} from 'aws-lambda';
import {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
} from 'aws-lambda/trigger/api-gateway-authorizer';
import {SQSEvent} from 'aws-lambda/trigger/sqs';

import {runWithNewSpan} from './trace';

interface DynamoDBStreamHandlerResult {
  batchItemFailures: {itemIdentifier: string}[];
}

export function withTelemetry<
  E extends
    | APIGatewayProxyEvent
    | APIGatewayTokenAuthorizerEvent
    | DynamoDBStreamEvent
    | SQSEvent,
  C extends Context,
  R extends
    | APIGatewayProxyResult
    | APIGatewayAuthorizerResult
    | DynamoDBStreamHandlerResult
    | void
>(
  nameOrAttrs: string | (SpanOptions & {name?: string}),
  fn: (event: E, context: C) => Promise<R>
): (event: E, context: C) => Promise<R> {
  let cold = true;
  let {
    name,
    kind = SpanKind.SERVER,
    // eslint-disable-next-line prefer-const
    attributes: baseAttributes = {},
  } = typeof nameOrAttrs === 'string' ? {name: nameOrAttrs} : nameOrAttrs;

  return async (event: E, context: C): Promise<R> => {
    const wasCold = cold;
    cold = false;

    let attributes: Attributes = {
      ...baseAttributes,
      'aws.lambda.invoked_arn': context.invokedFunctionArn,
      'cloud.account.id': context.invokedFunctionArn.split(':')[5],
      'faas.coldstart': wasCold,
      'faas.execution': context.awsRequestId,
      'faas.id': `${context.invokedFunctionArn
        .split(':')
        .slice(0, 7)
        .join(':')}:${context.functionVersion}`,
    };

    if ('authorizationToken' in event && 'type' in event) {
      name = 'authorize';
    } else if ('httpMethod' in event) {
      attributes = {
        ...attributes,
        'faas.trigger': 'http',
        'http.host': event.requestContext.domainName,
        'http.method': event.httpMethod,
        'http.route': event.resource,
        'http.schema': 'https',
        'http.target': event.path,
      };
      name = event.resource;
    } else if ('Records' in event && 'dynamodb' in event.Records[0]) {
      kind = SpanKind.CONSUMER;
      name = `aws:dynamodb process`;
    } else if ('Records' in event && 'messageAttributes' in event.Records[0]) {
      const eventSource =
        (event as SQSEvent).Records.reduce(
          (acc, record) => acc.add(record.eventSource),
          new Set<string>()
        ).size === 1
          ? event.Records[0].eventSource
          : 'multiple_sources';
      name = `${eventSource} process`;
    }

    name = name ?? context.functionName;

    return runWithNewSpan(
      {
        attributes,
        kind,
        name,
      },
      async (span) => {
        const result = await fn(event, context);
        if (result && 'statusCode' in result) {
          span.setAttribute('http.status_code', result.statusCode);
        }
        return result;
      }
    );
  };
}
