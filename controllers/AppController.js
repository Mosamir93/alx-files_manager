import dbClient from '../utils/db';
import redisClient from '../utils/redis';

function getStatus(req, res) {
  return res.status(200).json({
    redis: redisClient.isAlive(),
    db: dbClient.isAlive(),
  });
}

async function getStats(req, res) {
  return res.status(200).json({
    users: await dbClient.nbUsers(),
    files: await dbClient.nbFiles(),
  });
}

export default {
  getStatus,
  getStats,
};
