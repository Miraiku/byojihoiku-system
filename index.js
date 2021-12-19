const cool = require('cool-ascii-faces');
const express = require('express');
const path = require('path');
const https = require("https");
const request = require('request');
const webhook = require('./modules/line_receiver')
const cron = require('node-cron');
const redis = require('./modules/db_redis')
const psgl = require('./modules/db_postgre')
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
cron.schedule('0 0 7 * * *', async () => {
  try {
    let lineids = await psgl.getLINEIDTodayReservationReminderStatusIsWaitingAndUpdateCanceled()
    for (const id of lineids) {
      console.log(id[0].LINEID)
      request.post(
        { headers: {'content-type' : 'application/json'},
        url: 'https://byojihoiku-system.herokuapp.com/webhook',
        body: JSON.stringify({
          "line_push_from_cron": "today7am",
          "id": id[0].LINEID
          })
        },
        function(error, response, body){
          console.log("cron schedule 7am:"+ error); 
          console.log("cron schedule 7am:"+ response && response.statusCode); 
          console.log("cron schedule 7am:"+ body); 
        }
      );
    }
  } catch (error) {
    console.log('7am error:'+ error)
  }
});

//前日リマインダー送信
//cron.schedule('0 0 20 * * *', async () => {
cron.schedule('*/1 * * * *', async () =>  {
  try {
    let ids = await psgl.getLINEIDByReservedTomorrow()
    for (const id of ids) {
      request.post(
        { headers: {'content-type' : 'application/json'},
        url: 'https://byojihoiku-system.herokuapp.com/webhook',
        body: JSON.stringify({
          "line_push_from_cron": "20pm",
          "id": id[0].LINEID,
          })
        },
        async function(error, response, body){
          if(response.statusCode == '200' && body != null){
            let lineid = body
            await psgl.updateTomorrowTodayReservedReminderStatusByLineID(lineid, 'waiting')
          }
          console.log("cron schedule error:"+ error); 
        }
      ); 
    }
  } catch (error) {
    console.log('8pm error:'+ error)
  }
});

