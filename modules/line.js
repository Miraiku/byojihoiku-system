const express = require('express');
const router = express.Router()
const https = require("https");
const psgl = require('./db_postgre')
const redis = require('./db_redis')
const Holidays = require('date-holidays');
const { is } = require('express/lib/request');
const TOKEN = process.env.LINE_ACCESS_TOKEN
const holiday = new Holidays('JP')
const today = new Date()
const dayaftertomorrow = today.setDate(today.getDate() + 2)

router
  .post('/', async (req, res) => {
    try {
      
      const text = req.body.events[0].message.text
      const userId = req.body.events[0].source.userId
      let dataString = null
      let replyMessage = null

      res.send("HTTP POST request sent to the webhook URL!")
      
      // ユーザーがボットにメッセージを送った場合、返信メッセージを送る
      if (req.body.events[0].type === "message") {
        //GET CURRENT STATUS
        let register_status = await redis.hgetStatus(userId,'register_status')
        let register_reply_status = await redis.hgetStatus(userId,'register_reply_status')
        let reservation_status = await redis.hgetStatus(userId,'reservation_status')
        let reservation_reply_status = await redis.hgetStatus(userId,'reservation_reply_status')

        if(text === "予約"){
          let registeredMessage
          if(await isRegisterd(userId)){
            registeredMessage = '病児保育の予約ですね。\n'+timenumberToDayJP(dayaftertomorrow)+getDayString(dayaftertomorrow)+'までの予約が可能です。\n予約の希望日を返信してください。\n例）2022年02月22日'
            await redis.hsetStatus(userId,'reservation_status',1)
            await redis.hsetStatus(userId,'reservation_reply_status',10)
          }else{
            registeredMessage = 'ご予約の前に会員登録をお願いいたします。\n会員登録をご希望の場合は「登録」と返信してください。'
          }holiday
          replyMessage = registeredMessage

        }else if(text === "登録"){
          //SET Status 1
          await redis.hsetStatus(userId,'register_status',1)
          //SET Reply Status 10
          await redis.hsetStatus(userId,'register_reply_status',10)

          replyMessage = "会員登録を開始します。\nお子様のお名前を全角カナで返信してください。\n例）西沢未来の場合「ニシザワミライ」"
        }else if(text === 'カレンダー'){
          dataString = JSON.stringify({
            replyToken: req.body.events[0].replyToken,
            messages: [
              {
                "type": "text",
                "text": "予約状況のカレンダーは以下のURLをご参照ください$\n https://sample.net",
                "emojis": [
                  {
                    "index": 25,
                    "productId": "5ac1bfd5040ab15980c9b435",
                    "emojiId": "012"
                  }
                ]
            }
            ]
          })
        }else if((register_status!=null || reservation_status!=null) && text==='中止'){
          await redis.resetAllStatus(userId)
          replyMessage = "手続きを中止しました。"
        }else if(register_status!=null){
          //ACTION
          switch (Number(register_status)) {
            //Name
            case 1:
              if(register_reply_status==10){
                let name = text.replace(/\s+/g, "")
                if(isZenkakuKana(name)){
                  replyMessage = "お子様のお名前は「"+name+"」さんですね。\n次に、お子様の生年月日を数字で返信してください。\n例）2020年1月30日生まれの場合、20210130と入力してください。"
                  //SET Name Value
                  await redis.hsetStatus(userId,'Name',name)
                  //SET Status 2
                  await redis.hsetStatus(userId,'register_status',2)
                  //SET Reply Status 20
                  await redis.hsetStatus(userId,'register_reply_status',20)
                }else{
                  replyMessage = "申し訳ございません。\nお子様のお名前を全角カナで返信してください。\n例）西沢未来の場合「ニシザワミライ」\n\n手続きを中止する場合は「中止」と返信してください。"
                }// close ZenkakuKana
              }
            break;//CASE1
            //BirthDay
            case 2:
              if(isValidDate(text)){
                replyMessage = "お子様の誕生日は「"+DayToJP(text)+"」ですね。\n次に、お子様のアレルギーの有無を返信してください。\n例）有りの場合「あり」、無しの場合「なし」"
                //SET Name Value
                await redis.hsetStatus(userId,'BirthDay',text)
                //SET Status 3
                await redis.hsetStatus(userId,'register_status',3)
                //SET Reply Status 30
                await redis.hsetStatus(userId,'register_reply_status',30,)
              }else{
                replyMessage = "申し訳ございません。\nお子様の生年月日を数字で返信してください。\n例）2020年1月30日生まれの場合、20210130と返信してください。\n\n手続きを中止する場合は「中止」と返信してください。"
              }
              break;//CASE2
            //Allergy
            case 3:
              if(hasAllergyValidation(text)){
                //SET Name Value
                await redis.hsetStatus(userId,'Allergy',text)
                //SET Status 4
                await redis.hsetStatus(userId,'register_status',4)
                //SET Reply Status 40
                await redis.hsetStatus(userId,'register_reply_status',40)
                //Get all information
                regsiter_informations = await redis.hgetAll(userId)
                let all_info = ''
                Object.entries(regsiter_informations).forEach(([k, v]) => { // ★
                    console.log({k, v});
                    if(k=='Name'){
                      all_info += "お名前："+v+"\n"
                    }else if(k=='BirthDay'){
                      all_info += "お誕生日："+DayToJP(v)+"\n"
                    }else if(k=='Allergy'){
                      all_info += "アレルギー："+v+"\n"
                    }
                });
                replyMessage = "お子様のアレルギーは「"+text+"」ですね。\n\n以下の内容で会員情報をします。\nよろしければ「はい」を返信してください。\n登録を中止する場合は「いいえ」を返信してください。\n\n"+all_info
                break;
              }else{
                replyMessage = "申し訳ございません。\n再度、お子様のアレルギーの有無を返信してください。\n例）ありの場合「あり」、なしの場合「なし」\n\n手続きを中止する場合は「中止」と返信してください。"
                break;
              };//CASE3
            case 4:
              if(yesOrNo(text)){
                if(text==='はい'){
                  try {
                    const result = await psgl.sqlToPostgre(queryString)
                    console.log(result);
                  } catch (err) {
                    console.error(err);
                  }
                  await redis.resetAllStatus(userId)
                  replyMessage = "会員登録を完了しました。\n続けてご兄妹を登録する場合は「登録」と返信してください。"
                  break;
                }else if(text=='いいえ'){
                  await redis.resetAllStatus(userId)
                  replyMessage = "会員登録を中止しました。"
                }
                break;
              }else{
                replyMessage =  "登録を完了する場合は「はい」を返信してください。\n登録を中止する場合は「いいえ」を返信してください。"
                break;
              };
            break;//CASE4
            default:
              console.log('Nothing to do in switch ') 
            break;
          }// end of switch
        }else if(reservation_status!=null){
          //ACTION
          switch (Number(reservation_status)) {
            //Name
            case 1:
              if(reservation_reply_status==10){
                if(isValidRegisterdDay(text)){
                  //TODO: 祝日DBから長期休暇の判定を追加する。DB側ではやらない。
                  //TODO：　定員はredis＆posgleの足し算で換算する（同時予約でブッキングしないように）
                  //TODO: りよう園→枠確認→予約orキャンセル待ちとうろく
                  let nursery_list = await psgl.getNurseryID_Name_Capacity()
                  //let avairable_nerseries = await psgl.getAvailableNurseryOnThatDay(getTimeStampDayFrom8Number(text))
                  let all_info = ''
                  console.log(nursery_list)
                  Object.entries(nursery_list).forEach(([k, v]) => {
                    if(k=='id'){
                      all_info += v+". "
                    }else if(k=='name'){
                      all_info += v+"\n"
                    }
                  });
                  //TODO: 曜日がおかしい
                  replyMessage = "希望日は「"+DayToJP(text)+getDayString(text)+"」ですね。\n希望利用の園を以下から選択してください。\n"+all_info
                  //redis.hsetStatus(userId,'reservation_date',text)
                  //redis.hsetStatus(userId,'reservation_status',2)
                  //redis.hsetStatus(userId,'reservation_reply_status',20)
                }else{
                  replyMessage = "申し訳ございません。希望日は休園日または予約の対象外です。\n\n"+timenumberToDayJP(dayaftertomorrow)+getDayString(dayaftertomorrow)+"までの予約が可能です。\n例）2022年02月22日に予約したい場合「20220222」と返信してください。\n\n手続きを中止する場合は「中止」と返信してください。"
                }
              }
            break;//Number of kids
            case 2:
              if(isValidNum(text)){
                if(isRegisterdByNameAndBirthDay(name,text)){
                  replyMessage = "お子様の誕生日は「"+DayToJP(text)+"」ですね。\n次に、お子様のアレルギーの有無を返信してください。\n例）有りの場合「あり」、無しの場合「なし」"
                  //SET Name Value
                  await redis.hsetStatus(userId,'BirthDay')
                  //SET Status 3
                  await redis.hsetStatus(userId,'register_status',3)
                  //SET Reply Status 30
                  await redis.hsetStatus(userId,'register_reply_status',30)
                }else{//isRegisterdByNameAndBirthDay()

                }
              }else{//isValidDate()
                replyMessage = "申し訳ございません。\nご利用希望日は満員です。お子様の生年月日を数字で返信してください。\n例）2020年1月30日生まれの場合、20210130と返信してください。\n\n手続きを中止する場合は「中止」と返信してください。"
              }
              break;//CASE2
            //Allergy
            case 3:
              if(hasAllergyValidation(text)){
                //SET Name Value
                await redis.hsetStatus(userId,'Allergy',text)
                //SET Status 4
                await redis.hsetStatus(userId,'register_status',4)
                //SET Reply Status 40
                await redis.hsetStatus(userId,'register_reply_status',40)
                //Get all information
                regsiter_informations = await redis.hgetAll(userId)
                let all_info = ''
                Object.entries(regsiter_informations).forEach(([k, v]) => { // ★
                    console.log({k, v});
                    if(k=='Name'){
                      all_info += "お名前："+v+"\n"
                    }else if(k=='BirthDay'){
                      all_info += "お誕生日："+DayToJp(v)+"\n"
                    }else if(k=='Allergy'){
                      all_info += "アレルギー："+v+"\n"
                    }
                });

                replyMessage = "お子様のアレルギーは「"+text+"」ですね。\n\n以下の内容で会員情報をします。\nよろしければ「はい」を返信してください。\n登録を中止する場合は「いいえ」を返信してください。\n\n"+all_info
                break;
              }else{
                replyMessage = "申し訳ございません。\n再度、お子様のアレルギーの有無を返信してください。\n例）ありの場合「あり」、なしの場合「なし」\n\n手続きを中止する場合は「中止」と返信してください。"
                break;
              };//CASE3
            case 4:
              if(yesOrNo(text)){
                if(text==='はい'){
                  try {
                    //Get all information
                    let info = await redis.hgetAll(id)
                    let queryString = `INSERT INTO public."Member" ("LINEID","BirthDay","Name","Allergy") VALUES(
                    '`+userId+`', '`+info['BirthDay']+`', '`+info['Name']+`', '`+convertAllergyBoolean(info['Allergy'])+`')`;                   
                    const result = await psgl.sqlToPostgre(queryString)
                    console.log(result);
                    
                    await redis.resetAllStatus(userId)
                  } catch (err) {
                    console.error(err);
                  }
                  replyMessage = "会員登録を完了しました。\n続けてご兄妹を登録する場合は「登録」と返信してください。"
                  break;
                }else if(text=='いいえ'){
                  await redis.resetAllStatus(userId)
                  replyMessage = "会員登録を中止しました。"
                }
                break;
              }else{
                replyMessage = "登録を完了する場合は「はい」を返信してください。\n登録を中止する場合は「いいえ」を返信してください。"
                break;
              };
            break;//CASE4
            default:
              console.log('Nothing to do in switch ') 
            break;
          }// end of switch
        }else{
          //通常Message
          replyMessage = "こんにちは！みらいくの病児保育予約システムです。\n▶予約の開始は「予約」\n▶予約内容の確認は「予約確認」\n▶各園の予約状況を確認は「カレンダー」\n▶会員登録は「登録」\nと返信してください。"
        }// end default message reply

    
        // リクエストヘッダー
        const headers = {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + TOKEN
        }
    
        if(dataString == null && replyMessage != null){
          dataString = JSON.stringify({
            replyToken: req.body.events[0].replyToken,
            messages: [
              {
                "type": "text",
                "text": replyMessage
              }
            ]
          })
        }else if(dataString == null && replyMessage == null){
          replyMessage = '申し訳ございません。予期せぬエラーが発生しました。お手数ですが、はじめからやり直してください。'
          dataString = JSON.stringify({
            replyToken: req.body.events[0].replyToken,
            messages: [
              {
                "type": "text",
                "text": replyMessage
              }
            ]
          })
          await redis.resetAllStatus(userId)
        }

        // リクエストに渡すオプション
        const webhookOptions = {
          "hostname": "api.line.me",
          "path": "/v2/bot/message/reply",
          "method": "POST",
          "headers": headers,
          "body": dataString
        }
    
        // リクエストの定義
        const request = https.request(webhookOptions, (res) => {
          res.on("data", (d) => {
            process.stdout.write(d)
          })
        })
    
        // エラーをハンドル
        request.on("error", (err) => {
          console.error(err)
        })
    
        // データを送信
        request.write(dataString)
        request.end()
      }
    } catch (err) {
        console.error(err);
    }
  })


