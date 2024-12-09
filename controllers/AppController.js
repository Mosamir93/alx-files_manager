import db from "../utils/db";
import redis from "../utils/redis";

function getStatus(req, res) {
  return res.status(200).json({
    redis: redis.isAlive(),
    db: db.isAlive(),
  });
}

function getStats(req, res) {
  return res.status(200).json({
    users: db.nbUsers(), 
    files: db.nbFiles()
  });
}

export default {
  getStatus,
  getStats
}
