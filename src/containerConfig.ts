import path from 'path';
import config from 'config';
import pino from 'pino';
import client from 'prom-client';
import protobuf from 'protobufjs';
import { instanceCachingFactory, container, Lifecycle } from 'tsyringe';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import { trace } from '@opentelemetry/api';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { getOtelMixin } from '@map-colonies/telemetry';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { IConfig } from './common/interfaces';
import { tracing } from './common/tracing';
import DEMTerrainCacheManager from './heights/models/DEMTerrainCacheManager';
import { heightsRouterFactory, HEIGHTS_ROUTER_SYMBOL } from './heights/routes/heightsRouter';

import { Worker } from 'worker_threads';
import { CatalogRecords } from './heights/models/catalogRecords';
import { isSame } from './heights/utilities';

const PROTO_FILE = './proto/posWithHeight.proto';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const CATALOG_RECORDS_MAP = Symbol('CATALOG_RECORDS_MAP');
export const PRODUCT_METADATA_FIELDS = Symbol('PRODUCT_METADATA_FIELDS');
export const POS_WITH_HEIGHT_PROTO_RESPONSE = Symbol('POS_WITH_HEIGHT_PROTO_RESPONSE');
export const POS_WITH_HEIGHT_PROTO_REQUEST = Symbol('POS_WITH_HEIGHT_PROTO_REQUEST');
export const DEM_TERRAIN_CACHE_MANAGER = Symbol('DEM_TERRAIN_CACHE_MANAGER');

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
  // @ts-expect-error the signature is wrong
  const logger = jsLogger({ ...loggerConfig, mixin: getOtelMixin(), timestamp: pino.stdTimeFunctions.isoTime });
  
  const initCSWWorker = () =>{
    const worker = new Worker('./workerCatalogRecords.js');
  
    // Listen for updates from the worker
    worker.on('message',async (event: any) => {
      const data = event;
  
      switch (data.action) {
        case 'updateValue':
          const catalogRecordsServiceInstance = container.resolve<CatalogRecords>(CATALOG_RECORDS_MAP);
          const demTerrainCacheManager = container.resolve<DEMTerrainCacheManager>(DEM_TERRAIN_CACHE_MANAGER);
    
          if (!isSame(data.value, Object.values(catalogRecordsServiceInstance.getValue()))){
            catalogRecordsServiceInstance.setValue(Object.fromEntries(
              (data.value as PycswDemCatalogRecord[]).map((record) => [record.id as string, record])
            ));
            await demTerrainCacheManager.initTerrainProviders(data.value);

            logger.info({
              msg: `CatalogRecords UPDATED - ${data.value.length} records fetched`,
              location: '[registerExternalValues]',
            });
          }
          break;
        case 'error':
            logger.error({
              msg: `FETCH CatalogRecords ERROR`,
              ...data.value,
              location: '[registerExternalValues]',
            });
          break;
      }
    });
  
    worker.on('error',(event: any) => {
      logger.error({
        msg: `CatalogRecords ERROR`,
        ...event,
        location: '[registerExternalValues]',
      });
    });
  
    worker.on('exit',(event: any) => {
      logger.error({
        msg: `CatalogRecords EXIT`,
        ...event,
        location: '[registerExternalValues]',
      });
    });
  };

  initCSWWorker();

  const productMetadataFields = config.get<string>('productMetadataFields').split(',');

  tracing.start();
  const tracer = trace.getTracer(SERVICE_NAME);

  const posWithHeightProtoRoot = await protobuf.load(path.resolve(__dirname, PROTO_FILE));
  const posWithHeightProtoResponse = posWithHeightProtoRoot.lookupType('posWithHeightPackage.PosWithHeightResponse');
  const posWithHeightProtoRequest = posWithHeightProtoRoot.lookupType('posWithHeightPackage.PosRequest');

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: config } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    {
      token: SERVICES.METRICS_REGISTRY,
      provider: {
        useFactory: instanceCachingFactory((container) => {
          const config = container.resolve<IConfig>(SERVICES.CONFIG);
          if (config.get<boolean>('telemetry.metrics.enabled')) {
            client.register.setDefaultLabels({
              app: SERVICE_NAME,
            });
            return client.register;
          }
        }),
      },
    },
    { token: CATALOG_RECORDS_MAP, provider: { useClass: CatalogRecords }, options: { lifecycle: Lifecycle.Singleton } },
    { token: PRODUCT_METADATA_FIELDS, provider: { useValue: productMetadataFields } },
    { token: POS_WITH_HEIGHT_PROTO_RESPONSE, provider: { useValue: posWithHeightProtoResponse } },
    { token: DEM_TERRAIN_CACHE_MANAGER, provider: { useClass: DEMTerrainCacheManager }, options: { lifecycle: Lifecycle.Singleton } },
    { token: POS_WITH_HEIGHT_PROTO_REQUEST, provider: { useValue: posWithHeightProtoRequest } },
    { token: HEIGHTS_ROUTER_SYMBOL, provider: { useFactory: heightsRouterFactory } },
    {
      token: 'onSignal',
      provider: {
        useValue: {
          useValue: async (): Promise<void> => {
            await Promise.all([tracing.stop()]);
          },
        },
      },
    },
  ];

  return registerDependencies(dependencies, options?.override, options?.useChild);
};
