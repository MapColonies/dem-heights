import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { HeightsController } from '../controllers/heightsController';

const heightsRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(HeightsController);

  router.post('/points', controller.getPoints);
  // router.post('/path', controller.getPath);
  // router.post('/polygon', controller.getPolygon);
  // router.post('/', controller.getHeights);
  // router.get('/:longitude/:latitude', controller.getHeight);

  return router;
};

export const HEIGHTS_ROUTER_SYMBOL = Symbol('heightsRouterFactory');

export { heightsRouterFactory };
