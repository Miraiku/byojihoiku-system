const express = require('express');
const router = express.Router()
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
const Redis = require("ioredis");
const https = require("https");
const redis_client = new Redis(process.env.REDIS_URL);


module.exports = {
  RedisClient: function () {
    return redis_client
  },
}

module.exports = {
  PsglClient: function () {
    return pool
  },
}