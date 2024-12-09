import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const { userId } = await FilesController.getAuthenticatedUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    let parentFile = null;
    if (parentId !== 0) {
      parentFile = await dbClient.db.collection('files').findOne({ _id: parentId });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const newFile = {
      userId,
      name,
      type,
      isPublic,
      parentId,
    };

    const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (type !== 'folder') {
      const filePath = path.join(FOLDER_PATH, uuidv4());
      newFile.localPath = filePath;

      try {
        await fs.mkdir(FOLDER_PATH, { recursive: true });
        await fs.writeFile(filePath, Buffer.from(data, 'base64'));
      } catch (err) {
        return res.status(500).json({ error: 'Error writing file to disk' });
      }
    }

    const result = await dbClient.db.collection('files').insertOne(newFile);
    newFile._id = result.insertedId;

    return res.status(201).json({
      id: newFile._id,
      userId,
      name,
      type,
      isPublic,
      parentId,
      localPath: newFile.localPath || undefined,
    });
  }

  static async getAuthenticatedUser(req) {
    const token = req.header('X-Token');
    if (!token) return {};

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return {};
    return { userId };
  }
}

export default FilesController;
