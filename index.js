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

//キャンセル待ちユーザーに回答を問い合わせ
cron.schedule('*/1 * * * *', async () =>  {
  try {
    //7:10 頃開始？園ごとに設定する
    //今日のキャパ空いてる且つWaitingがいる園

    
    //予約時刻が早い順番にIDとりだす
    //現在時刻から　start time end timeを設定しておく
    // startになったらメッセージ発火
    //返信きて　lineIDかつendtime以内なら　Reserved、次はいかない
    //返信きて　lineIDかつendtime外なら　エラーメッセージ
    //最後のendtimeになったら本日分のwaitingroutingを削除する 
    //waitinglist userid 
    //waitinglist -> waiting_starttime, waiting_endtime, lasttime
    //waiting_starttime line
    //wairing_endtime line 

    
    const sendWaitingUser = function(lineid){
      console.log("sendWaitingUser!!!!!")
      request.post(
        { headers: {'content-type' : 'application/json'},
        url: 'https://byojihoiku.chiikihoiku.net/webhook',
        body: JSON.stringify({
          "line_push_from_cron": "7amwaiting",
          "id": 'Ucd4cd000eb62d24fe5ff3b355f94d45b'
          })
        },
        function(error, response, body){
          console.log(response.statusCode)
          console.log(body)
          if(error){
            console.log('error@sendWaitingUser' + error)
          }
        }
      ); 
    };

    const waiting_lineid_table = 'waiting_lineid_table'
    const waiting_nuseryid_table = 'waiting_nurseryid_table'
    const waiting_current_capacity = 'waiting_current_capacity'
    const list = await psgl.getTodayWaitingRsvIDLineIDListSortByCreatedAt()
    let l = 1
    let waitinguser_nurseryid = []
    for (const user of list) {
      await redis.hsetStatus(waiting_lineid_table,l, user.lineid)
      await redis.hsetStatus(waiting_nuseryid_table,l,user.nurseryid) 
      waitinguser_nurseryid.push({nursereyid:user.nurseryid , redisuserid: l})
      l += 1
    }

    let today_capacity = await psgl.getAvailableNurseryOnToday()
    for (const nursery of today_capacity) {
      await redis.hgetStatus(waiting_current_capacity, nursery.id, nursery.capacity)
      for (let li = 0; li < Number(nursery.capacity); li++) {
        for (const user of waitinguser_nurseryid) {
          console.log(nursery.id == user.nursereyid)
          console.log(nursery.id, user.nursereyid)
          if(nursery.id == user.nursereyid){
            //Line発信後のCapacity
            let new_capacity = await redis.hgetStatus(waiting_current_capacity, nursery.id)
            if(new_capacity !=null && Number(new_capacity) <= 0){
              return
            }else{
              let lineid = await redis.hgetStatus(waiting_lineid_table, user.redisuserid)
              if(lineid != null){
                const fifteen_interval = setInterval(sendWaitingUser, 180000, lineid);//900000
                fifteen_interval
                let r = await redis.hDel(waiting_lineid_table, user.redisuserid)
                //if(r > 0) deleted
            }
            } //end if2
          }//end if 
        }// end for of waitinguser_nurseryid
      }//for of capa
    }
    /* Exit Job */
    /*clearInterval(fifteen_interval);
    await redis.resetAllStatus(waiting_lineid_table)
    await redis_client.hdel('update_time', waiting_lineid_table, (err, reply) => {
      if (err) throw err;
      console.log('REDIS DEL: update_time' + k + ' ,' + reply)
    })*/
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

