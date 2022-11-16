import * as supertest from 'supertest';

export class HeightsRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async getHeights(): Promise<supertest.Response> {
    return supertest.agent(this.app).get('/heights').set('Content-Type', 'application/json');
  }

  public async getHeightsList(): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/heights').set('Content-Type', 'application/json');
  }
}
