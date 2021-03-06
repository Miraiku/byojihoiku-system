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
  .get('/secret/register', views.getRegisterPage)
  .post('/secret/register', login.signup)
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

const sendWaitingUser = cron.schedule('*/15 * * * *',async () => {
  for (const n of today_capacity) {
    let perv_lineid = await redis.hgetStatus('waiting_current_lineid_bynurseryid',n.id)
    if(perv_lineid.length > 0){
      await psgl.setTodayReservationStatusIsCancelled(perv_lineid)
    }
    await redis.hsetStatus('waiting_current_lineid_bynurseryid',n.id,null)
    let current_lineid = await redis.LPOP(n.id)
    let current_capacity = await redis.hgetStatus('waiting_current_capacity',n.id)
    let current_nursery_name = await redis.hgetStatus('waiting_nursery_name', n.id)
    if(current_lineid != null && Number(current_capacity) > 0 ){
      for (const user of today_waiting_user_list_withoutsameLINEID) {
        if(current_lineid == user.lineid){
          await redis.hsetStatus('waiting_current_lineid_bynurseryid',n.id,current_lineid)
          request.post(
            { headers: {'content-type' : 'application/json'},
            url: 'https://byojihoiku.chiikihoiku.net/webhook',
            body: JSON.stringify({
              message: {'text': 'cron'},
              "line_push_from_cron": "7amwaiting",
              "id": current_lineid,
              'nurseryname': current_nursery_name
              })
            },
            function(error, response, body){
              if(error){
                console.log('error@sendWaitingUser' + error)
              }
              console.log(response.statusCode)
              console.log(body)
              if(response.statusCode == 200){
                is_send = true
              }else{
                is_send = false
              }
            }
          );
          return true
        }
      }
    }
  }
});

//当日のウェイティングリストの問い合わせ 回答待ちは15分で、それ以上は次のユーザーに問い合わせる
//7AMに選別がおわるため、7:03開始、7：18分に巡回発火
cron.schedule('0 3 7 * * *', async () =>  {
  try {
    const original_list = await psgl.getTodayWaitingRsvIDLineIDListSortByCreatedAt()
    if(original_list.length <= 0){
      return false
    }
    today_waiting_user_list_withoutsameLINEID = []
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
    today_capacity = await psgl.getAvailableNurseryOnToday()
    for (const nursery of today_capacity) {
      await redis.hsetStatus('waiting_current_capacity', nursery.id, nursery.capacity)
      await redis.hsetStatus('waiting_nursery_name', nursery.id, nursery.name)
      for (const user of today_waiting_user_list_withoutsameLINEID) {
        if(nursery.id == user.nurseryid){
          await redis.RPUSH(nursery.id, user.lineid)
        }
      }
      await redis.hsetStatus('waiting_current_lineid_bynurseryid',nursery.id,null)
    }
    sendWaitingUser.start()
  } catch (error) {
    console.log('ERROR: @ waitinglist : '+error)
  }
});

//朝9時にウェイティングリストの巡回を停止する
cron.schedule('0 0 9 * * *', async () => {
  console.log("end waiting list job...")
  await redis.resetAllStatus('waiting_current_lineid_bynurseryid')
  await redis.Del('waiting_current_lineid_bynurseryid')
  await redis.resetAllStatus('waiting_current_capacity')
  await redis.Del('waiting_current_capacity')
  await redis.resetAllStatus('waiting_nursery_name')
  await redis.Del('waiting_nursery_name')
  for (const nursery of today_capacity) {
    await redis.Del(nursery.id)
  }
  sendWaitingUser.stop()
})

//予約の当日朝キャンセル処理(20時以降の予約はリマインダーを送信しない/キャンセル処理しないことになっている)
cron.schedule('0 0 7 * * *', async () => {
  try {
    let lineids = await psgl.getLINEIDTodayReservationReminderStatusIsWaitingAndUpdateCancelled()
    let withoutsameLINEID = []
    if(lineids.length <= 0){
      return false
    }
    for (let i = 0; i < lineids.length; i++) {
      if(i==0){
        withoutsameLINEID.push(lineids[i][0].LINEID)
      }else{
        for (const n of withoutsameLINEID) {
          if(n == lineids[i][0].LINEID){
            continue
          }else{
            withoutsameLINEID.push(lineids[i][0].LINEID)
          }
        }
      }
    }
    for (const id of withoutsameLINEID) {
      request.post(
        { headers: {'content-type' : 'application/json'},
        url: 'https://byojihoiku.chiikihoiku.net/webhook',
        body: JSON.stringify({
          message: {'text': 'cron'},
          "line_push_from_cron": "today7am",
          "id": id
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
    if(ids.length <= 0){
      return false
    }
    for (const id of ids) {
      request.post(
        { headers: {'content-type' : 'application/json'},
        url: 'https://byojihoiku.chiikihoiku.net/webhook',
        body: JSON.stringify({
          message: {'text': 'cron'},
          "line_push_from_cron": "20pm",
          "id": id.lineid,
          "name": id.name,
          "nurseryname": id.nurseryname
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

