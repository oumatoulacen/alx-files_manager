const { MongoClient } = require('mongodb');

const port = process.env.DB_PORT || 27017;
const host = process.env.DB_HOST || 'localhost';
const database = process.env.DB_DATABASE || 'files_manager';
const url = `mongodb://${host}:${port}/`;

class DBClient {
  constructor() {
    this.client = new MongoClient(url);
    this.client.connect();
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    const db = this.client.db(database);
    const users = db.collection('users');
    return users.countDocuments();
  }

  async nbFiles() {
    const db = this.client.db(database);
    const files = db.collection('files');
    return files.countDocuments();
  }
}

const dbClient = new DBClient();

module.exports = dbClient;
