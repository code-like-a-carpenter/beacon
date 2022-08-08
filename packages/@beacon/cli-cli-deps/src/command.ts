import {Argv} from 'yargs';

import {check} from './cli-deps';

export const command = 'cli-deps';

export const describe =
  'Makes sure all cli plugins have been registered with the main cli package';

export function builder(yargs: Argv) {
  return yargs.options({
    d: {
      alias: 'dry-run',
      default: false,
      describe: 'Exits non-zero instead of making changes',
      type: 'boolean',
    },
  });
}

export async function handler(argv: Awaited<Argv<{dryRun: boolean}>['argv']>) {
  await check({dryRun: argv.dryRun});
}
