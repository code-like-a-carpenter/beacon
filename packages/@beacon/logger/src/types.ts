export type Meta = Record<string, any>;

export interface LeveledLogMethod {
  (message: string): void;
  (message: string, meta: Meta): void;
}

export interface Logger {
  error: LeveledLogMethod;
  warn: LeveledLogMethod;
  info: LeveledLogMethod;
  debug: LeveledLogMethod;
  trace: LeveledLogMethod;

  child(options: Record<string, any>): Logger;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';
