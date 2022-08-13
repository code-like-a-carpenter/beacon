import {diag} from '@opentelemetry/api';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-grpc';
import {NodeTracerConfig, NodeTracerProvider} from '@opentelemetry/node';
import {Resource} from '@opentelemetry/resources';
import {SemanticResourceAttributes} from '@opentelemetry/semantic-conventions';
import {
  BatchSpanProcessor,
  SDKRegistrationConfig,
} from '@opentelemetry/tracing';

// Copied from
// https://github.com/open-telemetry/opentelemetry-lambda/blob/e13a8ce7328e6739ed510d66bc5461427fee8eb2/nodejs/packages/layer/src/wrapper.ts#L42-L50
// These are global methods that the opentelemetry-lambda layer calls when it
// initializes. Most of these methods are commented out to reduce the types-only
// dependencies that it causes us to pull in (and therefore include in the deps
// layer).
declare global {
  // in case of downstream configuring span processors etc
  function configureTracerProvider(tracerProvider: NodeTracerProvider): void;

  function configureTracer(defaultConfig: NodeTracerConfig): NodeTracerConfig;
  function configureSdkRegistration(
    defaultSdkRegistration: SDKRegistrationConfig
  ): SDKRegistrationConfig;
  // function configureLambdaInstrumentation(
  //   config: AwsLambdaInstrumentationConfig
  // ): AwsLambdaInstrumentationConfig;
}

// remove the stack name and the random id from the function name to avoid
// creating lots of honeycomb dataset. If there are multiple stacks with the
// same resource, this will lead to collisions, but for the moment, I'm assuming
// that those stacks would be in different teams, not just different stacks.
const serviceName = process.env.AWS_LAMBDA_FUNCTION_NAME?.split('-')
  ?.slice(-2, -1)
  ?.join('');

// This produces the config passed to new NodeTracerProvider()
global.configureTracer = ({resource, ...config}) => {
  diag.debug('Telemetry: generating tracer config');

  if (serviceName) {
    const r = new Resource({
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        process.env.STAGE_NAME ?? 'development',
      [SemanticResourceAttributes.FAAS_INSTANCE]:
        process.env.AWS_LAMBDA_LOG_STREAM_NAME ?? '',
      [SemanticResourceAttributes.FAAS_MAX_MEMORY]:
        process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE ?? '',
      // [SERVICE_NAME] drives the honeycomb dataset name
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    });
    resource = resource ? resource.merge(r) : r;
  }

  return {
    ...config,
    resource,
  };
};

global.configureTracerProvider = (tracerProvider) => {
  diag.debug('Telemetry: configuring tracer provider');

  // The official open-telemetry layer seems to do this automatically, but
  // without adding this function and repeating the following, we don't seem to
  // send spans to the collector.
  // https://github.com/open-telemetry/opentelemetry-lambda/blob/e13a8ce7328e6739ed510d66bc5461427fee8eb2/nodejs/packages/layer/src/wrapper.ts#L100-L102
  tracerProvider.addSpanProcessor(
    new BatchSpanProcessor(new OTLPTraceExporter())
  );
};

global.configureSdkRegistration = (config) => {
  return {
    ...config,
    // Supress the opentelemetry layer's propagator(s) in favor of the one ones
    // registered by the aws otel layer
    propagator: null,
  };
};
