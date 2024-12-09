import dbClient from '../utils/db';
import redisClient from '../utils/redis';

function getStatus(req, res) {
  return res.status(200).json({
    redis: redisClient.isAlive(),
    db: dbClient.isAlive(),
  });
}

function getStats(req, res) {
  return res.status(200).json({
    users: dbClient.nbUsers(),
    files: dbClient.nbFiles(),
  });
}

export default {
  getStatus,
  getStats,
};
