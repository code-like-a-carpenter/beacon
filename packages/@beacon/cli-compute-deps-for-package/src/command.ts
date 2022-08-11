import {Argv} from 'yargs';

import {computeDepsForPackage} from './compute-deps-for-package';

export const command = 'compute-deps-for-package <packageName>';

export const describe =
  'Finds all the direct and transitive local files a given package depends on.';

export function builder(yargs: Argv) {
  return yargs.positional('packageName', {
    demandOption: true,
    type: 'string',
  });
}

export async function handler(
  argv: Awaited<Argv<{packageName: string}>['argv']>
) {
  await computeDepsForPackage(argv.packageName);
}