function isZenkakuKana(s) {
  return !!s.match(/^[ァ-ヶー　]*$/);  // 「　」は全角スペース
}

function isValidDate(s){
  if(s.match(/^[0-9]+$/) && s.length == 8 && Number(s.substr( 0, 4 )) > 1900 && Number(s.substr( 4, 2 )) <= 12 && Number(s.substr( 6, 2 )) <=31 ){
    return true
  }else{
    return false
  }
}

function hankaku2Zenkaku(s) {
  return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
      return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  });
}

function isValidNum(s){
  if(Number(s) == NaN){
    if(Number(hankaku2Zenkaku(s)) == NaN){
      return false
    }else{
      return true
    }
  }{
    return true
  }
}


function getTimeStampDayFrom8Number(s){
  //20221122 -> 2022-11-22
  if(isValidDate(s)){
    return Number(s.substr( 0, 4 ))+'-'+Number(s.substr( 4, 2 ))+'-'+Number(s.substr( 6, 2 ))
  }else{
    return s
  } 
}

function DayToJP(s){
  if(isValidDate(s)){
    return Number(s.substr( 0, 4 ))+'年'+Number(s.substr( 4, 2 ))+'月'+Number(s.substr( 6, 2 ))+'日'
  }else{
    return s
  }
}
function getYear(s){
  if(isValidDate(s)){
    return Number(s.substr( 0, 4 ))
  }else{
    return s
  }
}

