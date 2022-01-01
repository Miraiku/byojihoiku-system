process.env.TZ = "Asia/Tokyo";
const express = require('express');
const path = require('path');
const https = require("https");
const request = require('request');
const webhook = require('./modules/receiver_line')
const ajax = require('./modules/receiver_ajax')
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
    maxAge: 24 * 60 * 60 * 1000 * 5,
    cookie: {
      secure: true,
      httpOnly: true,
      domain: 'byojihoiku.chiikihoiku.net'
    }
  }))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', views.getLoginPage)
  .post('/', login.signin)
  .get('/calendar', views.getCalendarPage)
  .get('/home', views.getNurseryStatus3Days)
  .get('/member', views.getMembersPage)
  .get('/member/entry/', views.getMembersPage)
  .get('/member/entry/:memberid', views.getEntryPage)
  .get('/reservation/', views.getReservationPage)
  .get('/reservation/:nurseryid', views.getReservationPage)
  .get('/reservation/confirm/:reservationid', views.getReservationConfirmPage)
  .get('/reservation/entry/:reservationid', views.getReservationEntryPage)
  .get('/reservation/update', (req, res) => res.render('pages/index', {SubTitle:''}))
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

/* Waiting List Remineder */
let today_capacity
let today_waiting_user_list_withoutsameLINEID = []

const sendWaitingUser = cron.schedule('*/1 * * * *',async () => {
  for (const n of today_capacity) {
    let current_lineid = await redis.LPOP(n.id)
    let current_capacity = await redis.hgetStatus('waiting_current_capacity',n.id)
    if(Number(current_capacity) > 0){
      await redis.hsetStatus('waiting_current_lineid_bynurseryid',n.id,current_lineid)
      request.post(
        { headers: {'content-type' : 'application/json'},
        url: 'https://byojihoiku.chiikihoiku.net/webhook',
        body: JSON.stringify({
          message: {'text': 'cron'},
          "line_push_from_cron": "7amwaiting",
          "id": current_lineid
          })
        },
        function(error, response, body){
          if(error){
            console.log('error@sendWaitingUser' + error)
          }
          if(response.statusCode == 200){
            is_send = true
          }else{
            is_send = false
          }
        }
      );
    }
  }
});

cron.schedule('*/10  * * * *', async () =>  {
  console.log("end waiting list job...")
  await redis.resetAllStatus('waiting_current_lineid_bynurseryid')
  await redis.Del('waiting_current_lineid_bynurseryid')
  for (const nursery of today_capacity) {
    await redis.Del(nursery.id)
  }
})


//キャンセル待ちユーザーに回答を問い合わせ 回答待ちは15分で、それ以上は次のユーザーに問い合わせる
cron.schedule('*/2  * * * *', async () =>  {
  try {
    //7:10 頃開始？園ごとに設定する  
    const original_list = await psgl.getTodayWaitingRsvIDLineIDListSortByCreatedAt()
    console.log(original_list)
    for (let i = 0; i < original_list.length; i++) {
      if(i==0){
        today_waiting_user_list_withoutsameLINEID.push(original_list[i])
      }else{
        for (const n of today_waiting_user_list_withoutsameLINEID) {
          if(n.lineid == original_list[i].lineid){
            continue
          }else{
            today_waiting_user_list_withoutsameLINEID.push(original_list[i])
          }
        }
      }
    }
    console.log(today_waiting_user_list_withoutsameLINEID)
    today_capacity = await psgl.getAvailableNurseryOnToday()
    for (const nursery of today_capacity) {
      await redis.hsetStatus('waiting_current_capacity', nursery.id, nursery.capacity)
      for (const user of today_waiting_user_list_withoutsameLINEID) {
        console.log(user)
        console.log(nursery.id,user.lineid)
        await redis.RPUSH(nursery.id, user.lineid)
        await redis.hsetStatus('waiting_current_lineid_bynurseryid',nursery.id,null)
      }
    }
    sendWaitingUser.start();
  } catch (error) {
    console.log('ERROR: @ waitinglist : '+error)
  }
});

//予約の当日朝キャンセル処理(20時以降の予約はリマインダーを送信しない/キャンセル処理しないことになっている)
cron.schedule('0 0 7 * * *', async () => {
  try {
    let lineids = await psgl.getLINEIDTodayReservationReminderStatusIsWaitingAndUpdateCancelled()
    for (const id of lineids) {
      console.log(id[0].LINEID)
      request.post(
        { headers: {'content-type' : 'application/json'},
        url: 'https://byojihoiku.chiikihoiku.net/webhook',
        body: JSON.stringify({
          message: {'text': 'cron'},
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
        url: 'https://byojihoiku.chiikihoiku.net/webhook',
        body: JSON.stringify({
          message: {'text': 'cron'},
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

