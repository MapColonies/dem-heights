import { Application } from 'express';
import { registerExternalValues, RegisterOptions } from './containerConfig';
import { ServerBuilder } from './serverBuilder';

async function getApp(registerOptions?: RegisterOptions): Promise<void | Application> {
  return registerExternalValues(registerOptions)
    .then((container) => {
      const app = container.resolve(ServerBuilder).build();
      return app;
    })
    .catch((e) => {
      console.error(e as string);
    });
}

export { getApp };