function getMonth(s){
  if(isValidDate(s)){
    return Number(s.substr( 4, 2 ))
  }else{
    return s
  }
}

function getDay(s){
  if(isValidDate(s)){
    return Number(s.substr( 6, 2 ))
  }else{
    return s
  }
}

function getDayString(s){
  //(月)などを返す
  let day = new Date(s)
  return '('+[ "日", "月", "火", "水", "木", "金", "土" ][day.getDay()]+')'
}

function timenumberToDayJP(s){
  //秒数から○年○月○日と表記
  let day = new Date(s)
  return DayToJP(String(day.getFullYear())+String((day.getMonth() + 1))+String(day.getDate()))
}

function isValidRegisterdDay(s){
  if(isValidDate(s)){
    let reservationday = new Date(getYear(s), Number(getMonth(s)-1), getDay(s)).setHours(0,0,0,0)//月のみ0インデックス, 秒で出力
    let reservationday_formatted = new Date(reservationday)//月のみ0インデックス, 秒で出力
    let today = new Date().setHours(0,0,0,0)//時間は考慮しない
    let dayaftertomorrow = new Date(today)
    dayaftertomorrow.setDate(dayaftertomorrow.getDate() + 2)
    dayaftertomorrow.setHours(0,0,0,0)
    const d = new Date();
    if(holiday.isHoliday(reservationday) || reservationday_formatted.getDay() == 0 ||  reservationday_formatted.getDay() == 6){
      return false
    }else if(reservationday > dayaftertomorrow){
      return false
    }else if(reservationday < today){
      return false
    }else if(reservationday >= today && reservationday <= dayaftertomorrow){
      return true
    }
  }else{
    return false
  }
}

