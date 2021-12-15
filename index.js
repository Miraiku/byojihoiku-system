const cool = require('cool-ascii-faces');
const express = require('express');
const path = require('path');
const https = require("https");
const webhook = require('./modules/line')
const cron = require('node-cron');
const redis = require('./modules/db_redis')
process.env.TZ = "Asia/Tokyo";
const PORT = process.env.PORT || 5555;

express()
  .use(express.static(path.join(__dirname, 'public')))
  .use(express.json())
  .use(express.urlencoded({extended: true}))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  .use('/webhook', webhook)
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));

cron.schedule('*/20 * * * *', async () =>  {
  //per 20mins
  await redis.flushALL()
});