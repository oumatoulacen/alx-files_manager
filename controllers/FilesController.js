// const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs').promises;

const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');
// const AuthController = require('./AuthController');

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
class FilesController {
  static async postUpload(req, res) {
    const user = await FilesController.getUser(req);
    if (!user) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const name = req.body ? req.body.name : null;
    const type = req.body ? req.body.type : null;
    const parentId = req.body.parentId && req.query.parentId !== '0' ? req.body.parentId : 0;
    const isPublic = req.body.isPublic ? req.body.isPublic : false;
    const base64Data = req.body.data;

    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (!base64Data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }
    if (parentId) {
      const parent = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId), userId: user._id });
      if (!parent) {
        return res.status(400).json({ error: 'Parent not found' });
      }
    }
    const data = Buffer.from(base64Data, 'base64');
    const file = {
      userId: user._id,
      name,
      type,
      isPublic,
      parentId,
    };
    await fs.mkdir(FOLDER_PATH, { recursive: true });
    const filePath = path.join(FOLDER_PATH, uuidv4());
    if (type !== 'folder') {
      await fs.writeFile(filePath, data);
      file.localPath = filePath;
    }
    const result = await dbClient.db.collection('files').insertOne(file);
    delete file._id;
    return res.status(201).send({ id: result.insertedId, ...file });
  }

  // get the file based on the file id
  static async getShow(req, res) {
    const user = await FilesController.getUser(req);
    if (!user) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: user._id });
    if (!file) {
      return res.status(404).send({ error: 'Not found' });
    }
    delete file._id;
    return res.status(200).send({ id: fileId, ...file });
  }

  // get the list of files based on the parentId
  static async getIndex(req, res) {
    const user = await FilesController.getUser(req);
    const collection = dbClient.db.collection('files');
    if (!user) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    const parentId = req.query.parentId && req.query.parentId !== '0' ? req.query.parentId : 0;
    const page = parseInt(req.query.page, 10) || 0;
    const limit = 20;
    const skip = page * limit;
    const query = { userId: ObjectId(user._id), parentId };
    // const files = await collection.find(query).skip(skip).limit(limit).toArray();
    const files = await collection.find(query).skip(skip).limit(limit).toArray();
    console.log(files.length);
    return res.status(200).send(
      files.map((file) => {
        const { _id, ...rest } = file;
        return { id: _id, ...rest };
      }),
    );
  }

  // publish a file based on the file id
  static async putPublish(req, res) {
    const user = await FilesController.getUser(req);
    if (!user) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: user._id });
    if (!file) {
      return res.status(404).send({ error: 'Not found' });
    }
    const query = { _id: ObjectId(fileId) };
    const newFile = { $set: { isPublic: true } };
    await dbClient.db.collection('files').updateOne(query, newFile);
    return res.status(200).send({ ...file, isPublic: true });
  }

  // unpublish a file based on the file id
  static async putUnpublish(req, res) {
    const user = await FilesController.getUser(req);
    if (!user) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: user._id });
    if (!file) {
      return res.status(404).send({ error: 'Not found' });
    }
    const query = { _id: ObjectId(fileId) };
    const newFile = { $set: { isPublic: false } };
    await dbClient.db.collection('files').updateOne(query, newFile);
    return res.status(200).send({ ...file, isPublic: false });
  }

  // get the file data based on the file id
  static async getFile(req, res) {
    const user = await FilesController.getUser(req);
    if (!user) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: user._id });
    if (!file || file.isPublic === false) {
      return res.status(404).send({ error: 'Not found' });
    }
    if (file.type === 'folder') {
      return res.status(400).send({ error: 'A folder doesn\'t have content' });
    }
    if (file.type === 'image') {
      const content = fs.readFileSync(file.localPath, 'utf8');
      const data = Buffer.from(content).toString('base64');
      return res.status(200).send({ ...file, data });
    }
    const content = fs.readFileSync(file.localPath, 'utf8');
    return res.status(200).send({ ...file, data: content });
  }

  // helper method to get the user based on the token
  static async getUser(req) {
    const token = req.headers['x-token'];
    if (!token) {
      return;
    }

    // Get the user ID from Redis
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    // If the user is exist
    if (!userId) {
      return;
    }
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
    if (!user) {
      return;
    }
    // eslint-disable-next-line consistent-return
    return user;
  }
}

module.exports = FilesController;
