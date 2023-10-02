/* eslint-disable import/first */
// this import must be called before the first import of tsyringe
import 'reflect-metadata';
// import './common/tracing';
import { createServer } from 'http';
import { container } from 'tsyringe';
import { createTerminus } from '@godaddy/terminus';
import { Logger } from '@map-colonies/js-logger';
import config from 'config';
import { getApp } from './app';
import { DEFAULT_SERVER_PORT, SERVICES } from './common/constants';

const port: number = config.get<number>('server.port') || DEFAULT_SERVER_PORT;

getApp()
  .then((app) => {
    const stubHealthcheck = async (): Promise<void> => Promise.resolve();
    const logger = container.resolve<Logger>(SERVICES.LOGGER);
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const server = createTerminus(createServer(app as Express.Application), {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      healthChecks: { '/liveness': stubHealthcheck, onSignal: container.resolve('onSignal') },
    });

    server.listen(port, () => {
      logger.info(`app started on port ${port}`);
    });
  })
  .catch((e) => {
    console.error(`There was a problem creating the app. Error: ${e as string}`);
  });
