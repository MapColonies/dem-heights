import * as supertest from 'supertest';
import { GetHeightsPointsRequest } from '../../../../src/heights/controllers/heightsController';

export class HeightsRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async getPoints(payload: GetHeightsPointsRequest): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/points').send(payload).set('Content-Type', 'application/json');
  }

  public async getPointsProtobuf(payload: ArrayBufferLike): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/points').send(payload).set('Content-Type', 'application/octet-stream');
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
