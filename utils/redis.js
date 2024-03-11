const redis = require('redis');

class RedisClient {
  constructor() {
    this.client = redis.createClient();

    // Display any error of the redis client in the console
    this.client.on('error', (err) => {
      console.error('Redis error:', err);
    });
  }

  isAlive() {
    return this.client.connected;
  }

  async get(key) {
    return new Promise((resolve, reject) => {
      this.client.get(key, (err, reply) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(reply);
      });
    });
  }

  async set(key, value, duration) {
    return new Promise((resolve, reject) => {
      this.client.set(key, value, 'EX', duration, (err, reply) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(reply);
      });
    });
  }

  async del(key) {
    return new Promise((resolve, reject) => {
      this.client.del(key, (err, reply) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(reply);
      });
    });
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
