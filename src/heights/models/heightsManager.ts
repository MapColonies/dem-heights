import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';

export interface IHeightModel {
  dem: number;
}

@injectable()
export class HeightsManager {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger) {}

  public getHeights(): IHeightModel {
    this.logger.info({ msg: 'getting height' });

    return { dem: 1037 };
  }

  public getHeightsList(height: IHeightModel): IHeightModel {
    this.logger.info({ msg: 'getting height list' });

    return { ...height };
  }
}
