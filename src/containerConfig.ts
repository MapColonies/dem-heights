import path from 'path';
import config from "config";
import { logMethod } from "@map-colonies/telemetry";
import { trace } from "@opentelemetry/api";
import { DependencyContainer } from "tsyringe/dist/typings/types";
import jsLogger, { LoggerOptions } from "@map-colonies/js-logger";
import { Metrics } from "@map-colonies/telemetry";
import protobuf from 'protobufjs';
import { CesiumTerrainProvider, IonResource, Resource } from "cesium";
import { SERVICES, SERVICE_NAME } from "./common/constants";
import { tracing } from "./common/tracing";
import { heightsRouterFactory, HEIGHTS_ROUTER_SYMBOL } from "./heights/routes/heightsRouter";
import { InjectionObject, registerDependencies } from "./common/dependencyRegistration";
import mockCatalogRecords from "./heights/MOCKS/catalog-records";
import { TerrainProviders } from "./heights/interfaces";

const PROTO_FILE = './proto/posWithHeight.proto';
const QMESH_PROTOCOL = 'TERRAIN_QMESH';
export interface RegisterOptions {
    override?: InjectionObject<unknown>[];
    useChild?: boolean;
}



export const CATALOG_RECORDS = Symbol("CATALOG_RECORDS");
export const TERRAIN_PROVIDERS = Symbol("TERRAIN_PROVIDERS");
export const POS_WITH_HEIGHT_PROTO_RESPONSE = Symbol("POS_WITH_HEIGHT_PROTO_RESPONSE");
export const POS_WITH_HEIGHT_PROTO_REQUEST = Symbol("POS_WITH_HEIGHT_PROTO_REQUEST");

export const registerExternalValues = async (
    options?: RegisterOptions
): Promise<DependencyContainer> => {
    const loggerConfig = config.get<LoggerOptions>("telemetry.logger");

    // @ts-expect-error the signature is wrong
    const logger = jsLogger({...loggerConfig, prettyPrint: loggerConfig.prettyPrint, hooks: { logMethod }});

    const metrics = new Metrics(SERVICE_NAME);
    const meter = metrics.start();

    tracing.start();
    const tracer = trace.getTracer(SERVICE_NAME);

    const terrainProviders: TerrainProviders = {};

    for (const record of mockCatalogRecords) {
      const recordProviderLink = record.links.find(link => link.protocol === QMESH_PROTOCOL);

      if(recordProviderLink) {
        // Real logic
        // const provider = await CesiumTerrainProvider.fromUrl(new Resource({
        //     url: recordProviderLink.url,
        //     queryParameters: {
        //         token: config.get<string>('terrainProvidersToken')
        //     }
        // }));

        // Cesium provider
        const provider: CesiumTerrainProvider = new CesiumTerrainProvider({
            url: IonResource.fromAssetId(1, {
                accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5NDAxMTYyNC1lMzUwLTRkYzEtOWRkNC1kMjVkNjYwNWJjNTUiLCJpZCI6MTM1MDQ4LCJpYXQiOjE2ODIxNjIyMTl9.PvD5p7C_HyAp-JfTs1yKab4c3n_vYstn0AeD0qx_REg'
            })
        });        

        terrainProviders[record.id] = provider;
      }
    }

    console.log(__dirname);
    const posWithHeightProtoRoot = await protobuf.load(path.resolve(__dirname, PROTO_FILE));
    const posWithHeightProtoResponse = posWithHeightProtoRoot.lookupType('posWithHeightPackage.PosWithHeightResponse');
    const posWithHeightProtoRequest = posWithHeightProtoRoot.lookupType('posWithHeightPackage.PosRequest');

    const dependencies: InjectionObject<unknown>[] = [
        { token: SERVICES.CONFIG, provider: { useValue: config } },
        { token: SERVICES.LOGGER, provider: { useValue: logger } },
        { token: SERVICES.TRACER, provider: { useValue: tracer } },
        { token: SERVICES.METER, provider: { useValue: meter } },
        { token: CATALOG_RECORDS, provider: { useValue: mockCatalogRecords } },
        { token: TERRAIN_PROVIDERS, provider: { useValue: terrainProviders } },
        { token: POS_WITH_HEIGHT_PROTO_RESPONSE, provider: { useValue: posWithHeightProtoResponse } },
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
