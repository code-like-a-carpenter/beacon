export class EnvironmentError extends TypeError {
  constructor(variableName: string) {
    super(`process.env.${variableName} must be defined`);
  }
}
