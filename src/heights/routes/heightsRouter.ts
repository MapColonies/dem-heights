import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { HeightsController } from '../controllers/heightsController';

const heightsRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(HeightsController);

  router.get('/:longitude/:latitude', controller.getHeight);
  router.post('/polygon', controller.getPolygon);
  router.post('/', controller.getHeights);

  return router;
};

export const HEIGHTS_ROUTER_SYMBOL = Symbol('heightsRouterFactory');

export { heightsRouterFactory };
