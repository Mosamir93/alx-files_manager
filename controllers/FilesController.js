import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('x-token');
    const userId = await redisClient.get(`auth_${token}`);
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

    if (parentId !== 0) {
      const parentFile = await dbClient.db
        .collection('files')
        .findOne({ _id: ObjectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const newFile = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? 0 : ObjectId(parentId),
    };

    if (type !== 'folder') {
      const filePath = path.join(FOLDER_PATH, uuidv4());

      if (!fs.existsSync(FOLDER_PATH)) fs.mkdir(FOLDER_PATH, { recursive: true });
      fs.writeFile(filePath, Buffer.from(data, 'base64'));
      newFile.localPath = filePath;
    }

    const result = await dbClient.db.collection('files').insertOne(newFile);
    newFile._id = result.insertedId;

    return res.status(201).json(newFile);
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    if (!fileId) return res.status(404).json({ error: 'Not found' });

    const file = await dbClient.db
      .collection('files')
      .findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
    if (!file) return res.status(404).json({ error: 'Not found' });

    return res.status(200).json(file);
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parentId = req.query.parentId || '0';
    const page = parseInt(req.query.page, 10) || 0;

    const pipeline = [
      {
        $match: {
          userId: ObjectId(userId),
          parentId: parentId === '0' ? 0 : ObjectId(parentId),
        },
      },
      { $skip: page * 20 },
      { $limit: 20 },
    ];

    const files = await dbClient.db
      .collection('files')
      .aggregate(pipeline)
      .toArray();
    const response = files.map((file) => ({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
      localPath: file.localPath,
    }));

    return res.status(200).json(response);
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    if (!fileId) return res.status(404).json({ error: 'Not found' });

    const file = await dbClient.db
      .collection('files')
      .findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
    if (!file) return res.status(404).json({ error: 'Not found' });

    await dbClient.db
      .collection('files')
      .updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: true } });

    const updatedFile = await dbClient.db
      .collection('files')
      .findOne({ _id: ObjectId(fileId) });

    return res.status(200).json({
      id: updatedFile._id,
      userId: updatedFile.userId,
      name: updatedFile.name,
      type: updatedFile.type,
      isPublic: updatedFile.isPublic,
      parentId: updatedFile.parentId,
      localPath: updatedFile.localPath,
    });
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    if (!fileId) return res.status(404).json({ error: 'Not found' });

    const file = await dbClient.db
      .collection('files')
      .findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
    if (!file) return res.status(404).json({ error: 'Not found' });

    await dbClient.db
      .collection('files')
      .updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: false } });

    const updatedFile = await dbClient.db
      .collection('files')
      .findOne({ _id: ObjectId(fileId) });

    return res.status(200).json({
      id: updatedFile._id,
      userId: updatedFile.userId,
      name: updatedFile.name,
      type: updatedFile.type,
      isPublic: updatedFile.isPublic,
      parentId: updatedFile.parentId,
      localPath: updatedFile.localPath,
    });
  }
}

export default FilesController;
