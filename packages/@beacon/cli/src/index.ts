import {main} from './cli';
export * from './cli';

if (require.main === module) {
  main().catch(console.error);
}
