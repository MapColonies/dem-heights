import * as supertest from 'supertest';

export class HeightsRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async getHeight(): Promise<supertest.Response> {
    return supertest.agent(this.app).get('/heights').set('Content-Type', 'application/json');
  }

  public async getPolygon(): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/heights/polygon').set('Content-Type', 'application/json');
  }

  public async getHeights(): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/heights').set('Content-Type', 'application/json');
  }
}
