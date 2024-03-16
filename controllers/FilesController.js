import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fs = require('fs');
const uuid = require('uuid');

const getTokenUser = async (req) => {
  const myToken = req.header('X-Token');
  const userId = await redisClient.get(`auth_${myToken}`);
  return (userId);
};

class FilesController {
  static async postUpload(req, res) {
    const userId = await getTokenUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;
    const allowedTypes = ['file', 'image', 'folder'];
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !(allowedTypes.includes(type))) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }
    if (parentId) {
      const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });

      if (!file) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (file.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }
    const objectData = {
      userId: user._id.toString(),
      name,
      type,
      isPublic,
      parentId,
    };
    if (type === 'folder') {
      const newFolder = await dbClient.db.collection('files').insertOne(objectData);
      const [ops] = newFolder.ops;
      const result = {
        id: ops._id.toString(),
        userId: ops.userId,
        name: ops.name,
        type: ops.type,
        isPublic: ops.isPublic,
        parentId: ops.parentId,
      };
      return res.status(201).json(result);
    }
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const filename = uuid.v4();
    const filePath = `${folderPath}/${filename}`;
    const fileData = Buffer.from(data, 'base64');
    await fs.promises.mkdir(folderPath, { recursive: true });
    await fs.promises.writeFile(filePath, fileData);
    objectData.localPath = filePath;
    const uploadFlie = await dbClient.db.collection('files').insertOne(objectData);
    const [ops] = uploadFlie.ops; // we can do also ops = uploadFile.ops[0]
    const result = {
      id: ops._id.toString(),
      userId: ops.userId,
      name: ops.name,
      type: ops.type,
      isPublic: ops.isPublic,
      parentId: ops.parentId,
    };
    return res.status(201).json(result);
  }

  static async getShow(req, res) {
    const userId = await getTokenUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const objectId = ObjectId(req.params.id);
    // userId = ObjectId(userId);
    const file = await dbClient.db.collection('files').findOne({ _id: objectId, userId });
    if (!(file)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const { _id, ...element } = file;
    return res.status(200).json({ id: _id, ...element });
  }

  static async getIndex(req, res) {
    const userId = await getTokenUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { parentId, page = 0 } = req.query;
    const limit = 20;

    let query;
    if (!parentId) {
      query = {
        userId: ObjectId(userId),
      };
    } else {
      query = {
        userId: ObjectId(userId),
        parentId: ObjectId(parentId),
      };
    }
    const paginationFiles = [
      { $match: query },
      { $skip: (+page) * limit }, // +'123' === 123
      { $limit: limit },
    ];

    const result = await dbClient.db.collection('files').aggregate(paginationFiles).toArray();
    const modefyfResult = result.map(({ _id, localPath, ...element }) => ({
      id: _id,
      ...element,
    }));
    return res.status(200).json(modefyfResult);
  }

  static async putPublish(req, res) {
    let userId = await getTokenUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const objectId = ObjectId(req.params.id);
    userId = ObjectId(userId);
    const file = await dbClient.db.collection('files').findOneAndUpdate(
      { _id: objectId, userId },
      { $set: { isPublic: true } },
      { returnOriginal: false },
    );
    if (!(file.value)) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json(file.value);
  }

  static async putUnpublish(req, res) {
    let userId = await getTokenUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const objectId = ObjectId(req.params.id);
    userId = ObjectId(userId);
    const file = await dbClient.db.collection('files').findOneAndUpdate(
      { _id: objectId, userId },
      { $set: { isPublic: false } },
      { returnOriginal: false },
    );
    if (!(file.value)) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json(file.value);
  }
}

export default FilesController;
