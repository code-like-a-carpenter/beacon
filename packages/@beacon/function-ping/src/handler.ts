import {handleHttp} from '@beacon/handle-http';
import {interact} from '@beacon/interact';

import {ping} from './ping';

export const handler = handleHttp<'ping'>(async (event, {logger}) => {
  return {body: await interact(ping, undefined, {logger}), statusCode: 200};
});
