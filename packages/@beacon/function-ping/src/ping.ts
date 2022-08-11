export interface PingOutput {
  status: 'ok';
}

/**
 * Trivial interactor to prove wiring works
 */
export async function ping(): Promise<PingOutput> {
  return {
    status: 'ok',
  };
}
