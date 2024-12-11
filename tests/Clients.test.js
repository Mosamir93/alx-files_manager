import redisClient from '../utils/redis';
import dbClient from '../utils/db';

describe('Redis Client', () => {
  test('should check if Redis is alive', () => {
    expect(redisClient.isAlive()).toBe(true);
  });
});

describe('Database Client', () => {
  test('should check if DB is alive', async () => {
    expect(dbClient.isAlive()).toBe(true);
  });

  test('should retrieve the number of users', async () => {
    const users = await dbClient.nbUsers();
    expect(typeof users).toBe('number');
  });

  test('should retrieve the number of files', async () => {
    const files = await dbClient.nbFiles();
    expect(typeof files).toBe('number');
  });
});
