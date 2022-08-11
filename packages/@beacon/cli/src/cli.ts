import yargs from 'yargs';

export async function main() {
  const pkg = await import('../package.json');
  let y = yargs(process.argv.slice(2));
  for (const [name] of Object.entries(pkg.dependencies)) {
    if (name.startsWith('@beacon/cli')) {
      y = yargs.command(await import(name));
    }
  }
  await y.help().demandCommand().argv;
}
