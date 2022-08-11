import {Argv} from 'yargs';

import {check} from './deps';

export const command = 'deps';

export const describe =
  'Iterates over all packages and make sure all their dependencies are specified in their package.json';

export async function builder(yargs: Argv) {
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
