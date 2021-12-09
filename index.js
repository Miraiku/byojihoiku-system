const cool = require('cool-ascii-faces');
const express = require('express');
const path = require('path');
const PORT = process.env.PORT || 5555;
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
const Redis = require("ioredis");
const https = require("https");
const webhook = require('./modules/line')
const TOKEN = process.env.LINE_ACCESS_TOKEN
const redis_client = new Redis(process.env.REDIS_URL);
const member_table = ['LINEID','Name','BirthDay','Allergy']

express()
  .use(express.static(path.join(__dirname, 'public')))
  .use(express.json())
  .use(express.urlencoded({extended: true}))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  .get('/cool', (req, res) => res.send(cool()))
  .get('/times', (req, res) => res.send(showTimes()))
  .get('/db', async (req, res) => {
    try {
      const psgl_client = await pool.connect();
      const result = await psgl_client.query('SELECT * FROM test_table');
      const results = { 'results': (result) ? result.rows : null};
      res.render('pages/db', results );
      psgl_client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  .use('/webhook', webhook)
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));