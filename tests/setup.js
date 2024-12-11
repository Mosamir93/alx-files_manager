import dbClient from '../utils/db';

beforeAll(async () => {
  await dbClient.db.collection('users').deleteMany({});
  await dbClient.db.collection('files').deleteMany({});
});

afterAll(async () => {
  await dbClient.db.close();
});
