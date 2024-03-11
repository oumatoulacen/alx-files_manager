const { MongoClient } = require('mongodb');

const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || 27017;
const database = process.env.DB_DATABASE || 'files_manager';

class DBClient {
  constractor() {
    this.dbClient = new MongoClient(`mongodb://${host}:${port}`);
    this.dbClient.connect();
  }

  isAlive() {
    return this.dbClient.isConnected();
  }

  async nbUsers() {
    return this.dbClient.db(database).collection('users').countDocuments();
  }

  async nbFiles() {
    return this.dbClient.db(database).collection('files').countDocuments();
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
