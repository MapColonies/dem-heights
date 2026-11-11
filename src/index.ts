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
import { CATALOG_SYNC_MANAGER } from './containerConfig';
import { CatalogSyncManager } from './heights/models/catalogSyncManager';

const port: number = config.get<number>('server.port') || DEFAULT_SERVER_PORT;

getApp()
  .then((app) => {
    const stubHealthcheck = async (): Promise<void> => Promise.resolve();
    const logger = container.resolve<Logger>(SERVICES.LOGGER);
    const catalogSyncManager = container.resolve<CatalogSyncManager>(CATALOG_SYNC_MANAGER);
    const readinessCheck = async (): Promise<void> => {
      if (!catalogSyncManager.isReady()) {
        throw new Error('catalog not loaded');
      }
      return Promise.resolve();
    };
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const server = createTerminus(createServer(app as Express.Application), {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      healthChecks: { '/liveness': stubHealthcheck, '/readiness': readinessCheck, onSignal: container.resolve('onSignal') },
    });

    server.listen(port, () => {
      logger.info(`app started on port ${port}`);
    });
  })
  .catch((e) => {
    console.error(`There was a problem creating the app. Error: ${e as string}`);
  });
