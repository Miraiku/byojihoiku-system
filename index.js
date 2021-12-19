const cool = require('cool-ascii-faces');
const express = require('express');
const path = require('path');
const https = require("https");
const request = require('request');
const webhook = require('./modules/line_receiver')
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
  console.log(`Run Cron per 20mins`)
  await redis.flushALLNoUpdate20mins()
});

//予約の当日朝キャンセル処理
//cron.schedule('0 0 7 * * *', () => {

cron.schedule('*/1 * * * *', () => {
  //当日の予約のうち、返信がきたもの
  request.post(
    { headers: {'content-type' : 'application/json'},
    url: 'https://localhost/webhook:'+PORT,
    body: JSON.stringify({
      "line_push_from_cron": "today7am"
      })
    },
    function(error, response, body){
      console.log("cron schedule:"+ error); 
      console.log("cron schedule:"+ response); 
      console.log("cron schedule:"+ body); 
    }
  ); 
});

//前日リマインダー送信
cron.schedule('0 0 20 * * *', () => {
  console.log("おはよう！朝ご飯、ちゃんと食べた？( ﾟДﾟ)");
});