import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { HeightsController } from '../controllers/heightsController';

const heightsRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(HeightsController);

  router.get('/', controller.getHeights);
  router.post('/', controller.getHeightsList);

  return router;
};

export const HEIGHTS_ROUTER_SYMBOL = Symbol('heightsRouterFactory');

export { heightsRouterFactory };
