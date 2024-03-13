const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs');

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
    // check if the data provided is valid and sufficient
    const {
      name, data, type, parentId, isPublic,
    } = req.body;
    if (!name) {
      return res.status(400).send({ error: 'Missing name' });
    }
    if (!type || (type !== 'folder' && type !== 'file' && type !== 'image')) {
      return res.status(400).send({ error: 'Missing type' });
    }
    if (!data && type !== 'folder') {
      return res.status(400).send({ error: 'Missing data' });
    }
    // check if the parentId is valid
    let parent;
    if (parentId) {
      parent = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });
      if (!parent) {
        return res.status(400).send({ error: 'Parent not found' });
      }
      if (parent.type !== 'folder') {
        return res.status(400).send({ error: 'Parent is not a folder' });
      }
    }

    const files = dbClient.db.collection('files');
    // Create a new folder in the database

    if (type === 'folder') {
      const file = {
        userId: user._id,
        name,
        type,
        isPublic: isPublic || false,
        parentId: parentId ? ObjectId(parentId) : 0,
      };
      const result = await files.insertOne(file);
      return res.status(201).send({ id: result.insertedId, ...file });
    }

    // save the data in the local path
    const file = {
      userId: user._id,
      name,
      type,
      isPublic: isPublic || false,
      parentId: parentId ? ObjectId(parentId) : 0,
      localPath: path.join(FOLDER_PATH, uuidv4()),
    };

    fs.mkdir(FOLDER_PATH, { recursive: true }, (err) => {
      if (err) {
        console.error(err.message);
        return;
      }
      console.log('Directory is created.');
    });

    const content = Buffer.from(data, 'base64').toString();
    fs.writeFile(file.localPath, content, 'utf8', (err) => {
      if (err) {
        console.error(err.message);
        return;
      }
      console.log('Text file written successfully');
    });

    const newFile = await files.insertOne(file);
    return res.status(200).send({ id: newFile.insertedId, ...file });
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
    return res.status(200).send({ ...file });
  }

  // get the list of files based on the parentId
  static async getIndex(req, res) {
    const user = await FilesController.getUser(req);
    const collection = dbClient.db.collection('files');
    if (!user) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    const parentId = req.query.parentId ? ObjectId(req.query.parentId) : 0;
    const page = parseInt(req.query.page, 10) || 0;
    const limit = 20;
    const skip = page * limit;
    const query = { parentId, userId: ObjectId(user._id) };
    const files = await collection.find(query).skip(skip).limit(limit).toArray();
    return res.status(200).send(files);
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
