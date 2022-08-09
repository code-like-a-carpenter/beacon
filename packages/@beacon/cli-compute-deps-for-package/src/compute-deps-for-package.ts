import assert from 'assert';
import fs from 'fs';
import path from 'path';

import glob from 'glob';

export async function computeDepsForPackage(packageName: string) {
  const pkgs = glob
    .sync('**/package.json', {
      // use cwd to avoid non-workpace packages...
      cwd: `${process.cwd()}/packages`,
      ignore: ['**/node_modules/**'],
    })
    // ...but add back the "workspace" prefix so that relative paths are correct
    .map((f) => path.join('packages', f));

  const directDependencies = new Map(
    await Promise.all(
      pkgs.map(async (name) => {
        const pkg = JSON.parse(await fs.promises.readFile(name, 'utf8'));
        assert.strictEqual(
          pkg.name,
          name.replace('packages/', '').replace('/package.json', ''),
          'package.json name does not match path name'
        );
        return [
          pkg.name,
          pkg.dependencies
            ? new Set(
                Object.keys(pkg.dependencies).filter((k) =>
                  k.startsWith('@beacon')
                )
              )
            : new Set(),
        ] as [string, Set<string>];
      })
    )
  );

  const transitiveDependencies = new Map<string, Set<string>>();
  for (const [pkgName, directDeps] of directDependencies) {
    const deps = new Set(directDeps);
    transitiveDependencies.set(pkgName, deps);
    let complete = false;
    while (complete === false) {
      complete = true;
      for (const dep of deps) {
        const nextDeps = directDependencies.get(dep);
        for (const nextDep of nextDeps ?? []) {
          if (!deps.has(nextDep)) {
            deps.add(nextDep);
            complete = false;
          }
        }
      }
    }
  }

  const pkgDeps = transitiveDependencies.get(packageName);
  assert(pkgDeps, `package ${packageName} not found`);
  const fileDeps = [...pkgDeps]
    .map((dep) => path.join('packages', dep))
    .flatMap((dep) =>
      glob
        .sync('**/*', {
          cwd: path.join(process.cwd(), dep),
          ignore: ['**/node_modules/**'],
          nodir: true,
        })
        .filter((f) => !f.includes('.spec.'))
        .map((found) => path.join(dep, found))
    );

  // eslint-disable-next-line no-console
  console.log(fileDeps.join(' '));
}
