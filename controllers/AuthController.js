const { v4: uuidv4 } = require('uuid');
const sha1 = require('sha1');
const { ObjectId } = require('mongodb');

const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AuthController {
  static async getConnect(req, res) {
    const users = dbClient.db.collection('users');

    const authHeader = req.headers.authorization;
    // No or invalid Authorization header
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(403).send({ error: 'Unauthorized' });
    }

    // Extract Base64 encoded credentials from authorization header
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString();
    const [username, password] = credentials.split(':');

    // No or invalid credentials
    if (!username || !password) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    // Check username and password
    const user = await users.findOne({ email: username, password: sha1(password) });
    if (!user) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    // Create a new token
    const token = uuidv4();
    // Save the token in Redis
    const key = `auth_${token}`;
    const duration = 60 * 60 * 24; // 24 hours / 86400 seconds

    await redisClient.set(key, user._id.toString(), duration);
    return res.status(200).send({ token });
  }

  static async getDisconnect(req, res) {
    // Get disconnected token from the header
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    // Get the user ID from Redis
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    // If the user is not found
    if (!userId) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    // If the user is authenticated, delete the token from the Redis
    await redisClient.del(key);

    return res.status(204).send();
  }

  static async getMe(req, res) {
    const users = dbClient.db.collection('users');
    // get the token from the header
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    // get the user ID from Redis
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    // get the user from the database
    const user = await users.findOne({ _id: ObjectId(userId) });
    if (!user) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    return res.json({ id: user._id, email: user.email });
  }
}

module.exports = AuthController;
