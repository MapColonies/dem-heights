import path from 'path';
import config from "config";
import { logMethod } from "@map-colonies/telemetry";
import { trace } from "@opentelemetry/api";
import { DependencyContainer } from "tsyringe/dist/typings/types";
import jsLogger, { LoggerOptions } from "@map-colonies/js-logger";
import { Metrics } from "@map-colonies/telemetry";
import protobuf from 'protobufjs';
import { SERVICES, SERVICE_NAME } from "./common/constants";
import { tracing } from "./common/tracing";
import { heightsRouterFactory, HEIGHTS_ROUTER_SYMBOL } from "./heights/routes/heightsRouter";
import { InjectionObject, registerDependencies } from "./common/dependencyRegistration";
import mockCatalogRecords from "./heights/MOCKS/catalog-records";

const PROTO_FILE = './proto/posWithHeight.proto';
export interface RegisterOptions {
    override?: InjectionObject<unknown>[];
    useChild?: boolean;
}


export const CATALOG_RECORDS = Symbol("CATALOG_RECORDS");
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

    const posWithHeightProtoRoot = await protobuf.load(path.resolve(__dirname, PROTO_FILE));
    const posWithHeightProtoResponse = posWithHeightProtoRoot.lookupType('posWithHeightPackage.PosWithHeightResponse');
    const posWithHeightProtoRequest = posWithHeightProtoRoot.lookupType('posWithHeightPackage.PosRequest');

    const dependencies: InjectionObject<unknown>[] = [
        { token: SERVICES.CONFIG, provider: { useValue: config } },
        { token: SERVICES.LOGGER, provider: { useValue: logger } },
        { token: SERVICES.TRACER, provider: { useValue: tracer } },
        { token: SERVICES.METER, provider: { useValue: meter } },
        { token: CATALOG_RECORDS, provider: { useValue: mockCatalogRecords } },
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
