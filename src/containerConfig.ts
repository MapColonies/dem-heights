import config from "config";
import { logMethod } from "@map-colonies/telemetry";
import { trace } from "@opentelemetry/api";
import { DependencyContainer } from "tsyringe/dist/typings/types";
import jsLogger, { LoggerOptions } from "@map-colonies/js-logger";
import { Metrics } from "@map-colonies/telemetry";
import { CesiumTerrainProvider, Resource } from "cesium";
import { SERVICES, SERVICE_NAME } from "./common/constants";
import { tracing } from "./common/tracing";
import { heightsRouterFactory, HEIGHTS_ROUTER_SYMBOL } from "./heights/routes/heightsRouter";
import { InjectionObject, registerDependencies } from "./common/dependencyRegistration";
import mockCatalogRecords from "./heights/MOCKS/catalog-records";
import { TerrainProviders } from "./heights/interfaces";
import catalogRecords from "./heights/MOCKS/catalog-records";

const QMESH_PROTOCOL = 'TERRAIN_QMESH';
export interface RegisterOptions {
    override?: InjectionObject<unknown>[];
    useChild?: boolean;
}



export const CATALOG_RECORDS = Symbol("CATALOG_RECORDS");
export const TERRAIN_PROVIDERS = Symbol("TERRAIN_PROVIDERS");

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

    for (const record of catalogRecords) {
      const recordProviderLink = record.links.find(link => link.protocol === QMESH_PROTOCOL);

      if(recordProviderLink) {
        const provider = await CesiumTerrainProvider.fromUrl(new Resource({
            url: recordProviderLink.url,
            queryParameters: {
                token: config.get<string>('terrainProvidersToken')
            }
        }));

        terrainProviders[record.id] = provider;
      }
    }

    const dependencies: InjectionObject<unknown>[] = [
        { token: SERVICES.CONFIG, provider: { useValue: config } },
        { token: SERVICES.LOGGER, provider: { useValue: logger } },
        { token: SERVICES.TRACER, provider: { useValue: tracer } },
        { token: SERVICES.METER, provider: { useValue: meter } },
        { token: CATALOG_RECORDS, provider: { useValue: mockCatalogRecords } },
        { token: TERRAIN_PROVIDERS, provider: { useValue: terrainProviders } },
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
