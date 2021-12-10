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

router
  .use(function RedisClient (req, res, next) {
    return redis_client
  })
  .use(function PsglClient (req, res, next) {
    return pool
  })

module.exports = router