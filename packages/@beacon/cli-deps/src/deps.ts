import {spawnSync} from 'child_process';
import * as fs from 'fs';
import path from 'path';

import depcheck from 'depcheck';
import glob from 'glob';

import {logger as rootLogger, Logger} from '@beacon/logger';

function removeExtraneous(
  logger: Logger,
  packagePath: string,
  deps: readonly string[]
) {
  logger = logger.child({dependencies: deps});
  logger.info('removing extra dependencies');
  spawnSync('npm', ['uninstall', '--workspace', packagePath, ...deps], {
    stdio: 'inherit',
  });
  logger.info('removed extra dependencies');
}

function addMissingNodeModules(
  logger: Logger,
  packagePath: string,
  missing: readonly string[]
) {
  const nodeDeps = missing.filter(
    // ignore the aws-lambda package because it's types-only and can't be
    // handled by this script without a lot more effort.
    (m) => !m.startsWith('@beacon') && m !== 'aws-lambda'
  );
  logger = logger.child({nodeDependencies: nodeDeps});

  if (nodeDeps.length) {
    logger.info('installing missing dependencies');
    spawnSync('npm', ['install', '--workspace', packagePath, ...nodeDeps], {
      stdio: 'inherit',
    });
    logger.info('installed missing dependencies');
    return true;
  }
  logger.info('no missing node dependencies');

  return false;
}

function sortObject<T extends object>(obj: T): T {
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      // @ts-expect-error
      sorted[key] = obj[key];
    });
  return sorted as T;
}

function addMissingLocalPackages(
  logger: Logger,
  packagePath: string,
  missing: readonly string[]
) {
  const localDeps = missing.filter((m) => m.startsWith('@beacon'));
  logger = logger.child({localDependencies: localDeps});

  if (localDeps.length) {
    logger.info('adding local dep names to package.json');
    const pkgJsonPath = path.join(process.cwd(), packagePath, 'package.json');

    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    pkg.dependencies = pkg.dependencies || {};
    for (const dep of localDeps) {
      pkg.dependencies[dep] = '*';
    }
    pkg.dependencies = sortObject(pkg.dependencies);
    fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);

    logger.info('added local dep names to package.json');
    return true;
  }
  logger.info('no missing local dependencies');

  return false;
}

export async function check({dryRun = false}: {dryRun?: boolean} = {}) {
  const packagePaths = glob
    .sync('packages/**/package.json', {
      ignore: ['packages/**/node_modules/**'],
    })
    .map((filename) => filename.split(path.sep).slice(0, -1).join(path.sep));
  const results = await Promise.all(
    packagePaths.map(async (packagePath) => ({
      packagePath,
      result: await depcheck(path.join(process.cwd(), packagePath), {}),
    }))
  );
  let hasChanges = false;
  for (const {packagePath, result} of results) {
    const logger = rootLogger.child({packagePath});
    if (result.dependencies.length > 0) {
      if (dryRun) {
        throw new Error(
          'At least one package has extraneous dependencies. Please run "npm run cli -- deps” to update."'
        );
      }
      hasChanges = true;
      removeExtraneous(logger, packagePath, result.dependencies);
    }

    const missing = Object.entries(result.missing)
      .filter(
        ([, usageSites]) =>
          !usageSites.some((usageSite) => usageSite.endsWith('.scss'))
      )
      .map(([packageName]) => packageName)
      .filter((packageName) => packageName !== 'aws-lambda');

    if (missing.length) {
      if (dryRun) {
        throw new Error(
          'At least one package has missing dependencies. Please run "npm run cli -- deps” to update."'
        );
      }
      hasChanges =
        addMissingLocalPackages(logger, packagePath, missing) || hasChanges;
      hasChanges =
        addMissingNodeModules(logger, packagePath, missing) || hasChanges;
    }
  }

  if (hasChanges) {
    spawnSync('npm', ['install'], {
      stdio: 'inherit',
    });
  }
}
