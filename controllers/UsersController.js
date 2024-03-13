const sha1 = require('sha1');
const dbClient = require('../utils/db');
// const redisClient = require('../utils/redis');

class UsersController {
  static async postNew(req, res) {
    const users = dbClient.db.collection('users');
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email) {
      return res.status(400).send({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).send({ error: 'Missing password' });
    }

    // Check if email is already exist in the database
    const user = await users.findOne({ email });
    if (user) {
      return res.status(400).send({ error: 'Already exist' });
    }

    // create a new user in the database
    const newUser = await users.insertOne({ email, password: sha1(password) });
    return res.status(201).send({ id: newUser.insertedId, email });
  }
}
module.exports = UsersController;
