const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs');

const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
class FilesController {
  static async postUpload(req, res) {
    // You can use AuthController.getMe method to simplify
    const token = req.headers['x-token'];
    console.log(`Uploading file with token: ${token}`);
    if (!token) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    // Get the user ID from Redis
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    // If the user is exist
    if (!userId) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
    if (!user) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    console.log(`user: ${user.email} is authorized`);
    console.log(req.body);
    // check if the data provided is valid and sufficient
    const {
      name, data, type, parentId, isPublic,
    } = req.body;
    if (!name) {
      return res.status(400).send({ error: 'Missing name' });
    }
    if (!type || (type !== 'folder' && type !== 'file' && type !== 'folder')) {
      return res.status(400).send({ error: 'Missing type' });
    }
    if (!data && type !== 'folder') {
      return res.status(400).send({ error: 'Missing data' });
    }
    // check if the parentId is valid
    if (parentId) {
      const parent = await dbClient.db.collection('files').findOne({ _id: new ObjectId(parentId) });
      if (!parent) {
        return res.status(400).send({ error: 'Parent not found' });
      }
      if (parent.type !== 'folder') {
        return res.status(400).send({ error: 'Parent is not a folder' });
      }
    }

    const files = dbClient.db.collection('files');

    // Create a new folder in the database
    const file = {
      userId: ObjectId(userId),
      name,
      type,
      parentId: parentId || 0,
      isPublic: isPublic || false,
      localPath: path.join('./', FOLDER_PATH, uuidv4()),
    };
    if (type === 'folder') {
      const id = await files.insertOne(file);
      const folder = { ...file };
      console.log(folder);
      delete folder.localPath;
      return res.status(201).send({ id: id.insertedId, ...folder });
    }

    // save the data in the local path
    const content = Buffer.from(data, 'base64').toString();
    fs.writeFile(file.localPath, content, 'utf8', (err) => {
      if (err) {
        console.error(err.message);
        return;
      }
      console.log('Text file written successfully');
    });

    const newFile = await files.insertOne(file);
    if (!newFile) {
      return res.status(400).send({ error: 'Can\'t create file' });
    }

    return res.status(200).send({ id: newFile.insertedId, ...file });
  }
}

module.exports = FilesController;
