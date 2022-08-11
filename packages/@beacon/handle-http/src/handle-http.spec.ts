import {
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  Context,
} from 'aws-lambda';

import {BadRequest} from './errors';
import {handleHttp} from './handle-http';

function makeRequest({
  handler = (() => undefined) as APIGatewayProxyHandler,
  path = '/',
  httpMethod = 'GET',
  body = null,
  headers = {},
}) {
  const event: APIGatewayProxyEvent = {
    body,
    headers,
    httpMethod,
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: {},
    path,
    pathParameters: {},
    queryStringParameters: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'id',
      authorizer: {
        claims: null,
        scopes: null,
      },

      domainName: 'id.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'id',
      extendedRequestId: 'request-id',
      httpMethod,
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: {
          clientCertPem: 'CERT_CONTENT',
          issuerDN: 'Example issuer',
          serialNumber: 'a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1',
          subjectDN: 'www.example.com',
          validity: {
            notAfter: 'Aug  5 09:36:04 2021 GMT',
            notBefore: 'May 28 12:30:02 2019 GMT',
          },
        },

        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: 'IP',
        user: null,
        userAgent: 'user-agent',
        userArn: null,
      },

      path,
      protocol: 'HTTP/1.1',
      requestId: 'id=',
      requestTime: '04/Mar/2020:19:15:17 +0000',
      requestTimeEpoch: 1583349317135,
      resourceId: '',
      resourcePath: path,
      stage: '$default',
    },

    resource: path,
    stageVariables: null,
  } as const;
  const context: Context = {
    awsRequestId: 'request-id',
    callbackWaitsForEmptyEventLoop: false,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    done: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    fail: () => {},
    functionName: handler.name,
    functionVersion: '$LATEST',
    getRemainingTimeInMillis: () => 0,
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:id',
    logGroupName: '/aws/lambda/id',
    logStreamName: '2020/03/04/[$LATEST]8f9f8f8f-8f8f-8f8f-8f8f-8f8f8f8f8f8f',
    memoryLimitInMB: '128',
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    succeed: () => {},
  } as const;

  return [event, context] as const;
}

describe('handleHttp()', () => {
  it(`renders BadRequest errors`, async () => {
    const handler = () => {
      throw new BadRequest('test');
    };

    const result = await handleHttp(handler)(...makeRequest({handler}));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchInlineSnapshot(
      {
        message: 'test',
        name: 'BadRequest',
        stack: expect.any(String),
      },
      `
      Object {
        "message": "test",
        "name": "BadRequest",
        "requestIds": Object {
          "awsRequestId": "request-id",
          "requestId": "id=",
          "xAmznTraceId": null,
        },
        "stack": Any<String>,
      }
    `
    );
  });

  it(`renders Error objects as Internal Server Errors`, async () => {
    const handler = () => {
      throw new Error('test');
    };

    const result = await handleHttp(handler)(...makeRequest({handler}));
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toMatchInlineSnapshot(
      {
        message: 'test',
        name: 'Error',
        stack: expect.any(String),
      },
      `
      Object {
        "message": "test",
        "name": "Error",
        "requestIds": Object {
          "awsRequestId": "request-id",
          "requestId": "id=",
          "xAmznTraceId": null,
        },
        "stack": Any<String>,
      }
    `
    );
  });
});
