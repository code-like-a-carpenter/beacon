import * as fs from 'fs';
import path from 'path';

import glob from 'glob';

import {check as depcheck} from '@beacon/cli-deps';
import {logger} from '@beacon/logger';

export async function check({dryRun = false}: {dryRun?: boolean} = {}) {
  const packageNames = glob
    .sync('packages/**/package.json', {
      ignore: ['packages/**/node_modules/**'],
    })
    // 1 in the first position removes the first item in the array ("packages")
    // -1 in the second position removes the last item in the array ("package.json")
    .map((filename) => filename.split(path.sep).slice(1, -1).join(path.sep))
    .filter(
      (packagePath) =>
        packagePath.startsWith('@beacon/cli') && packagePath !== '@beacon/cli'
    );

  logger.info('Located CLI packages', {packageNames});

  const pkgJsonPath = path.join(
    process.cwd(),
    'packages',
    '@beacon',
    'cli',
    'package.json'
  );

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  const hasMissing = packageNames.some((packageName) => {
    return !pkgJson.dependencies[packageName];
  });

  if (hasMissing) {
    if (dryRun) {
      throw new Error(
        'Some cli plugins are not referenced by the CLI package. Please run "npm run cli -- cli-deps" to update.'
      );
    }
    logger.info(
      'CLI package is missing plugins. Updating manifest and running depcheck.'
    );
    const manifest = `${packageNames
      .sort()
      .map((packageName) => `import '${packageName}';`)
      .join('\n')}\n`;

    const manifestPath = path.join(
      process.cwd(),
      'packages',
      '@beacon',
      'cli',
      'src',
      'manifest.ts'
    );
    fs.writeFileSync(manifestPath, manifest);
    logger.info(
      'Wrote manifest.ts file. Running depcheck to verify dependencies are installed.'
    );
    await depcheck();
  }

  logger.info('CLI package is up to date.');
}
