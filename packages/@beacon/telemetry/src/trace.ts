import {
  context as contextAPI,
  Context,
  Span,
  SpanContext,
  SpanKind,
  SpanOptions,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';

export const tracer = () =>
  trace.getTracer(
    process.env.AWS_LAMBDA_FUNCTION_NAME ?? 'unknown',
    process.env.AWS_LAMBDA_FUNCTION_VERSION
  );

export function getCurrentSpan() {
  return trace.getSpan(contextAPI.active());
}

/**
 * Runs `fn` with the specified span
 */
export function runWithSpan<T>(span: Span, fn: (s: Span) => T): T {
  const onCatch = (e: unknown) => {
    const error =
      e instanceof Error ? e : new Error(typeof e === 'string' ? e : undefined);
    span.setStatus({code: SpanStatusCode.ERROR, message: error.message});
    span.recordException(error);
    throw error;
  };
  const onFinally = () => span.end();
  let result;
  try {
    result = fn(span) as T | Promise<T>;
    return result instanceof Promise
      ? (result
          .then((v) => v)
          .catch(onCatch)
          .finally(onFinally) as unknown as T)
      : result;
  } catch (e: unknown) {
    if (!(result instanceof Promise)) return onCatch(e);
    throw e;
  } finally {
    if (!(result instanceof Promise)) onFinally();
  }
}

/**
 * Runs `fn` with a new span created from `name`
 */
export function runWithNewSpan<T>(
  nameOrAttrs: string | (SpanOptions & {name: string}),
  fn: (s: Span) => T
) {
  const {name, ...args} =
    typeof nameOrAttrs === 'string' ? {name: nameOrAttrs} : nameOrAttrs;

  return tracer().startActiveSpan(
    name,
    {kind: SpanKind.INTERNAL, ...args},
    (span) => runWithSpan(span, fn)
  );
}

/**
 * Runs `fn` with a new span created from `name` in the specified context
 */
export function runWithNewSpanInContext<T>(
  nameOrAttrs: string | (SpanOptions & {name: string}),
  context: Context,
  fn: (s: Span) => T
) {
  const {name, ...args} =
    typeof nameOrAttrs === 'string' ? {name: nameOrAttrs} : nameOrAttrs;
  const span = tracer().startSpan(
    name,
    {kind: SpanKind.INTERNAL, ...args},
    context
  );

  try {
    return runWithSpan(span, fn);
  } finally {
    span.end();
  }
}

function toCtx(l: Span | SpanContext) {
  return {
    context: 'spanContext' in l ? l.spanContext() : l,
  };
}

export const runWithNewLinkedSpan = (
  name: string | (SpanOptions & {name: string}),
  toLink: Span | Span[] | SpanContext | SpanContext[]
) => {
  const {name: n, ...args} = typeof name === 'string' ? {name} : name;
  const links = Array.isArray(toLink) ? toLink.map(toCtx) : [toCtx(toLink)];
  return tracer().startSpan(n, {
    ...args,
    links: [...(args.links ?? []), ...links],
  });
};
