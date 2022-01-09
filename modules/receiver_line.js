const express = require('express');
const router = express.Router()
const https = require("https");
const psgl = require('./db_postgre')
const redis = require('./db_redis')
const Holidays = require('date-holidays');
const { is } = require('express/lib/request');
const request = require('request');
const TOKEN = process.env.LINE_ACCESS_TOKEN

router
  .post('/', async (req, res) => {
    const JST = new Date().toLocaleString({ timeZone: 'Asia/Tokyo' })
    const today = new Date(JST)
    const dayaftertomorrow = new Date(today);
    dayaftertomorrow.setDate(dayaftertomorrow.getDate() + 2);
    /*
    応答Message
    */
    try {
      const text = req.body.events[0].message.text
      const userId = req.body.events[0].source.userId
      let dataString = null
      let replyMessage = null
      let current_child_number = null

      res.send("HTTP POST request sent to the webhook URL!")
      
      // ユーザーがボットにメッセージを送った場合、返信メッセージを送る
      if (req.body.events[0].type === "message") {
        //GET CURRENT STATUS
        let register_status = await redis.hgetStatus(userId,'register_status')
        let register_reply_status = await redis.hgetStatus(userId,'register_reply_status')
        let reservation_status = await redis.hgetStatus(userId,'reservation_status')
        let reservation_reply_status = await redis.hgetStatus(userId,'reservation_reply_status')

        if(text === "予約"){
          await redis.resetAllStatus(userId)
          let registeredMessage
          if(await isAvailableReservation(userId)){
            registeredMessage = '病児保育の利用予約ですね。\n\n'+timenumberToDayJP(dayaftertomorrow)+getDayString(dayaftertomorrow)+'までの予約が可能です。\n\n利用の希望日を返信してください。\n例）2022年02月22日の場合は「20220222」\n\nまだ、お子様のアカウント登録が済んでいない方は「登録」と返信してください。'
            await redis.hsetStatus(userId,'reservation_status',1)
            await redis.hsetStatus(userId,'reservation_reply_status',10)
          }else if(await isRegisterd(userId)){
            registeredMessage = '管理者による会員情報の確認中です。\nもう少し待ってからご予約をお願いいたします。\nお急ぎの方はみらいくまで直接お問い合わせください。\n※こちらのLINEは応答専用です。ご質問いただいてもお返事することができません。'
          }else{
            registeredMessage = 'ご予約の前にアカウント登録をお願いいたします。\nアカウント登録をご希望の場合は「登録」と返信してください。'
          }
          replyMessage = registeredMessage

        }else if(text === "予約確認"){
          try {
            //[{},{}]
            replyMessage ='【ご予約状況】\n'
            let memberids = await psgl.getMemberIDByLINEID(userId)
            for (const member of memberids) {
              let complete_reservations = await psgl.getReservationStatusReservedByMemberIDGraterThanToday(member.ID)
              if(complete_reservations != null){
                for (const rsv of complete_reservations) {
                  let reservations_details = await psgl.getReservationDetailsByReservationID(rsv.ID)
                  for (const details of reservations_details) {
                    let c = await getJpValueFromPsglIds(details)
                    if(details.Cramps == 'false'){
                      details.Cramps = 'なし'
                    }
                    if(details.Allergy == 'false'){
                      details.Allergy = 'なし'
                    }
                    if(details.MealDetails == 'false'){
                      details.MealDetails = 'なし'
                    }
                    replyMessage += "\nご予約日："+DayToJPFromDateObj(new Date(details.ReservationDate))+"\n"
                    replyMessage += "利用時間："+getTimeJPFormattedFromDayDataObj(details.InTime)+"〜"+getTimeJPFormattedFromDayDataObj(details.OutTime)+"\n"
                    replyMessage += "第１希望："+c[0].firstNursery+"\n"
                    replyMessage += "第２希望："+c[0].secondNursery+"\n"
                    replyMessage += "第３希望："+c[0].thirdNursery+"\n"
                    replyMessage += "お子様氏名："+c[0].MemberID+"\n"
                    replyMessage += "病名："+c[0].DiseaseID+"\n"
                    replyMessage += "食事："+c[0].MealType+"\n"
                    replyMessage += "食事の注意事項："+details.MealDetails+"\n"
                    replyMessage += "熱性けいれん："+details.Cramps+"\n"
                    replyMessage += "食物アレルギー："+details.Allergy+"\n"
                    replyMessage += "保護者氏名："+details.ParentName+"\n"
                    replyMessage += "保護者連絡先："+details.ParentTel+"\n"
                  }
                }//end complete_reservations
              }//end if null
            }//end memberids normal
            for (const member of memberids) {
              let waiting_reservations = await psgl.getReservationStatusUnreadAndWaitingByMemberIDGraterThanToday(member.ID)
              if(waiting_reservations.length != 0){
                for (const rsv of waiting_reservations) {
                  let reservations_details = await psgl.getReservationDetailsByReservationID(rsv.ID)            
                  for (const details of reservations_details) {
                    let c = await getJpValueFromPsglIds(details)
                    if(details.Cramps == 'false'){
                      details.Cramps = 'なし'
                    }
                    if(details.Allergy == 'false'){
                      details.Allergy = 'なし'
                    }
                    if(details.MealDetails == 'false'){
                      details.MealDetails = 'なし'
                    }
                    replyMessage += "\nキャンセル待ち利用希望日："+DayToJPFromDateObj(new Date(details.ReservationDate))+"\n"
                    replyMessage += "利用時間："+getTimeJPFormattedFromDayDataObj(details.InTime)+"〜"+getTimeJPFormattedFromDayDataObj(details.OutTime)+"\n"
                    replyMessage += "第１希望："+c[0].firstNursery+"\n"
                    replyMessage += "第２希望："+c[0].secondNursery+"\n"
                    replyMessage += "第３希望："+c[0].thirdNursery+"\n"
                    replyMessage += "お子様氏名："+c[0].MemberID+"\n"
                    replyMessage += "病名："+c[0].DiseaseID+"\n"
                    replyMessage += "食事："+c[0].MealType+"\n"
                    replyMessage += "食事の注意事項："+details.MealDetails+"\n"
                    replyMessage += "熱性けいれん："+details.Cramps+"\n"
                    replyMessage += "食物アレルギー："+details.Allergy+"\n"
                    replyMessage += "保護者氏名："+details.ParentName+"\n"
                    replyMessage += "保護者連絡先："+details.ParentTel+"\n"
                  }
                }//end waiting_reservations
              }//end if null
            }//end memberids waiting
            for (const member of memberids) {
              let cancelled_reservations = await psgl.getReservationStatusCancelledByMemberIDGraterThanToday(member.ID)
              if(cancelled_reservations.length != 0){
                for (const rsv of cancelled_reservations) {
                  let reservations_details = await psgl.getReservationDetailsByReservationID(rsv.ID)            
                  for (const details of reservations_details) {
                    let c = await getJpValueFromPsglIds(details)
                    if(details.Cramps == 'false'){
                      details.Cramps = 'なし'
                    }
                    if(details.Allergy == 'false'){
                      details.Allergy = 'なし'
                    }
                    if(details.MealDetails == 'false'){
                      details.MealDetails = 'なし'
                    }
                    replyMessage += "\nキャンセル済みのご予約："+DayToJPFromDateObj(new Date(details.ReservationDate))+"\n"
                    replyMessage += "利用時間："+getTimeJPFormattedFromDayDataObj(details.InTime)+"〜"+getTimeJPFormattedFromDayDataObj(details.OutTime)+"\n"
                    replyMessage += "第１希望："+c[0].firstNursery+"\n"
                    replyMessage += "第２希望："+c[0].secondNursery+"\n"
                    replyMessage += "第３希望："+c[0].thirdNursery+"\n"
                    replyMessage += "お子様氏名："+c[0].MemberID+"\n"
                    replyMessage += "病名："+c[0].DiseaseID+"\n"
                    replyMessage += "食事："+c[0].MealType+"\n"
                    replyMessage += "食事の注意事項："+details.MealDetails+"\n"
                    replyMessage += "熱性けいれん："+details.Cramps+"\n"
                    replyMessage += "食物アレルギー："+details.Allergy+"\n"
                    replyMessage += "保護者氏名："+details.ParentName+"\n"
                    replyMessage += "保護者連絡先："+details.ParentTel+"\n"
                  }
                }//end cancelled_reservations
              }//end if null
            }//end memberids cancelled
          } catch (error) {
            console.log("予約確認： " +error)
          }
          if(replyMessage=='【ご予約状況】\n'){
            replyMessage = "現在、予約はございません。"
          }
        }else if(text === "テスト"){
          replyMessage = "\n今日: " +today
          replyMessage += "\n今日日付: " +today.getDate()
          replyMessage += "\n今日曜日: " + DayToJPFromDateObj(today)
          replyMessage += "\n明後日: " +dayaftertomorrow
          replyMessage += "\n明後日日付: " +timenumberToDayJP(dayaftertomorrow)+getDayString(dayaftertomorrow)
        }else if(text === "来園"){
          try {
            replyMessage = ''
            let success_replyMessage = "明日のご来園を承りました。\n気をつけてお越しください。"+"\n予約内容を確認する場合は「予約確認」と返信してください。"
            let cancel_replyMessage = "ご予約はキャンセルされております。"+"\n予約内容を確認する場合は「予約確認」と返信してください。"
            let replied_replyMessage = "明日のご来園を承っております。\n気をつけてお越しください。"+"\n予約内容を確認する場合は「予約確認」と返信してください。"
            if(new Date().getHours() >= 20 && new Date().getHours() < 24){//20-24:00 change tomorrow
              let reminderstatus = await psgl.getTomorrowReminderStatusByLINEID(userId)
              for (const s of reminderstatus) {
                if(s[0] == undefined || replyMessage != ''){
                  continue
                }
                if(s[0].Reminder == 'waiting'){
                  await psgl.updateTomorrowReservedReminderStatusByLineID(userId, 'replied')
                  replyMessage = success_replyMessage
                }else if(s[0].Reminder == 'cancelled'){
                  replyMessage = cancel_replyMessage
                }else if(s[0].Reminder == 'replied'){
                  replyMessage = replied_replyMessage
                }
              }
              await psgl.updateTomorrowReservedReminderStatusByLineID(userId, 'replied')
            }else if(new Date().getHours() >= 0 && new Date().getHours() < 7){//0:00-6:59 change today
              let reminderstatus = await psgl.getTodayReminderStatusByLINEID(userId)
              for (const s of reminderstatus) {
                if(s[0] == undefined || replyMessage != ''){
                  continue
                }
                if(s[0].Reminder == 'waiting'){
                  await psgl.updateTodayReservedReminderStatusByLineID(userId, 'replied')
                  replyMessage = success_replyMessage
                }else if(s[0].Reminder == 'cancelled'){
                  replyMessage = cancel_replyMessage
                }else if(s[0].Reminder == 'replied'){
                  replyMessage = replied_replyMessage
                }
              }
              await psgl.updateTodayReservedReminderStatusByLineID(userId, 'replied')
            }
          } catch (error) {
            console.log('来園: '+error)
          }
          //else
          if(replyMessage == ''){
            replyMessage = "直前のご予約はございません。\n予約内容を確認する場合は「予約確認」と返信してください。"
          }

        }else if(text === "空き登録"){
          try {
            replyMessage = ''

            const today_capacity = await psgl.getAvailableNurseryOnToday()
            for (const n of today_capacity) {
              let current_waiting_lineid = await redis.hgetStatus('waiting_current_lineid_bynurseryid',n.id)
              if(current_waiting_lineid == userId){
                let updated = await psgl.updateTodayWaitingUserToReservedUserByLineID(userId)
                let current_capa = await redis.hgetStatus('waiting_current_capacity',n.id)
                if(updated)
                if(updated !=null){
                  await redis.hsetStatus('waiting_current_capacity', n.id, Number(current_capa)-1)
                  replyMessage = '予約が確定しました。\nお気をつけてお越しくださいませ。'
                }else{
                  replyMessage = '申し訳ありません、予約確定ができませんでした。お手数ですがみらいくまで直接お電話でお問い合わせくださいませ。'
                }
                break
              }else{
                replyMessage = '本日ご利用いただける予約枠はございません。'
              }
            }

          } catch (error) {
            console.log('空き登録: '+error)
            replyMessage = '予約確定ができませんでした。お手数ですがみらいくまで直接お電話でお問い合わせくださいませ。'
          }
        }else if(text === "戻る"){
          const action_prev = function (){
            request.post(
              { headers: {'content-type' : 'application/json'},
                url: 'https://byojihoiku.chiikihoiku.net/webhook',
                body: JSON.stringify({
                  events:[
                    {
                      replyToken: req.body.events[0].replyToken,
                      type: 'message',
                      message: {
                        'text': 'prevaction',
                      },
                      source: {
                        'userId': userId
                      }
                    }
                ]})
              },
              function(error, response, body){
                if(error){
                  console.log('error@戻る' + error)
                }
                if(response.statusCode == 200){
                  return true
                }else{
                  return false
                }
              }); 
          }
          replyMessage = ''
          replyMessageErr =  'エラーが発生しました。恐れ入りますが、「登録」または「予約」と返信して始めからやり直してください。'
          try {
            if(register_status==null && reservation_status==null){
              replyMessage = '進行中のお手続きはございません。'
            }else if(register_status!=null &&  reservation_status!=null){
              replyMessage = '複数の手続きが進行しています。「登録」または「予約」と返信して始めからやり直してください。'
            }else if(register_status!=null && reservation_status==null){//登録
              if(Number(register_status) <= 1){
                await redis.hsetStatus(userId,'register_status',1)
                await redis.hsetStatus(userId,'register_reply_status',10)
              }else{
              let new_register_status = Number(register_status) - 1
              let new_register_reply_status = Number(register_reply_status) - 10
              await redis.hsetStatus(userId,'register_status',new_register_status)
              await redis.hsetStatus(userId,'register_reply_status',new_register_reply_status)
              }
              let post_action = action_prev()
              console.log(post_action)
              if(!post_action){
                replyMessage = replyMessageErr
              }else{
                return
              }
            }else if(reservation_status!=null && register_status==null){//予約
              if(reservation_status == 70){//複数人例外用
                await redis.hsetStatus(userId,'reservation_status',13)
                await redis.hsetStatus(userId,'reservation_reply_status',130)
              }else if(Number(reservation_status) <= 1){
                await redis.hsetStatus(userId,'reservation_status',1)
                await redis.hsetStatus(userId,'reservation_reply_status',10)
              }else{
                let new_reservation_status = Number(reservation_status) - 1
                let new_reservation_reply_status = Number(reservation_reply_status) - 10
                await redis.hsetStatus(userId,'reservation_status',new_reservation_status)
                await redis.hsetStatus(userId,'reservation_reply_status',new_reservation_reply_status)
              }
              let post_action = action_prev()
              console.log(post_action)
              if(!post_action){
                replyMessage = replyMessageErr
              }else{
                return
              }
            }
            if(replyMessage = ''){
              replyMessage = replyMessageErr
            }
          } catch (error) {
            console.log('戻る: '+error)
            replyMessage = replyMessageErr
          }
        }else if(text === "登録"){
          await redis.resetAllStatus(userId)
          //SET Status 1
          await redis.hsetStatus(userId,'register_status',1)
          //SET Reply Status 10
          await redis.hsetStatus(userId,'register_reply_status',10)
          replyMessage = "アカウント登録を開始します。\nお子様のお名前を全角カナで返信してください。\n例）西沢未来の場合「ニシザワミライ」"
        }else if(text === '空き状況'){
          dataString = JSON.stringify({
            replyToken: req.body.events[0].replyToken,
            messages: [
              {
                "type": "text",
                "text": "予約状況の空き状況は以下のURLをご参照ください。\n https://byojihoiku.chiikihoiku.net/calendar/",
            }
            ]
          })
        }else if((register_status!=null || reservation_status!=null) && text==='中止'){
          await redis.resetAllStatus(userId)
          replyMessage = "手続きを中止しました。"
        }else if(register_status!=null){
          //ACTION
          let optionmsg = '\n\n・入力し直す場合は「戻る」\n・登録を中止する場合は「中止」\n・はじめからやり直す場合は「登録」\nと返信してください。'
          switch (Number(register_status)) {
            //Name
            case 1:
              if(register_reply_status==10){
                let name = text.replace(/\s+/g, "")
                if(isZenkakuKana(name)){
                  replyMessage = "お子様のお名前は「"+name+"」さんですね。\n\n次に、お子様の生年月日を数字で返信してください。\n例）2020年1月30日生まれの場合、20210130と入力してください。"
                  //SET Name Value
                  await redis.hsetStatus(userId,'Name',name)
                  //SET Status 2
                  await redis.hsetStatus(userId,'register_status',2)
                  //SET Reply Status 20
                  await redis.hsetStatus(userId,'register_reply_status',20)
                }else{
                  replyMessage = "お子様のお名前を全角カナで返信してください。\n例）西沢未来の場合「ニシザワミライ」"+optionmsg
                }// close ZenkakuKana
              }
            break;//CASE1
            //BirthDay
            case 2:
              if(isValidDate(text)){
                replyMessage = "お子様の誕生日は「"+DayToJP(text)+"」ですね。\n\n次に、お子様の食物アレルギーの有無を返信してください。\n例）有りの場合「あり」、無しの場合「なし」"
                //SET Name Value
                await redis.hsetStatus(userId,'BirthDay',text)
                //SET Status 3
                await redis.hsetStatus(userId,'register_status',3)
                //SET Reply Status 30
                await redis.hsetStatus(userId,'register_reply_status',30,)
              }else{
                replyMessage = "お子様の生年月日を数字で返信してください。\n例）2020年1月30日生まれの場合、20210130と返信してください。"+optionmsg
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
                      all_info += "食物アレルギー："+v+"\n"
                    }
                });
                replyMessage = "お子様の食物アレルギーは「"+text+"」ですね。\n\n以下の内容で会員情報をします。\nよろしければ「はい」を返信してください。\n登録を中止する場合は「いいえ」を返信してください。\n\n"+all_info
                break;
              }else{
                replyMessage = "お子様の食物アレルギーの有無を返信してください。\n例）ありの場合「あり」、なしの場合「なし」"+optionmsg
                break;
              };//CASE3
            case 4:
              if(yesOrNo(text)){
                if(text==='はい'){
                  try {
                    //Get all information
                    let info = await redis.hgetAll(userId)
                    let queryString = `INSERT INTO public."Member" ("LINEID","BirthDay","Name","Allergy","MiraikuID") VALUES(
                      '`+userId+`', '`+info['BirthDay']+`', '`+info['Name']+`', '`+convertAllergyBoolean(info['Allergy'])+`','0')`;
                    const result = await psgl.sqlToPostgre(queryString)
                    console.log(result);
                  } catch (err) {
                    console.error(err);
                  }
                  await redis.resetAllStatus(userId)
                  replyMessage = "アカウント登録を完了しました。\n続けてご兄妹を登録する場合は「登録」と返信してください。"
                  break;
                }else if(text=='いいえ'){
                  await redis.resetAllStatus(userId)
                  replyMessage = "アカウント登録を中止しました。"
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
          let optionmsg = '\n\n・入力し直す場合は「戻る」\n・登録を中止する場合は「中止」\n・はじめからやり直す場合は「予約」\nと返信してください。'
          switch (Number(reservation_status)) {
            //Day
            case 1:
              if(reservation_reply_status==10){
                if(isValidRegisterdDay(text, userId)){
                  if(!isBeforeToday8AM(text)){
                    replyMessage = "当日の予約受付は午前8時までです。\n当日予約の方はお電話でお問い合わせください。\n\n予約手続きを中止します。\n新しく予約をする場合は「予約」と返信してください。"
                    await redis.resetAllStatus(userId)
                  }else{
                    //TODO: 祝日DBから長期休暇の判定を追加する。DB側ではやらない。
                    //TODO：　定員はredis＆posgleの足し算で換算する（同時予約でブッキングしないように）
                    //りよう園→枠確認→予約orキャンセル待ちとうろく
                    let nursery_list = await psgl.getNurseryID_Name_Capacity()
                    let all_info = ''
                    for(let i = 0; i < nursery_list.length; i++)
                    {
                        all_info += "・"+nursery_list[i].name+"\n";
                    }
                    replyMessage = "希望日は「"+DayToJP(text)+getDayString(text)+"」ですね。\n\n利用したい病児保育室を以下から選択してください。\n\n"+all_info+"\n早苗町を希望の場合「早苗町」と返信してください。"
                    redis.hsetStatus(userId,'reservation_date',text)
                    redis.hsetStatus(userId,'reservation_status',2)
                    redis.hsetStatus(userId,'reservation_reply_status',20)
                  }
                }else{
                  replyMessage = timenumberToDayJP(dayaftertomorrow)+getDayString(dayaftertomorrow)+"までの予約が可能です。\n例）2022年02月22日に予約したい場合「20220222」と返信してください"
                }
              }
            break;
            case 2:
              if(reservation_reply_status==20){
                //第１園希望確認
                let cancel = await redis.hgetStatus(userId, 'reservation_status_cancel')
                if(cancel=='maybe' && (text == 'はい' || text=='キャンセル')){
                  await redis.hsetStatus(userId,'reservation_status_cancel','true')
                  replyMessage = "キャンセル待ち登録をする病児保育室を返信してください。\n早苗町を希望の場合「早苗町」"
                }else if(await isValidNurseryName(text)){
                  if(cancel == 'maybe'){//true以外は初期化
                    await redis.hsetStatus(userId,'reservation_status_cancel', '')
                  }
                  let nursery_capacity = await hasNurseryCapacity(text)
                  let nursery_id = await getNurseryIdByName(text)
                  let reservation_date = await redis.hgetStatus(userId,'reservation_date')
                  let reservation_num_on_day = await psgl.canNurseryReservationOnThatDay(getTimeStampDayFrom8Number(reservation_date), nursery_id[0].ID)
                  
                  let next_step = false
                  if(cancel == null){
                    if((Number(nursery_capacity[0].Capacity) - Number(reservation_num_on_day[0].count)) <= 0){
                      replyMessage = "ご利用希望日は満員です。\n\n・他の病児保育室名\n・キャンセル待ち登録をする場合は「はい」\n・始めからやり直す場合は「予約」\nを返信してください。"
                      await redis.hsetStatus(userId,'reservation_status_cancel','maybe')
                    }else{
                      replyMessage = "第1希望の病児保育室は「"+text+"」ですね。\n\n第2希望の病児保育室名を返信してください。\n希望がない場合は「なし」と返信してください。"
                      next_step = true
                    }
                  }else{
                    if(cancel == 'true'){
                      replyMessage = "キャンセル登録第1希望の病児保育室は「"+text+"」ですね。\n\n第2希望の病児保育室名を返信してください。\n希望がない場合は「なし」と返信してください。"
                      next_step = true
                    }else{
                      replyMessage = "第1希望の病児保育室は「"+text+"」ですね。\n\n第2希望の病児保育室名を返信してください。\n希望がない場合は「なし」と返信してください。"
                      next_step = true
                    }
                  }
                  if(next_step){
                    let opentime = await psgl.getNurseryOpenTimeFromName(text)
                    let closetime = await psgl.getNurseryCloseTimeFromName(text)
                    redis.hsetStatus(userId,'reservation_nursery_name_1',text)
                    redis.hsetStatus(userId,'reservation_nursery_id_1',nursery_id[0].ID)
                    redis.hsetStatus(userId,'reservation_nursery_opentime',TimeFormatFromDB(opentime[0].OpenTime))
                    redis.hsetStatus(userId,'reservation_nursery_closetime',TimeFormatFromDB(closetime[0].CloseTime))
                    redis.hsetStatus(userId,'reservation_status',3)
                    redis.hsetStatus(userId,'reservation_reply_status',30)
                  }
                }else{
                  replyMessage = "利用したい病児保育室を返信してください。\n例）早苗町を希望の場合「早苗町」と返信してください"
                }//isValidNursery
              }
              break;//CASE2
            case 3:
              //第2希望
              if(await isValidNurseryName(text) || text == 'なし'){
                  replyMessage = "第2希望の病児保育室は「"+text+"」ですね。\n\n第3希望の病児保育室名を返信してください。\n希望がない場合は「なし」と返信してください。"
                  let nursery_id = await getNurseryIdByName(text)
                  if( text == 'なし'){
                    await redis.hsetStatus(userId,'reservation_nursery_id_2',0)
                    await redis.hsetStatus(userId,'reservation_nursery_name_2','なし')
                  }else{
                    await redis.hsetStatus(userId,'reservation_nursery_id_2',nursery_id[0].ID)
                    await redis.hsetStatus(userId,'reservation_nursery_name_2',text)
                  }
                  redis.hsetStatus(userId,'reservation_status',4)
                  redis.hsetStatus(userId,'reservation_reply_status',40)
              }else{
                replyMessage = "利用したい病児保育室を返信してください。\n希望がない場合は「なし」と返信してください。"+optionmsg
              }//isValidNursery
              break;//CASE3
            case 4:
              //第3希望
              if(await isValidNurseryName(text) || text == 'なし'){
                let first_nursery = await redis.hgetStatus(userId, 'reservation_nursery_name_1')
                let open = await redis.hgetStatus(userId, 'reservation_nursery_opentime')
                let close = await redis.hgetStatus(userId, 'reservation_nursery_closetime')
                let nursery_id = await getNurseryIdByName(text)
                replyMessage = "第3希望の病児保育室は「"+text+"」ですね。\n\n登園時間を返信してください。\n例）9時に登園する場合は「0900」\n\n病児保育室の開所時間は、"+TimeToJP(open)+"〜"+TimeToJP(close)+"です。"
                if( text == 'なし'){
                  await redis.hsetStatus(userId,'reservation_nursery_id_3',0)
                  await redis.hsetStatus(userId,'reservation_nursery_name_3','なし')
                }else{
                  await redis.hsetStatus(userId,'reservation_nursery_id_3',nursery_id[0].ID)
                  await redis.hsetStatus(userId,'reservation_nursery_name_3',text)
                }
                redis.hsetStatus(userId,'reservation_status',5)
                redis.hsetStatus(userId,'reservation_reply_status',50)
              }else{
                replyMessage = "利用したい病児保育室を返信してください。\\n希望がない場合は「なし」と返信してください。"+optionmsg
              }//isValidNursery
              break;//CASE4
            case 5:
              if(isValidTime(text)&& await withinOpeningTime(userId, text)){
                replyMessage = "登園時間は「"+TimeToJP(text)+"」ですね。\n\n降園時間を返信してください。\n例）16時に退園する場合は「1600」"
                redis.hsetStatus(userId,'reservation_nursery_intime',text)
                redis.hsetStatus(userId,'reservation_status',6)
                redis.hsetStatus(userId,'reservation_reply_status',60)
              }else{
                replyMessage = "登園時間を返信してください。\n例）8時登園の場合は「0800」"+optionmsg
              }
              break;//CASE3
            case 6:
              if(isValidTime(text)&& await withinOpeningTime(userId, text)){
                replyMessage = "降園時間は「"+TimeToJP(text)+"」ですね。\n\n利用人数を返信してください。\n例）1人の場合は「1」、ご兄妹2人で利用される場合は「2」\n\n利用人数(兄妹)が3人以上の場合は、各病児保育室に直接お問い合わせください。\n手続きを中止する場合は「中止」、予約をやり直す場合は「予約」と返信してください。"
                redis.hsetStatus(userId,'reservation_nursery_outtime',text)
                redis.hsetStatus(userId,'reservation_status',7)
                redis.hsetStatus(userId,'reservation_reply_status',70)
              }else{
                replyMessage = "降園時間を返信してください。\n例）16時退園の場合は「1600」"+optionmsg
              }
              break;//CASE4
            case 7:
                if(isValidNum(text)){
                  let childnum = Number(text)
                  if(childnum > 2){
                    replyMessage = '利用人数(兄妹)が3人以上の場合は、各病児保育室に直接お問い合わせください。'+optionmsg
                  }else{
                    let nursery_capacity = await hasNurseryCapacity(await redis.hgetStatus(userId, 'reservation_nursery_name_1'))
                    let reservation_date = await redis.hgetStatus(userId,'reservation_date')
                    let reservation_num_on_day = await psgl.canNurseryReservationOnThatDay(getTimeStampDayFrom8Number(reservation_date), await redis.hgetStatus(userId, 'reservation_nursery_id_1'))
                    let new_amount = childnum + Number(reservation_num_on_day[0].count)
                    let cancel = await redis.hgetStatus(userId, 'reservation_status_cancel')
                    console.log(Number(nursery_capacity[0].Capacity))
                    console.log(new_amount)
                    if(Number(nursery_capacity[0].Capacity) < new_amount && cancel == null){
                      replyMessage = "ご利用希望日は満員です。\n他の病児保育室名を返信してください。\n\n・キャンセル待ち登録をする場合は「はい」\n・手続きを中止する場合は「中止」\n・予約をやり直す場合は「予約」\nと返信してください。"
                      await redis.hsetStatus(userId,'reservation_status_cancel','maybe')
                      await redis.hsetStatus(userId,'reservation_status',2)
                      await redis.hsetStatus(userId,'reservation_reply_status',20)
                      break;
                    }
                    replyMessage = "利用人数は「"+text+"人」ですね。\n\nお子様のお名前を全角カナで返信してください。\n例）西沢未来の場合「ニシザワミライ」"
                    await redis.hsetStatus(userId,'reservation_nursery_number',text)
                    await redis.hsetStatus(userId,'reservation_nursery_current_register_number',1)
                    await redis.hsetStatus(userId,'reservation_status',8)
                    await redis.hsetStatus(userId,'reservation_reply_status',80)
                  }
                }else{
                  replyMessage = "利用人数を返信してください。\n例）1人の場合は「1」、ご兄妹2人で利用される場合は「2」\n\n利用人数(兄妹)が3人以上の場合は、各病児保育室に直接お問い合わせください。"+optionmsg
                }
              break;//CASE7
            case 70://人数分ループ用IF
                current_child_number = await redis.hgetStatus(userId,'reservation_nursery_current_register_number')
                if(text=='なし'){
                  await redis.hsetStatus(userId,'reservation_child_allergy_caution_'+current_child_number,'false')
                }else{
                  await redis.hsetStatus(userId,'reservation_child_allergy_caution_'+current_child_number, text)
                }
                await redis.hsetStatus(userId,'reservation_status',8)
                await redis.hsetStatus(userId,'reservation_reply_status',80)
                let update_current_child_number = Number(current_child_number)+1
                await redis.hsetStatus(userId,'reservation_nursery_current_register_number',update_current_child_number)
                replyMessage = "食物アレルギーに関する連絡事項は「"+text+"」ですね。\n\n"+update_current_child_number+"人目の内容を登録します。\n\nお子様のお名前を全角カナで返信してください。\n例）西沢未来の場合「ニシザワミライ」"
              break;//CASE70
            case 8:
              let name = text.replace(/\s+/g, "")
              if(isZenkakuKana(name)){
                replyMessage = "お子様のお名前は「"+name+"」さんですね。\n\n次に、お子様の生年月日を数字で返信してください。\n例）2020年1月30日生まれの場合、20210130と入力してください。"
                //SET Name Value
                current_child_number = await redis.hgetStatus(userId,'reservation_nursery_current_register_number')
                await redis.hsetStatus(userId,'reservation_child_name_'+current_child_number,name)
                //SET Status 2
                await redis.hsetStatus(userId,'reservation_status',9)
                //SET Reply Status 20
                await redis.hsetStatus(userId,'reservation_reply_status',90)
              }else{
                replyMessage = "お子様のお名前を全角カナで返信してください。\n例）西沢未来の場合「ニシザワミライ」"+optionmsg
              }// close ZenkakuKana
              break;//CASE8
            case 9:
                if(isValidDate(text)){
                  let disease = await psgl.getDiseaseList()
                  let all_info = ''
                  for(let i = 0; i < disease.length; i++)
                  {
                      all_info += disease[i].id+". "+disease[i].name+"\n";
                  }
                  current_child_number = await redis.hgetStatus(userId,'reservation_nursery_current_register_number')
                  let name = await redis.hgetStatus(userId,'reservation_child_name_'+current_child_number)
                  if(await isMembered(userId, name, text)){
                    replyMessage = "お子様の誕生日は「"+DayToJP(text)+"」ですね。\n\n医師から診断された病名、『医師連絡票』に〇印が付いている病名を番号で返信してください。\n例）気管支炎の場合は「3」、インフルエンザAの場合は「6A」\n\n"+all_info
                    let member_id = await psgl.getMemberedIDFromNameAndBirthDay(userId, name, text)
                    await redis.hsetStatus(userId,'reservation_child_birthday_'+current_child_number,text)
                    await redis.hsetStatus(userId,'reservation_child_memberid_'+current_child_number,member_id[0].ID)
                    await redis.hsetStatus(userId,'reservation_status',10)
                    await redis.hsetStatus(userId,'reservation_reply_status',100)
                  }else{
                    replyMessage = "お子様の情報が登録されていません。\nもう一度お子様の名前を全角カナで返信していただくか、\n「登録」と返信してアカウント登録をしてください。\n"
                    await redis.hsetStatus(userId,'reservation_status',8)
                    await redis.hsetStatus(userId,'reservation_reply_status',80)
                  }
                }else{
                  replyMessage = "お子様の生年月日を数字で返信してください。\n例）2020年1月30日生まれの場合、20210130と返信してください。"+optionmsg
                }
                break;//CASE9  
            case 10:
              let diseaseid_text = zenkaku2Hankaku(text)
              if(await isValidDisease(diseaseid_text)){
                let meals = await psgl.getMealList()
                let all_info = ''
                for(let i = 0; i < meals.length; i++)
                {
                    all_info += meals[i].id+". "+meals[i].name+"\n";
                }
                current_child_number = await redis.hgetStatus(userId,'reservation_nursery_current_register_number')
                let disasename = await psgl.getDiseaseNameFromID(diseaseid_text)
                let disaseunique_id = await psgl.getUniqueIDFromDiseaseID(diseaseid_text)
                replyMessage = "お子様の病名は「"+disasename[0].DiseaseName+"」ですね。\n\n以下から、希望する食事内容を番号で返信してください。\n例）ミルクのみの場合は「2」\n\n"+all_info
                await redis.hsetStatus(userId,'reservation_child_disase_id_'+current_child_number,disaseunique_id[0].ID)
                await redis.hsetStatus(userId,'reservation_child_disase_name_'+current_child_number,disasename[0].DiseaseName)
                await redis.hsetStatus(userId,'reservation_status',11)
                await redis.hsetStatus(userId,'reservation_reply_status',110)
              }else{
                replyMessage = "医師から診断された病名、『医師連絡票』に〇印が付いている病名を番号で返信してください。\n例）気管支炎の場合は「3」、インフルエンザAの場合は「6A」"+optionmsg
              }
              break;
            case 11:
              let mealid_text = zenkaku2Hankaku(text)
              if(await isValidMeal(mealid_text)){
                let mealname = await psgl.getMealNameFromID(mealid_text)
                replyMessage = "希望の食事は「"+mealname[0].MealName+"」ですね。\n\n食事に関して追記事項がある場合、その内容を返信してください。\n追記事項がない場合は「なし」と返信してください。" 
                current_child_number = await redis.hgetStatus(userId,'reservation_nursery_current_register_number')
                await redis.hsetStatus(userId,'reservation_child_meal_name_'+current_child_number,mealname[0].MealName)
                await redis.hsetStatus(userId,'reservation_child_meal_id_'+current_child_number,mealid_text)
                await redis.hsetStatus(userId,'reservation_status',12)
                await redis.hsetStatus(userId,'reservation_reply_status',120)
              }else{
                replyMessage = "希望する食事内容を番号で返信してください。\n例）ミルクのみの場合は「2」\n\n手続きを中止する場合は「中止」、予約をやり直す場合は「予約」と返信してください。"
              }
              break;
            case 12:
              //TODO 例）入力内容を間違えてしまったときは「戻る」と返信すると、1つ前の項目に戻る…など？どんな解決方法があるのかわからないので、機能として追加していただきたいと思います。
              replyMessage = "食事の追記事項は「"+escapeHTML(text)+"」ですね。\n\n熱性けいれんの既往がある方は「回数、初回の年齢、最終の年齢」についてご返信ください。\nない場合は「なし」を返信してください。\n例）2回、初回1歳9ヶ月、最終2歳5ヶ月"
              current_child_number = await redis.hgetStatus(userId,'reservation_nursery_current_register_number')
              if(text=='なし'){
                await redis.hsetStatus(userId,'reservation_child_meal_caution_'+current_child_number,'false')
              }else{
                await redis.hsetStatus(userId,'reservation_child_meal_caution_'+current_child_number,escapeHTML(text))
              }
              await redis.hsetStatus(userId,'reservation_status',13)
              await redis.hsetStatus(userId,'reservation_reply_status',130)
              break;
            case 13:
              replyMessage = "熱性けいれんの既往歴「"+escapeHTML(text)+"」ですね。\n\n食物アレルギーに関する連絡事項がある場合、その内容を返信してください。\nない場合は「なし」を返信してください。"
              current_child_number = await redis.hgetStatus(userId,'reservation_nursery_current_register_number')
              if(text=='なし'){
                await redis.hsetStatus(userId,'reservation_child_cramps_caution_'+current_child_number,'false')
              }else{
                await redis.hsetStatus(userId,'reservation_child_cramps_caution_'+current_child_number,escapeHTML(text))
              }
              let total_child_number = await redis.hgetStatus(userId,'reservation_nursery_number')
              if(Number(current_child_number)>=Number(total_child_number)){
                //人数分情報を聞いたらcase13の登録へ
                await redis.hsetStatus(userId,'reservation_status',14)
                await redis.hsetStatus(userId,'reservation_reply_status',140)
              }else{
                //case 7-8のあいだ
                await redis.hsetStatus(userId,'reservation_status',70)
                await redis.hsetStatus(userId,'reservation_reply_status',700)
              }

              break;
            case 14:
              current_child_number = await redis.hgetStatus(userId,'reservation_nursery_current_register_number')
              replyMessage = "食物アレルギーに関する連絡事項は「"+escapeHTML(text)+"」ですね。\n\n保護者様のお名前を返信してください。\n例）西沢香里"
              if(text=='なし'){
                await redis.hsetStatus(userId,'reservation_child_allergy_caution_'+current_child_number,'false')
              }else{
                await redis.hsetStatus(userId,'reservation_child_allergy_caution_'+current_child_number,escapeHTML(text))
              }
              await redis.hsetStatus(userId,'reservation_status',15)
              await redis.hsetStatus(userId,'reservation_reply_status',150)
              break;
            case 15:
              replyMessage = "保護者さまのお名前は「"+escapeHTML(text)+"」ですね。\n\n保護者さまのお電話番号を記入してください。\n例）09012345678"
              await redis.hsetStatus(userId,'reservation_child_parent_name',escapeHTML(text))
              await redis.hsetStatus(userId,'reservation_status',16)
              await redis.hsetStatus(userId,'reservation_reply_status',160)
              break;
            case 16://Register
              try {
                await redis.hsetStatus(userId,'reservation_child_parent_tel',escapeHTML(text))
                await redis.hsetStatus(userId,'reservation_status',17)
                await redis.hsetStatus(userId,'reservation_reply_status',170)
                regsiter_informations = await redis.hgetAll(userId)
                let all_info = ''
                Object.entries(regsiter_informations).forEach(([k, v]) => {
                  if(k == 'reservation_date'){
                    all_info += "予約日："+DayToJP(v)+getDayString(v)+"\n"
                  }else if(k == 'reservation_nursery_name_1'){
                    all_info += "第1希望："+v+"\n"
                  }else if(k == 'reservation_nursery_name_2'){
                    all_info += "第2希望："+v+"\n"
                  }else if(k == 'reservation_nursery_name_3'){
                    all_info += "第3希望："+v+"\n"
                  }else if(k == 'reservation_nursery_intime'){
                    all_info += "登園時間："+TimeToJP(v)+"\n"
                  }else if(k == 'reservation_nursery_outtime'){
                    all_info += "登園時間："+TimeToJP(v)+"\n"
                  }else if(k == 'reservation_child_parent_name'){
                    all_info += "保護者氏名："+v+"\n"
                  }else if(k == 'reservation_child_parent_tel'){
                    all_info += "保護者連絡先："+v+"\n"
                  }
                });
                try {
                  let total = Number(regsiter_informations.reservation_nursery_number)
                  let childname = []
                  let birthday = []
                  let memberid = []
                  let disase_id = []
                  let meal_id = []
                  let meal_caution = []
                  let cramps_caution = []
                  let allergy_caution = []
                  Object.entries(regsiter_informations).forEach(([k, v]) => {
                    let i = k.slice(-1);
                    if(Number.isInteger(Number(i))){
                      i = Number(i)
                      if((k).includes('reservation_child_name_'+i)){
                        childname[i] = v
                      }else if((k).includes('reservation_child_birthday_'+i)){
                        birthday[i] = v
                      }else if((k).includes('reservation_child_memberid_'+i)){
                        memberid[i] = v
                      }else if((k).includes('reservation_child_disase_name_'+i)){
                        disase_id[i] = v
                      }else if((k).includes('reservation_child_meal_name_'+i)){
                        meal_id[i] = v
                      }else if((k).includes('reservation_child_meal_caution_'+i)){
                        meal_caution[i] = v
                      }else if((k).includes('reservation_child_cramps_caution_'+i)){
                        cramps_caution[i] = v
                      }else if((k).includes('reservation_child_allergy_caution_'+i)){
                        allergy_caution[i] = v
                      }
                    }
                  });
                  for (let i = 1; i <= total; i++) {
                    if(total > 1){
                      all_info += '\n★'+i+ "人目のお子様"
                    }
                    all_info +=  "\nお子様氏名："+childname[i]+"\n"
                    all_info +=  "病名："+disase_id[i]+"\n"
                    all_info +=  "食事："+meal_id[i]+"\n"
                    all_info +=  "食事の注意事項："+convertBooleanToJP(meal_caution[i])+"\n"
                    all_info +=  "熱性けいれんの注意事項："+convertBooleanToJP(cramps_caution[i])+"\n"
                    all_info +=  "食物アレルギーの注意事項："+convertBooleanToJP(allergy_caution[i])+"\n"
                  }
                  let cancel_status = await redis.hgetStatus(userId, 'reservation_status_cancel')
                  let reservation_status = ''
                  if(cancel_status == 'true'){
                    reservation_status = 'キャンセル待ち登録'
                  }else{
                    reservation_status = '予約'
                  }
                  replyMessage = "保護者様の電話番号は「"+text+"」ですね。\n\n以下の内容で"+reservation_status+"をします。\n\n"+all_info+"\n\n・上記の内容でよろしければ「はい」\n・予約しない場合は「いいえ」\nと返信してください。"
                } catch (error) {
                  console.log(`Reservation ERR: ${error}`)
                }
              } catch (error) {
                console.log(`Reservation ERR: ${error}`)
              }
              break;
            case 17://Register
              if(yesOrNo(text)){
                if(text==='はい'){
                  let cancel_status = await redis.hgetStatus(userId, 'reservation_status_cancel')
                  let reservation_status = ''
                  if(cancel_status == 'true'){
                    reservation_status = 'Unread'
                  }else{
                    reservation_status = 'UnreadReservation'
                  }
                  try {
                    let res = await redis.hgetAll(userId)
                    let total = Number(await redis.hgetStatus(userId,'reservation_nursery_number'))
                    let childname = []
                    let birthday = []
                    let memberid = []
                    let disase_id = []
                    let meal_id = []
                    let meal_caution = []
                    let cramps_caution = []
                    let allergy_caution = []
                    Object.entries(res).forEach(([k, v]) => {
                      let i = k.slice(-1);
                      if(Number.isInteger(Number(i))){
                        i = Number(i)
                        if((k).includes('reservation_child_name_'+i)){
                          childname[i] = v
                        }else if((k).includes('reservation_child_birthday_'+i)){
                          birthday[i] = v
                        }else if((k).includes('reservation_child_memberid_'+i)){
                          memberid[i] = v
                        }else if((k).includes('reservation_child_disase_id_'+i)){
                          disase_id[i] = v
                        }else if((k).includes('reservation_child_meal_id_'+i)){
                          meal_id[i] = v
                        }else if((k).includes('reservation_child_meal_caution_'+i)){
                          meal_caution[i] = v
                        }else if((k).includes('reservation_child_cramps_caution_'+i)){
                          cramps_caution[i] = v
                        }else if((k).includes('reservation_child_allergy_caution_'+i)){
                          allergy_caution[i] = v
                        }
                      }
                    });
                    for (let i = 1; i <= total; i++) {
                      try {
                        queryString = `INSERT INTO public."Reservation"("MemberID", "NurseryID", "ReservationStatus", "ReservationDate", "UpdatedTime") VALUES ('${memberid[i]}' ,'${res.reservation_nursery_id_1}', '${reservation_status}', '${getTimeStampWithTimeDayFrom8Number(res.reservation_date)}','${getTimeStampFromDayDataObj(today)}') RETURNING "ID";` 
                        let reservationID = await registerIntoReservationTable(queryString)
                        if(Number.isInteger(reservationID)){
                          queryString = `INSERT INTO public."ReservationDetails"( "ID", "MemberID", "DiseaseID", "ReservationDate", "firstNursery", "secondNursery", "thirdNursery", "ParentName", "ParentTel", "SistersBrothersID", "MealType", "MealDetails", "Cramps", "Allergy", "InTime", "OutTime") VALUES ('${reservationID}','${memberid[i]}', '${disase_id[i]}', '${getTimeStampWithTimeDayFrom8Number(res.reservation_date)}', '${res.reservation_nursery_id_1}', '${res.reservation_nursery_id_2}', '${res.reservation_nursery_id_3}', '${res.reservation_child_parent_name}', '${res.reservation_child_parent_tel}', '{}', '${meal_id[i]}', '${meal_caution[i]}', '${cramps_caution[i]}', '${allergy_caution[i]}', '${getTimeStampFromDay8NumberAndTime4Number(res.reservation_date, res.reservation_nursery_intime)}', '${getTimeStampFromDay8NumberAndTime4Number(res.reservation_date, res.reservation_nursery_outtime)}');`
                          let reserved = await insertReservationDetails(queryString)
                          if(reserved){
                            await redis.resetAllStatus(userId)
                            if(cancel_status == 'true'){
                              replyMessage = "キャンセル待ち登録が完了しました。"//TODO注意事項をかく
                            }else{
                              replyMessage = "予約が完了しました。"//TODO注意事項をかく
                            }
                            replyMessage += "\n続けて予約する場合は「予約」を返信してください。\n予約状況を確認する場合は「予約確認」と返信してください。"
                          }
                        }
                      } catch (error) {
                        if(reservationID!=null){
                          queryString = `DELETE FROM public."Reservation" WHERE "ID" = '${reservationID}';` 
                          await registerIntoReservationTable(queryString)
                          replyMessage = "申し訳ございません。\n予約が完了しませんでした。\n恐れ入りますが、始めからやり直してください。\n予約をやり直す場合は「予約」と返信してください。"
                          await redis.resetAllStatus(userId)
                        }
                        replyMessage = "申し訳ございません。\n予約が完了しませんでした。\n恐れ入りますが、始めからやり直してください。\n予約をやり直す場合は「予約」と返信してください。"
                      }
                    }// end for
                  } catch (error) {
                    console.log(`Reservation ERR: ${error}`)
                  }
                  break;
                }else if(text=='いいえ'){
                  await redis.resetAllStatus(userId)
                  replyMessage = "予約を中止しました。"
                }
                break;
              }else{
                replyMessage =  "・予約を完了する場合は「はい」\n・予約を中止する場合は「いいえ」\n・予約をやり直す場合は「予約」\nと返信してください。"
                break;
              };
              break;
            default:
              console.log('Nothing to do in switch ') 
            break;
          }// end of switch
        }else{
          //通常Message
          replyMessage = "こんにちは！みらいくの病児保育予約システムです。\n▶予約の開始は「予約」\n▶予約内容の確認は「予約確認」\n▶各病児保育室の予約状況を確認は「空き状況」\n▶アカウント登録は「登録」\nと返信してください。\n\n※こちらのLINEは応答専用です。恐れ入りますが、お問い合わせは直接みらいくまでご連絡くださいませ。"
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
        const request_line = https.request(webhookOptions, (res) => {
          res.on("data", (d) => {
            process.stdout.write(d)
          })
        })
    
        // エラーをハンドル
        request_line.on("error", (err) => {
          console.error(err)
        })
    
        // データを送信
        request_line.write(dataString)
        request_line.end()
      }

    } catch (err) {
        console.error("応答メッセージ： "+err);
    }

    /*
    リマインダートリガー
    */
    try {
      if(!req.body.line_push_from_cron){
        return
      }
      const push_message = req.body.line_push_from_cron
      const lineid = req.body.id
      if(push_message != undefined){
        if(push_message == '20pm'){
          res.send(lineid)
          replyMessage = '【要返信】\n明日、病児保育のご予約をいただいております。\nご来園される場合は「来園」と返信してください。\n\n※明日の朝7時までにご返信がない場合、お預かりはキャンセルとなります。'
        }else if(push_message == 'today7am'){
          res.send(lineid)
          replyMessage = 'ご来園の返信がなかっため本日のご予約はキャンセルさせていただきました。\nご不明点がある場合はみらいくまで直接お問い合わせください。'
          
        }else if(push_message == '7amwaiting'){
          res.send(lineid)
          replyMessage = '【要返信】\nキャンセル待ちに空きができました。\nこのまま予約を確定する場合は「空き登録」と返信してください。\n\n※15分以内にご返信がない場合、次にお待ちの方にキャンセル枠をお譲りいたします。ご了承ください。'
        }
        // リクエストヘッダー
        dataString = JSON.stringify({
          to: lineid,
          messages: [
            {
              "type": "text",
              "text": replyMessage
            }
          ]
        })

        const headers = {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + TOKEN
        }
        // リクエストに渡すオプション
        const webhookOptions = {
          "hostname": "api.line.me",
          "path": "/v2/bot/message/push",
          "method": "POST",
          "headers": headers,
          "body": dataString
        }
    
        // リクエストの定義
        const request_line = https.request(webhookOptions, (res) => {
          res.on("data", (d) => {
            process.stdout.write(d)
          })
        })
    
        // エラーをハンドル
        request_line.on("error", (err) => {
          console.error(err)
        })
    
        // データを送信
        request_line.write(dataString)
        request_line.end()
      }
    } catch (error) {
      console.error("トリガー： "+err);
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

function TimeFormatFromDB(s){
  //08:45:00 -> 0845
  let time = s.replace(':', '')
  time = time.substr( 0, 4 )
  return time
}

function isValidTime(s){
  if(s.match(/^[0-9]+$/) && s.length == 4 && Number(s.substr( 0, 2 )) <= 24 && Number(s.substr( 2, 4 )) <= 59){
    return true
  }else{
    return false
  }
}
function zenkaku2Hankaku(val) {
  var regex = /[Ａ-Ｚａ-ｚ０-９！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝]/g;

  // 入力値の全角を半角の文字に置換
  value = val
    .replace(regex, function (s) {
      return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
    })
    .replace(/[‐－―]/g, "-") // ハイフンなど
    .replace(/[～〜]/g, "~") // チルダ
    .replace(/　/g, " "); // スペース
  return value;
}
function hankaku2Zenkaku(str) {
  return str.replace(/[A-Za-z0-9]/g, function(s) {
      return String.fromCharCode(s.charCodeAt(0) + 0xFEE0);
  });
}

function isValidNum(s){
  //半角と全角どちらでも受け付ける
  if(Number.isNaN(Number(s))){
    if(Number.isNaN(Number(zenkaku2Hankaku(s)))){
      return false
    }else{
      return true
    }
  }else{
    return true
  }
}


function getTimeStampDayFrom8Number(s){
  //20221122 -> 2022-11-22
  if(isValidDate(s)){
    return Number(s.substr( 0, 4 ))+'-'+('00' + Number(s.substr( 4, 2 ))).slice(-2)+'-'+('00' + Number(s.substr( 6, 2 ))).slice(-2)
  }else{
    return s
  } 
}

function getTimeStampWithTimeDayFrom8Number(s){
  //20221122 -> 2022-11-22 0:00
  if(isValidDate(s)){
    return Number(s.substr( 0, 4 ))+'-'+('00' + Number(s.substr( 4, 2 ))).slice(-2)+'-'+('00' + Number(s.substr( 6, 2 ))).slice(-2)+' 0:00'
  }else{
    return s
  } 
}


function getTimeStampFromDayDataObj(dataobj){
  //un Dec 19 2021 11:41:53 GMT+0900 (Japan Standard Time) -> 2021-12-19 11:41:53
  let date = new Date(dataobj);
  return date.getFullYear() + '-' + ('00' + (date.getMonth() + 1)).slice(-2) + '-' +('00' + date.getDate()).slice(-2) + ' ' +  ('00' + date.getHours()).slice(-2) + ':' + ('00' + date.getMinutes()).slice(-2) + ':' + ('00' + date.getSeconds()).slice(-2)
}


function getTimeJPFormattedFromDayDataObj(dataobj){
  //un Dec 19 2021 11:41:53 GMT+0900 (Japan Standard Time) -> 11:41
  let date = new Date(dataobj);
  return ('0' + date.getHours()).slice(-2) + ':' + ('00' + date.getMinutes()).slice(-2)
}

function getTimeStampFromDay8NumberAndTime4Number(day, time){
  //20221122,1500 -> 2022-11-22 15:00
  if(isValidDate(day) && isValidTime(time)){
    return Number(day.substr( 0, 4 ))+'-'+('00' + Number(day.substr( 4, 2 ))).slice(-2)+'-'+('00' + Number(day.substr( 6, 2 ))).slice(-2)+' '+Number(time.substr( 0, 2 ))+':'+Number(time.substr( 2, 4 ))
  }else{
    return day
  } 
}

function getJpTimeHourFromFormattedDate(day){
  //2021-12-31 11:30:00 -> 11時30分
  let time = day.substr( 11, 2 )+'時'+day.substr( 14, 2 )+'分'
  return time 
}


function DayToJPFromDateObj(dt){
  var y = dt.getFullYear();
  var m = ('00' + (dt.getMonth()+1)).slice(-2);
  var d = ('00' + dt.getDate()).slice(-2);
  var w = [ "日", "月", "火", "水", "木", "金", "土" ][dt.getDay()]
  return (y + '年' + m + '月' + d + '日('+w+')');
}

function DayToJP(s){
  if(isValidDate(s)){
    return Number(s.substr( 0, 4 ))+'年'+Number(s.substr( 4, 2 ))+'月'+Number(s.substr( 6, 2 ))+'日'
  }else{
    return s
  }
}

function TimeToJP(s){
  //2020 -> 20時20分
  if(isValidTime(s)){
    return Number(s.substr( 0, 2 ))+'時'+Number(s.substr( 2, 4 ))+'分'
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
  //timestampのみ受付
  if(Number(s) && s.length == 8){
    s = getTimeStampWithTimeDayFrom8Number(s)
  }
  let JST = new Date(s).toLocaleString({ timeZone: 'Asia/Tokyo' })
  let day = new Date(JST)
  return '('+[ "日", "月", "火", "水", "木", "金", "土" ][day.getDay()]+')'
}

function timenumberToDayJP(s){
  //秒数から○年○月○日と表記
  let JST = new Date(s).toLocaleString({ timeZone: 'Asia/Tokyo' })
  let day = new Date(JST)
  return DayToJP(String(day.getFullYear())+('00' + String(day.getMonth() + 1)).slice(-2)+('00' + String(day.getDate())).slice(-2))
}

function isBeforeToday8AM(s){
  if(isValidDate(s)){
    let reservationday = new Date(getYear(s), Number(getMonth(s)-1), getDay(s)).toLocaleString({ timeZone: 'Asia/Tokyo' })//月のみ0インデックス, 秒で出力
    let reservationday_dateobj = new Date(reservationday)
    let JST = new Date().toLocaleString({ timeZone: 'Asia/Tokyo' })
    let today = new Date(JST).setHours(0,0,0,0)//時間は考慮しない
    let today_hour = new Date(JST)//時間は考慮しない
    if(today == reservationday_dateobj.getTime() &&  today_hour.getHours() >= 8){
      return false
    }
    return true
  }
  return false
}

function isValidRegisterdDay(s, lineid){
  const holiday = new Holidays('JP')
  holiday.setTimezone(process.env.TZ)
  holiday.setHoliday('12-29', 'miraiku-holiday')
  holiday.setHoliday('12-30', 'miraiku-holiday')
  holiday.setHoliday('12-31', 'miraiku-holiday')
  holiday.setHoliday('01-01', 'miraiku-holiday')
  holiday.setHoliday('01-02', 'miraiku-holiday')
  holiday.setHoliday('01-03', 'miraiku-holiday')
  if(isValidDate(s)){
    let reservationday = new Date(getYear(s), Number(getMonth(s)-1), getDay(s)).toLocaleString({ timeZone: 'Asia/Tokyo' })//月のみ0インデックス, 秒で出力 //12/21/2021, 12:00:00 AM
    let reservationday_formatted = new Date(reservationday)//月のみ0インデックス, 秒で出力
    let JST = new Date().toLocaleString({ timeZone: 'Asia/Tokyo' })
    let today = new Date(JST).setHours(0,0,0,0)//時間は考慮しない //1639839600000
    let dayaftertomorrow = new Date(JST) //2021-12-20T15:00:00.000Z
    dayaftertomorrow.setDate(dayaftertomorrow.getDate() + 2)
    dayaftertomorrow.setHours(0,0,0,0)
    let milltime_of_today = today
    let milltime_of_reservationday = reservationday_formatted.getTime()
    let milltime_of_dayaftertomorrow = dayaftertomorrow.getTime()
    if(holiday.isHoliday(reservationday) || reservationday_formatted.getDay() == 0 ||  reservationday_formatted.getDay() == 6){
      return false
    }else if(milltime_of_reservationday > milltime_of_dayaftertomorrow){
      return false
    }else if(milltime_of_reservationday < milltime_of_today){
      return false
    }else if(milltime_of_reservationday >= milltime_of_today && milltime_of_reservationday <= milltime_of_dayaftertomorrow){
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


function convertBooleanToJP(s){
  if(s === 'true'){
    return 'あり'
  }else if(s === 'false'){
    return 'なし'
  }else{
    return s
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
    console.log(results)
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

async function isAvailableReservation(id){
  try {
    let queryString = `SELECT * FROM public."Member" WHERE "LINEID" = '${id}' and ("MiraikuID" IS NOT NULL and "MiraikuID" > 0);`;
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

async function registerIntoReservationTable(queryString){
  try {
    const results = await psgl.sqlToPostgre(queryString)
    if(Object.keys(results).length == 0){
      return 0
    }else{
      return results[0].ID
    }
  }
  catch (err) {
    console.log(`PSGL ERR @registerIntoReservationTable: ${err}`)
  }
}

async function insertReservationDetails(queryString){
  try {
    const results = await psgl.sqlToPostgre(queryString)
    console.log('insertReservationDetails Object.keys(results).length:'+Object.keys(results).length)
    if(Object.keys(results).length == 0){
      return true
    }else{
      return false
    }
  }
  catch (err) {
    console.log(`PSGL ERR @insertReservationDetails: ${err}`)
  }
}


async function isValidNurseryName(s){
  let nursery_list = await psgl.getNurseryName()
  let exist = false
  for(let i = 0; i < nursery_list.length; i++){
    if(nursery_list[i].name === s){
      exist = true
    }
  }
  return exist
}

async function getNurseryIdByName(name){
  return await psgl.getNurseryIdByName(name)
}

async function hasNurseryCapacity(name){
  return await psgl.getNurseryCapacityByName(name)
}

async function withinOpeningTime(id, time){
  let result = false
  let open = await redis.hgetStatus(id,'reservation_nursery_opentime')
  let close = await redis.hgetStatus(id,'reservation_nursery_closetime')
  if(open != null && close != null){
    if(Number(open)<=Number(time) && Number(close)>=Number(time)){
      result = true
    }
  }
  return result
}

async function isMembered(id, name, birthday){
  let result = await psgl.isMemberedInMemberTable(id, name, birthday)
  if(result[0] != undefined && result[0].ID != null){
    return true
  }else{
    false
  }
}

async function isValidMeal(id){
  try {
    let num = zenkaku2Hankaku(id)
    let result = await psgl.isValidMealInMealTable(num)
    if(result[0] != undefined && result[0].ID != null){
      return true
    }else{
      false
    }
  } catch (error) {
    return false
  }
}

async function isValidDisease(id){
  try {
    let num = zenkaku2Hankaku(id)
    let result = await psgl.isValidDiseaseInDiseaseTable(num)
    if(result[0] != undefined || result[0].ID != null){
      return true
    }else{
      return false
    }
  } catch (error) {
    return false
  }
}

async function getJpValueFromPsglIds(o){
  try {
    let result = []
    let name = await psgl.getMemberNameByMemberID(o.MemberID)
    let disease= await psgl.getDiseaseNameFromUniqueID(o.DiseaseID)
    let firstn= await psgl.getNurseryNameByID(o.firstNursery)
    let secondn
    try {
      secondn = await psgl.getNurseryNameByID(o.secondNursery)
      secondn = secondn[0].NurseryName
    } catch (error) {
      //NurseryID = 0
      secondn = 'なし'
    }
    let thirdn
    try {
      thirdn = await psgl.getNurseryNameByID(o.thirdNursery)
      thirdn = thirdn[0].NurseryName
    } catch (error) {
      //NurseryID = 0
      thirdn = 'なし'
    }
    let mealname = await psgl.getMealNameFromID(o.MealType)
    result.push({MemberID:name[0].Name, DiseaseID:disease[0].DiseaseName, firstNursery:firstn[0].NurseryName, secondNursery:secondn, thirdNursery:thirdn, MealType:mealname[0].MealName})
    return result
  } catch (error) {
    console.log("ERROR @getJpValueFromPsglIds() "+error)
  }
}

function escapeHTML(string){
  return string.replace(/&/g, '&lt;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, "&#x27;");
}
module.exports = router