import * as supertest from 'supertest';
import { GetHeightsPointsRequest } from '../../../../src/heights/controllers/heightsController';

export class HeightsRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async getPoints(payload: GetHeightsPointsRequest): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/heights/points').send(payload).set('Content-Type', 'application/json');
  }

  public async getPointsProtobuf(payload: ArrayBufferLike): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/heights/points').send(payload).set('Content-Type', 'application/octet-stream');
  }

  // public async getPath(): Promise<supertest.Response> {
  //   return supertest.agent(this.app).post('/heights/path').set('Content-Type', 'application/json');
  // }

  // public async getPolygon(): Promise<supertest.Response> {
  //   return supertest.agent(this.app).post('/heights/polygon').set('Content-Type', 'application/json');
  // }

  // public async getHeights(): Promise<supertest.Response> {
  //   return supertest.agent(this.app).post('/heights').set('Content-Type', 'application/json');
  // }

  // public async getHeight(): Promise<supertest.Response> {
  //   return supertest.agent(this.app).get('/heights').set('Content-Type', 'application/json');
  // }
}
