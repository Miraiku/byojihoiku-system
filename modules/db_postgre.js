const express = require('express');
const router = express.Router()
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
const https = require("https");

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