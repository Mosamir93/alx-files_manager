import request from 'supertest';
import app from '../server';
import dbClient from '../utils/db';

describe('API Endpoints', () => {
  let token;
  let userId;

  beforeAll(async () => {
    await dbClient.db.collection('users').deleteMany({});
    await dbClient.db.collection('files').deleteMany({});
  });

  test('GET /status', async () => {
    const res = await request(app).get('/status');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('redis', true);
    expect(res.body).toHaveProperty('db', true);
  });

  test('GET /stats', async () => {
    const res = await request(app).get('/stats');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('users', 0);
    expect(res.body).toHaveProperty('files', 0);
  });

  test('POST /users', async () => {
    const res = await request(app).post('/users').send({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('email', 'test@example.com');
    userId = res.body.id;
  });

  test('GET /connect', async () => {
    const auth = Buffer.from('test@example.com:password123').toString('base64');
    const res = await request(app).get('/connect').set('Authorization', `Basic ${auth}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    token = res.body.token;
  });

  test('GET /users/me', async () => {
    const res = await request(app).get('/users/me').set('x-token', token);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('id', userId);
    expect(res.body).toHaveProperty('email', 'test@example.com');
  });

  test('POST /files', async () => {
    const res = await request(app).post('/files').set('x-token', token).send({
      name: 'test_file',
      type: 'file',
      data: 'SGVsbG8gd29ybGQ=', // Base64 for "Hello world"
    });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name', 'test_file');
  });

});
