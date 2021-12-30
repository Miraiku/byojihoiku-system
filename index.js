process.env.TZ = "Asia/Tokyo";
const express = require('express');
const path = require('path');
const https = require("https");
const request = require('request');
const webhook = require('./modules/line_receiver')
const ajax = require('./modules/ajax_receiver')
const cron = require('node-cron');
const redis = require('./modules/db_redis')
const psgl = require('./modules/db_postgre')
const views = require('./modules/view_data_render')
const session = require('cookie-session');
const PORT = process.env.PORT || 5555;
const login = require('./modules/view_login')

express()
  .use(express.static(path.join(__dirname, 'public')))
  .use(express.json())
  .use(express.urlencoded({extended: true}))
  .use(session({
    name: 'session',
    keys: ['key1', 'key2'],
    cookie: {
      secure: true,
      httpOnly: true,
      domain: 'byojihoiku.chiikihoiku.net',
      expires: 86400000 * 5
    }
  }))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', views.getLoginPage)
  .post('/', login.signin)
  .get('/calendar', views.getCalendarPage)
  .get('/home', views.getNurseryStatus3Days)
  .get('/member', views.getMembersPage)
  .get('/member/entry/:memberid', views.getEntryPage)
  .get('/reservation/', views.getReservationPage)
  .get('/reservation/:nurseryid', views.getReservationPage)
  .get('/reservation/confirm/:reservationid', views.getReservationConfirmPage)
  .get('/reservation/entry/:reservationid', views.getReservationEntryPage)
  .get('/reservation/update', (req, res) => res.render('pages/index'))
  .get('/logout', views.getLogout)
  .get('/secret/regsiter', views.getRegisterPage)
  .post('/secret/regsiter', login.signup)
  .use('/webhook', webhook)
  .use('/updater', ajax)
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));

//20分以上操作がないRedisの一時クエリを削除
cron.schedule('*/20 * * * *', async () =>  {
  console.log(`Run Cron per 20mins`)
  await redis.flushALLNoUpdate20mins()
});

//予約の当日朝キャンセル処理(20時以降の予約はリマインダーを送信しない/キャンセル処理しないことになっている)
cron.schedule('0 0 7 * * *', async () => {
  try {
    let lineids = await psgl.getLINEIDTodayReservationReminderStatusIsWaitingAndUpdateCancelled()
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
cron.schedule('0 0 20 * * *', async () => {
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
            await psgl.updateTomorrowReservedReminderStatusByLineID(lineid, 'waiting')
          }
          console.log("cron schedule error:"+ error); 
        }
      ); 
    }
  } catch (error) {
    console.log('8pm error:'+ error)
  }
});

