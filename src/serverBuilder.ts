import bodyParser from 'body-parser';
import compression from 'compression';
import express, { Router } from 'express';
import { middleware as OpenApiMiddleware } from 'express-openapi-validator';
import { Registry } from 'prom-client';
import { inject, injectable } from 'tsyringe';
import httpLogger from '@map-colonies/express-access-log-middleware';
import { Logger } from '@map-colonies/js-logger';
import { OpenapiViewerRouter, OpenapiRouterConfig } from '@map-colonies/openapi-express-viewer';
import { getTraceContexHeaderMiddleware, collectMetricsExpressMiddleware } from '@map-colonies/telemetry';
import { IConfig } from './common/interfaces';
import { CommonErrors } from './common/commonErrors';
import { SERVICES } from './common/constants';
import { HEIGHTS_ROUTER_SYMBOL } from './heights/routes/heightsRouter';

@injectable()
export class ServerBuilder {
  private readonly serverInstance: express.Application;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(HEIGHTS_ROUTER_SYMBOL) private readonly heightsRouter: Router,
    @inject(CommonErrors) private readonly commonErrors: CommonErrors,
    @inject(SERVICES.METRICS_REGISTRY) private readonly registry?: Registry
  ) {
    this.serverInstance = express();
  }

  public build(): express.Application {
    this.registerPreRoutesMiddleware();
    this.buildRoutes();
    this.registerPostRoutesMiddleware();

    return this.serverInstance;
  }

  private buildDocsRoutes(): void {
    const openapiRouter = new OpenapiViewerRouter(this.config.get<OpenapiRouterConfig>('openapiConfig'));
    openapiRouter.setup();
    this.serverInstance.use(this.config.get<string>('openapiConfig.basePath'), openapiRouter.getRouter());
  }

  private buildRoutes(): void {
    this.serverInstance.use('/', this.heightsRouter);
    this.buildDocsRoutes();
  }

  private registerPreRoutesMiddleware(): void {
    if (this.registry) {
      // this.serverInstance.use('/metrics', metricsMiddleware(this.registry));
      this.serverInstance.use(collectMetricsExpressMiddleware({ collectNodeMetrics: true, collectServiceVersion: true, registry: this.registry, labels: { meow: 'a' } }));
    }
    
    this.serverInstance.use(httpLogger({ logger: this.logger }));
    
    if (this.config.get<boolean>('server.response.compression.enabled')) {
      this.serverInstance.use(compression(this.config.get<compression.CompressionFilter>('server.response.compression.options')));
    }

    this.serverInstance.use(bodyParser.raw({ type: 'application/octet-stream', limit: '5mb' }));
    this.serverInstance.use(bodyParser.json(this.config.get<bodyParser.Options>('server.request.payload')));
    this.serverInstance.use(getTraceContexHeaderMiddleware());

    const ignorePathRegex = new RegExp(`^${this.config.get<string>('openapiConfig.basePath')}/.*`, 'i');
    const apiSpecPath = this.config.get<string>('openapiConfig.filePath');
    this.serverInstance.use(
      OpenApiMiddleware({ apiSpec: apiSpecPath, validateRequests: { allowUnknownQueryParameters: true }, ignorePaths: ignorePathRegex })
    );
  }

  private registerPostRoutesMiddleware(): void {
    /**
     * Was previously this.serverInstance.use(getErrorHandlerMiddleware());
     * Via service boilerplate.
     */
    this.serverInstance.use(this.commonErrors.getCommonErrorHandlerMiddleware());

    // TODO: Find a way to include the default MC error handler as well
    // this.serverInstance.use(getErrorHandlerMiddleware());
  }
}
