import path from 'path';
import config from "config";
import { logMethod } from "@map-colonies/telemetry";
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import jsLogger, { LoggerOptions } from "@map-colonies/js-logger";
import pino from 'pino';
import { Metrics } from "@map-colonies/telemetry";
import { trace } from "@opentelemetry/api";
import { DependencyContainer } from "tsyringe/dist/typings/types";
import protobuf from 'protobufjs';
import { SERVICES, SERVICE_NAME } from "./common/constants";
import { tracing } from "./common/tracing";
import { heightsRouterFactory, HEIGHTS_ROUTER_SYMBOL } from "./heights/routes/heightsRouter";
import { InjectionObject, registerDependencies } from "./common/dependencyRegistration";
import DEMTerrainCacheManager from './heights/models/DEMTerrainCacheManager';

const PROTO_FILE = './proto/posWithHeight.proto';
export interface RegisterOptions {
    override?: InjectionObject<unknown>[];
    useChild?: boolean;
}


export const CATALOG_RECORDS_MAP = Symbol("CATALOG_RECORDS_MAP");
export const POS_WITH_HEIGHT_PROTO_RESPONSE = Symbol("POS_WITH_HEIGHT_PROTO_RESPONSE");
export const POS_WITH_HEIGHT_PROTO_REQUEST = Symbol("POS_WITH_HEIGHT_PROTO_REQUEST");
export const DEM_TERRAIN_CACHE_MANAGER = Symbol("DEM_TERRAIN_CACHE_MANAGER");

export const registerExternalValues = async (
    options?: RegisterOptions
): Promise<DependencyContainer> => {
    const loggerConfig = config.get<LoggerOptions>("telemetry.logger");

    const catalogRecordsMap = Object.fromEntries(
        (JSON.parse(config.get<string>("demCatalogRecords")) as PycswDemCatalogRecord[]).map(
            (record) => [record.id as string, record]
        )
    );

    // @ts-expect-error the signature is wrong
    const logger = jsLogger({...loggerConfig, prettyPrint: false, hooks: { logMethod }, timestamp: pino.stdTimeFunctions.isoTime });

    const metrics = new Metrics(SERVICE_NAME);
    const meter = metrics.start();

    tracing.start();
    const tracer = trace.getTracer(SERVICE_NAME);

    const demTerrainCacheManager = new DEMTerrainCacheManager(config);
    await demTerrainCacheManager.initTerrainProviders();

    const posWithHeightProtoRoot = await protobuf.load(path.resolve(__dirname, PROTO_FILE));
    const posWithHeightProtoResponse = posWithHeightProtoRoot.lookupType('posWithHeightPackage.PosWithHeightResponse');
    const posWithHeightProtoRequest = posWithHeightProtoRoot.lookupType('posWithHeightPackage.PosRequest');

    const dependencies: InjectionObject<unknown>[] = [
        { token: SERVICES.CONFIG, provider: { useValue: config } },
        { token: SERVICES.LOGGER, provider: { useValue: logger } },
        { token: SERVICES.TRACER, provider: { useValue: tracer } },
        { token: SERVICES.METER, provider: { useValue: meter } },
        { token: CATALOG_RECORDS_MAP, provider: { useValue: catalogRecordsMap } },
        { token: POS_WITH_HEIGHT_PROTO_RESPONSE, provider: { useValue: posWithHeightProtoResponse } },
        { token: DEM_TERRAIN_CACHE_MANAGER, provider: { useValue: demTerrainCacheManager } },
        { token: POS_WITH_HEIGHT_PROTO_REQUEST, provider: { useValue: posWithHeightProtoRequest } },
        { token: HEIGHTS_ROUTER_SYMBOL, provider: { useFactory: heightsRouterFactory } },
        {
            token: "onSignal",
            provider: {
                useValue: {
                    useValue: async (): Promise<void> => {
                        await Promise.all([tracing.stop(), metrics.stop()]);
                    }
                }
            }
        }
    ];

    return registerDependencies(dependencies, options?.override, options?.useChild);
};