function hasAllergyValidation(s){
  if(s === 'あり' || s === 'なし'){
    return true
  }else{
    return false
  }
}

function convertAllergyBoolean(s){
  if(s === 'あり'){
    return 'true'
  }else if(s === 'なし'){
    return 'false'
  }else{
    return 'false'
  }
}


function yesOrNo(s){
  if(s === 'はい' || s === 'いいえ'){
    return true
  }else{
    return false
  }
}

async function isRegisterd(id){
  try {
    let queryString = `SELECT * FROM public."Member" WHERE "LINEID" = '`+id+`';`;
    const results = await psgl.sqlToPostgre(queryString)
    if(Object.keys(results).length == 0){
      return false
    }else{
      return true
    }
  }
  catch (err) {
    console.log(`PSGL ERR: ${err}`)
  }
}

async function isRegisterdByNameAndBirthDay(name,birthday){
  try {
    let queryString = `SELECT * FROM public."Member" WHERE "Name" = '`+name+`' and "BirthDay" = '`+birthday+`;`
    const results = await psgl.sqlToPostgre(queryString)
    console.log(results);
    if(Object.keys(results).length == 0){
      return false
    }else{
      return true
    }
  }
  catch (err) {
    console.log(`PSGL ERR: ${err}`)
  }
}


module.exports = router