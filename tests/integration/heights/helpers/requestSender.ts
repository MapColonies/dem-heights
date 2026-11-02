import * as supertest from 'supertest';
import { GetHeightsPointsRequest } from '../../../../src/heights/controllers/heightsController';

export class HeightsRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async getPoints(payload: GetHeightsPointsRequest, query?: Record<string, string> | string): Promise<supertest.Response> {
    // A raw string lets tests build a query string supertest's .query() can't (e.g. a repeated key).
    const path = typeof query === 'string' ? `/points?${query}` : '/points';
    const request = supertest.agent(this.app).post(path).send(payload).set('Content-Type', 'application/json');
    return typeof query === 'object' ? request.query(query) : request;
  }

  // public async getPath(): Promise<supertest.Response> {
  //   return supertest.agent(this.app).post('/path').set('Content-Type', 'application/json');
  // }

  // public async getPolygon(): Promise<supertest.Response> {
  //   return supertest.agent(this.app).post('/polygon').set('Content-Type', 'application/json');
  // }

  // public async getHeights(): Promise<supertest.Response> {
  //   return supertest.agent(this.app).post('/').set('Content-Type', 'application/json');
  // }

  // public async getHeight(): Promise<supertest.Response> {
  //   return supertest.agent(this.app).get('/').set('Content-Type', 'application/json');
  // }
}
