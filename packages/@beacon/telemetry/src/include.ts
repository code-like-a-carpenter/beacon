import {diag} from '@opentelemetry/api';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-grpc';
import {NodeTracerProvider} from '@opentelemetry/node';
import {BatchSpanProcessor} from '@opentelemetry/tracing';

// Copied from
// https://github.com/open-telemetry/opentelemetry-lambda/blob/e13a8ce7328e6739ed510d66bc5461427fee8eb2/nodejs/packages/layer/src/wrapper.ts#L42-L50
// These are global methods that the opentelemetry-lambda layer calls when it
// initializes. Most of these methods are commented out to reduce the types-only
// dependencies that it causes us to pull in (and therefore include in the deps
// layer).
declare global {
  // in case of downstream configuring span processors etc
  function configureTracerProvider(tracerProvider: NodeTracerProvider): void;

  // function configureTracer(defaultConfig: NodeTracerConfig): NodeTracerConfig;
  // function configureSdkRegistration(
  //   defaultSdkRegistration: SDKRegistrationConfig
  // ): SDKRegistrationConfig;
  // function configureLambdaInstrumentation(
  //   config: AwsLambdaInstrumentationConfig
  // ): AwsLambdaInstrumentationConfig;
}

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
