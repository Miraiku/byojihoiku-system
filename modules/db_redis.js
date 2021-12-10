const express = require('express');
const router = express.Router()
const Redis = require("ioredis");
const redis_client = new Redis(process.env.REDIS_URL);

exports.sqlToPostgre = async function (queryString){
  try {
    const psgl_client = await pool.connect(); 
    const results = await psgl_client.query(queryString);
    psgl_client.release();
    return results
  }
  catch (err) {
    console.log(`PSGL ERR: ${err}`)
    return null
  }
}

exports.client = function (){
  return redis_client
}