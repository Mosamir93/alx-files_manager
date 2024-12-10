import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { ObjectId } from 'mongodb';
import { promisify } from 'util';
import mime from 'mime-types';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
const readFileAsync = promisify(fs.readFile);

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

      if (!fs.existsSync(FOLDER_PATH)) fs.mkdirSync(FOLDER_PATH, { recursive: true });
      await fs.promises.writeFile(filePath, Buffer.from(data, 'base64'));
      newFile.localPath = filePath;
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

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const file = await dbClient.db.collection('files').findOne({
      _id: ObjectId(id),
      userId: ObjectId(userId),
    });

    if (!file) return res.status(404).json({ error: 'Not found' });

    file.id = file._id;
    delete file._id;

    return res.status(200).json({
      id: file.id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { parentId = 0, page = 0 } = req.query;
    const query = { userId: ObjectId(userId) };
    if (parentId !== 0) query.parentId = ObjectId(parentId);

    const files = await dbClient.db.collection('files')
      .find(query)
      .skip(parseInt(page, 10) * 20)
      .limit(20)
      .toArray();

    return res.status(200).json(
      files.map((file) => ({
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      })),
    );
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'] || req.headers['X-Token'];
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

  static async getFile(req, res) {
    try {
      const fileId = req.params.id;
      if (!fileId) return res.status(404).json({ error: 'Not found' });

      const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId) });
      if (!file) return res.status(404).json({ error: 'Not found' });

      // Handle folder type
      if (file.type === 'folder') {
        return res.status(400).json({ error: "A folder doesn't have content" });
      }

      const token = req.headers['x-token'];
      const userId = token ? await redisClient.get(`auth_${token}`) : null;

      // Check access permissions
      if (!file.isPublic && (!userId || file.userId.toString() !== userId)) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Verify file existence
      const { localPath } = file;
      if (!localPath || !fs.existsSync(localPath)) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Get MIME type and file content
      const mimeType = mime.lookup(file.name) || 'application/octet-stream';
      const data = await readFileAsync(localPath);

      res.setHeader('Content-Type', mimeType);
      return res.status(200).send(data);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default FilesController;
