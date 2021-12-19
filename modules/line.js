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
          if(await isRegisterd(userId)){
            registeredMessage = '病児保育の予約ですね。\nまだ、お子様の会員登録が済んでいない方は「登録」と返信してください。\n\n'+timenumberToDayJP(dayaftertomorrow)+getDayString(dayaftertomorrow)+'までの予約が可能です。\n予約の希望日を返信してください。\n例）2022年02月22日の場合は「20220222」'
            await redis.hsetStatus(userId,'reservation_status',1)
            await redis.hsetStatus(userId,'reservation_reply_status',10)
          }else{
            registeredMessage = 'ご予約の前に会員登録をお願いいたします。\n会員登録をご希望の場合は「登録」と返信してください。'
          }holiday
          replyMessage = registeredMessage

        }else if(text === "予約確認"){
          try {
            //TODO HTML char
            //TODOuploaded timestamp をReservationに追加する
            //[{},{}]
            replyMessage =''
            let memberids = await psgl.getMermerIDByLINEID(userId)
            for (const member of memberids) {
              let complete_reservations = await psgl.getReservationStatusReservedByMemberIDGraterThanToday(member.ID)
              if(complete_reservations != null){
                for (const rsv of complete_reservations) {
                  replyMessage += "予約完了\n"
                  let reservations_details = await psgl.getReservationDetailsByReservationID(rsv.ID)
                  for (const details of reservations_details) {
                    //await getJpValueFromPsglIds(details)
                    replyMessage += "お子様氏名："+details.MemberID+"\n"
                    replyMessage += "症状："+details.DiseaseID+"\n"
                    replyMessage += "ご予約日："+DayToJPFromDateObj(new Date(details.ReservationDate))+"\n"
                    replyMessage += "第１希望："+details.firstNursery+"\n"
                    replyMessage += "第２希望："+details.secondNursery+"\n"
                    replyMessage += "第３希望："+details.thirdNursery+"\n"
                    replyMessage += "保護者氏名："+details.ParentName+"\n"
                    replyMessage += "食事："+details.MealType+"\n"
                    replyMessage += "アレルギー："+details.Allergy+"\n"
                    replyMessage += "お預り時間："+getJpTimeHourFromFormattedDate(details.InTime)+"〜"+getJpTimeHourFromFormattedDate(details.OutTime)+"\n"
                    replyMessage += "保護者連絡先："+details.ParentTel+"\n"
                    replyMessage += "熱性けいれん："+details.Cramps+"\n"
                  }
                }//end complete_reservations
              }//end if null
              let waiting_reservations = await psgl.getReservationStatusWaitingByMemberIDGraterThanToday(member.ID)
              if(waiting_reservations != null){
                for (const rsv of waiting_reservations) {
                  let reservations_details = await psgl.getReservationDetailsByReservationID(rsv.ID)
                    for (const details of reservations_details) {
                      replyMessage += details+"\n"
                    }
                }//end waiting_reservations
              }//end if null
            }//end memberids
          } catch (error) {
            
          }
          if(replyMessage==''){
            replyMessage = "現在、予約はございません。"
          }
        }else if(text === "登録"){
          await redis.resetAllStatus(userId)
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
                    let queryString = `INSERT INTO public."Member" ("LINEID","BirthDay","Name","Allergy") VALUES(
                      '`+userId+`', '`+info['BirthDay']+`', '`+info['Name']+`', '`+convertAllergyBoolean(info['Allergy'])+`')`;
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
            //Day
            case 1:
              if(reservation_reply_status==10){
                if(isValidRegisterdDay(text)){
                  //TODO: 祝日DBから長期休暇の判定を追加する。DB側ではやらない。
                  //TODO：　定員はredis＆posgleの足し算で換算する（同時予約でブッキングしないように）
                  //TODO: りよう園→枠確認→予約orキャンセル待ちとうろく
                  let nursery_list = await psgl.getNurseryID_Name_Capacity()
                  let all_info = ''
                  for(let i = 0; i < nursery_list.length; i++)
                  {
                      all_info += "・"+nursery_list[i].name+"\n";
                  }
                  //TODO: 曜日がおかしい
                  replyMessage = "希望日は「"+DayToJP(text)+getDayString(text)+"」ですね。\n希望利用の園を以下から選択してください。\n\n"+all_info+"\n早苗町を希望の場合「早苗町」と返信してください。"
                  redis.hsetStatus(userId,'reservation_date',text)
                  redis.hsetStatus(userId,'reservation_status',2)
                  redis.hsetStatus(userId,'reservation_reply_status',20)
                }else{
                  replyMessage = "申し訳ございません。希望日は休園日または予約の対象外です。\n\n"+timenumberToDayJP(dayaftertomorrow)+getDayString(dayaftertomorrow)+"までの予約が可能です。\n例）2022年02月22日に予約したい場合「20220222」と返信してください。\n\n手続きを中止する場合は「中止」と返信してください。"
                }
              }
            break;
            case 2:
              if(reservation_reply_status==20){
                //第１園希望確認
                //TODO：キャパ計算にredisをいれるか検討
                //TODO　予約できない時間になったらできないという
                let cancel = await redis.hgetStatus(userId, 'reservation_status_cancel')
                if(cancel=='maybe' && (text == 'はい' || text=='キャンセル')){
                  await redis.hsetStatus(userId,'reservation_status_cancel','true')
                  replyMessage = "キャンセル待ち登録をされたい園を返信してください。\n早苗町を希望の場合「早苗町」"
                  break;
                }
                if(await isValidNurseryName(text)){

                  let nursery_capacity = await hasNurseryCapacity(text)
                  let nursery_id = await getNurseryIdByName(text)
                  let reservation_date = await redis.hgetStatus(userId,'reservation_date')
                  let reservation_num_on_day = await psgl.canNurseryReservationOnThatDay(getTimeStampDayFrom8Number(reservation_date), nursery_id[0].ID)
                  
                  if(cancel == null){
                    if((Number(nursery_capacity[0].Capacity) - Number(reservation_num_on_day[0].count)) <= 0){
                      replyMessage = "申し訳ございません。\nご利用希望日は満員です。\n他の園名を返信してください。\nキャンセル待ち登録をする場合は「はい」を返信してください。\n"
                      await redis.hsetStatus(userId,'reservation_status_cancel','maybe')
                      break;
                    }
                  }
                  let opentime = await psgl.getNurseryOpenTimeFromName(text)
                  let closetime = await psgl.getNurseryCloseTimeFromName(text)
                  //TODO 開園時間が0800になってるのでなおす
                  if(cancel == null){
                    replyMessage = "利用希望の園は「"+text+"」ですね。\n第2希望の園名を返信してください。"
                  }else{
                    replyMessage = "キャンセル登録希望の園は「"+text+"」ですね。\n第2希望の園名を返信してください。"
                  }
                  redis.hsetStatus(userId,'reservation_nursery_name_1',text)
                  redis.hsetStatus(userId,'reservation_nursery_id_1',nursery_id[0].ID)
                  redis.hsetStatus(userId,'reservation_nursery_opentime',TimeFormatFromDB(opentime[0].OpenTime))
                  redis.hsetStatus(userId,'reservation_nursery_closetime',TimeFormatFromDB(closetime[0].CloseTime))
                  redis.hsetStatus(userId,'reservation_status',3)
                  redis.hsetStatus(userId,'reservation_reply_status',30)
                    
                }else{
                  replyMessage = "例）早苗町をご希望の場合「早苗町」と返信してください。"
                }//isValidNursery
              }
              break;//CASE2
            case 3:
              //第2希望
              if(await isValidNurseryName(text)){
                  replyMessage = "第2希望の園は「"+text+"」ですね。\n第3希望の園名を返信してください。\n希望がない場合は「なし」と返信してください。"
                  let nursery_id = await getNurseryIdByName(text)
                  redis.hsetStatus(userId,'reservation_nursery_name_2',text)
                  redis.hsetStatus(userId,'reservation_nursery_id_2',nursery_id[0].ID)
                  redis.hsetStatus(userId,'reservation_status',4)
                  redis.hsetStatus(userId,'reservation_reply_status',40)
              }else{
                replyMessage = "例）早苗町をご希望の場合「早苗町」と返信してください。"
              }//isValidNursery
              break;//CASE3
            case 4:
              //第3希望
              if(await isValidNurseryName(text) || text == 'なし'){
                let first_nursery = await redis.hgetStatus(userId, 'reservation_nursery_name_1')
                let open = await redis.hgetStatus(userId, 'reservation_nursery_opentime')
                let close = await redis.hgetStatus(userId, 'reservation_nursery_closetime')
                replyMessage = "利用希望の園は「"+text+"」ですね。\n登園時間を返信してください。\n\n"+first_nursery+"の開園時間は、"+open+"〜"+close+"です。\n例）9時に登園する場合は「0900」"
                redis.hsetStatus(userId,'reservation_nursery_name_3',text)
                if( text == 'なし'){
                  console.log(text)
                  await redis.hsetStatus(userId,'reservation_nursery_id_3',0)
                }
                redis.hsetStatus(userId,'reservation_status',5)
                redis.hsetStatus(userId,'reservation_reply_status',50)
              }else{
                replyMessage = "例）早苗町をご希望の場合「早苗町」と返信してください。\n第3希望がない場合は「なし」と返信してください。"
              }//isValidNursery
              break;//CASE4
            case 5:
              if(isValidTime(text)&& await withinOpeningTime(userId, text)){
                replyMessage = "登園時間は「"+TimeToJP(text)+"」ですね。\n退園時間を返信してください。\n例）16時に退園する場合は「1600」"
                redis.hsetStatus(userId,'reservation_nursery_intime',text)
                redis.hsetStatus(userId,'reservation_status',6)
                redis.hsetStatus(userId,'reservation_reply_status',60)
              }else{
                replyMessage = "登園時間は開園時間内の時間を返信してください。\n例）8時登園の場合は「0800」"
              }
              break;//CASE3
            case 6:
              if(isValidTime(text)&& await withinOpeningTime(userId, text)){
                replyMessage = "退園時間は「"+TimeToJP(text)+"」ですね。\n\n利用人数を返信してください。\n例）1人の場合は「1」、ご兄妹2人で利用される場合は「2」"
                redis.hsetStatus(userId,'reservation_nursery_outtime',text)
                redis.hsetStatus(userId,'reservation_status',7)
                redis.hsetStatus(userId,'reservation_reply_status',70)
              }else{
                replyMessage = "退園時間は開園時間内の時間を返信してください。\n例）16時退園の場合は「1600」"
              }
              break;//CASE4
            case 7:
                if(isValidNum(text)){
                  //TODO 2枠のこってないと兄妹みれないことにする
                  let nursery_capacity = await hasNurseryCapacity(await redis.hgetStatus(userId, 'reservation_nursery_id_1'))
                  let reservation_date = await redis.hgetStatus(userId,'reservation_date')
                  let reservation_num_on_day = await psgl.canNurseryReservationOnThatDay(getTimeStampDayFrom8Number(reservation_date), nursery_id[0].ID)
                  console.log("CAPACITIL"+ (Number(nursery_capacity[0].Capacity) - Number(reservation_num_on_day[0].count)))
                  if((Number(nursery_capacity[0].Capacity) - Number(reservation_num_on_day[0].count)) < 2){
                    replyMessage = "申し訳ございません。\nご利用希望日は満員です。\n他の園名を返信してください。\nキャンセル待ち登録をする場合は「はい」を返信してください。\n"
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
                }else{
                  replyMessage = "利用人数を返信してください。\n例）1人の場合は「1」、ご兄妹2人で利用される場合は「2」"
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
                replyMessage = "アレルギーに関する連絡事項は「"+text+"」ですね。\n\n"+update_current_child_number+"人目の内容を登録します。\n\nお子様のお名前を全角カナで返信してください。\n例）西沢未来の場合「ニシザワミライ」"
              break;//CASE70
            case 8:
              let name = text.replace(/\s+/g, "")
              if(isZenkakuKana(name)){
                replyMessage = "お子様のお名前は「"+name+"」さんですね。\n次に、お子様の生年月日を数字で返信してください。\n例）2020年1月30日生まれの場合、20210130と入力してください。"
                //SET Name Value
                current_child_number = await redis.hgetStatus(userId,'reservation_nursery_current_register_number')
                await redis.hsetStatus(userId,'reservation_child_name_'+current_child_number,name)
                //SET Status 2
                await redis.hsetStatus(userId,'reservation_status',9)
                //SET Reply Status 20
                await redis.hsetStatus(userId,'reservation_reply_status',90)
              }else{
                replyMessage = "申し訳ございません。\nお子様のお名前を全角カナで返信してください。\n例）西沢未来の場合「ニシザワミライ」\n\n手続きを中止する場合は「中止」と返信してください。"
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
                    replyMessage = "お子様の誕生日は「"+DayToJP(text)+"」ですね。\n\n以下から、当てはまる症状を番号で返信してください。\n例）気管支炎の場合は「3」、インフルエンザAの場合は「6A」\n\n"+all_info
                    let member_id = await psgl.getMemberedIDFromNameAndBirthDay(userId, name, text)
                    await redis.hsetStatus(userId,'reservation_child_birthday_'+current_child_number,text)
                    await redis.hsetStatus(userId,'reservation_child_memberid_'+current_child_number,member_id[0].ID)
                    await redis.hsetStatus(userId,'reservation_status',10)
                    await redis.hsetStatus(userId,'reservation_reply_status',100)
                  }else{
                    replyMessage = "お子様の情報が登録されていません。\nもう一度お子様の名前を全角カナで返信していただくか、\n「登録」と返信して会員登録をしてください。\n"
                    await redis.hsetStatus(userId,'reservation_status',8)
                    await redis.hsetStatus(userId,'reservation_reply_status',80)
                  }
                }else{
                  replyMessage = "申し訳ございません。\nお子様の生年月日を数字で返信してください。\n例）2020年1月30日生まれの場合、20210130と返信してください。\n\n手続きを中止する場合は「中止」と返信してください。"
                }
                break;//CASE9  
            case 10:
              if(await isValidDisease(text)){
                let meals = await psgl.getMealList()
                let all_info = ''
                for(let i = 0; i < meals.length; i++)
                {
                    all_info += meals[i].id+". "+meals[i].name+"\n";
                }
                current_child_number = await redis.hgetStatus(userId,'reservation_nursery_current_register_number')
                let disasename = await psgl.getDiseaseNameFromID(text)
                let disaseunique_id = await psgl.getUniqueIDFromDiseaseID(text)
                replyMessage = "お子様の症状は「"+disasename[0].DiseaseName+"」ですね。\n\n以下から、希望する食事を番号で返信してください。\n例）ミルクのみの場合は「2」\n\n"+all_info
                await redis.hsetStatus(userId,'reservation_child_disase_id_'+current_child_number,disaseunique_id[0].ID)
                await redis.hsetStatus(userId,'reservation_child_disase_name_'+current_child_number,disasename[0].DiseaseName)
                await redis.hsetStatus(userId,'reservation_status',11)
                await redis.hsetStatus(userId,'reservation_reply_status',110)
              }else{
                replyMessage = "申し訳ございません。\n当てはまる症状を番号で返信してください。\n例）気管支炎の場合は「3」、インフルエンザAの場合は「6A」\n\n手続きを中止する場合は「中止」と返信してください。"
              }
              break;
            case 11:
              //TODO 全角半角チェックがあまい、休日チェックも
              if(await isValidMeal(text)){
                let mealname = await psgl.getMealNameFromID(text)
                replyMessage = "希望の食事は「"+mealname[0].MealName+"」ですね。\n\n食事に関して追記事項がある場合、その内容を返信してください。\n追記事項がない場合は「なし」と返信してください。" 
                current_child_number = await redis.hgetStatus(userId,'reservation_nursery_current_register_number')
                await redis.hsetStatus(userId,'reservation_child_meal_name_'+current_child_number,mealname[0].MealName)
                await redis.hsetStatus(userId,'reservation_child_meal_id_'+current_child_number,text)
                await redis.hsetStatus(userId,'reservation_status',12)
                await redis.hsetStatus(userId,'reservation_reply_status',120)
              }else{
                replyMessage = "申し訳ございません。\n希望する食事を番号で返信してください。\n例）ミルクのみの場合は「2」」\n\n手続きを中止する場合は「中止」と返信してください。"
              }
              break;
            case 12:
              replyMessage = "食事の追記事項は「"+text+"」ですね。\n\n熱性けいれんの経験がある場合\n回数、初回の年齢、最終の年齢についてご返信ください。\nない場合は「なし」を返信してください。\n例）2回、初回1歳9ヶ月、最終2歳5ヶ月"  
              current_child_number = await redis.hgetStatus(userId,'reservation_nursery_current_register_number')
              if(text=='なし'){
                await redis.hsetStatus(userId,'reservation_child_meal_caution_'+current_child_number,'false')
              }else{
                await redis.hsetStatus(userId,'reservation_child_meal_caution_'+current_child_number,text)
              }
              await redis.hsetStatus(userId,'reservation_status',13)
              await redis.hsetStatus(userId,'reservation_reply_status',130)
              break;
            case 13:
              replyMessage = "熱性けいれんの経験は「"+text+"」ですね。\n\nアレルギーに関する連絡事項がある場合、その内容を返信してください。\nない場合は「なし」を返信してください。"
              current_child_number = await redis.hgetStatus(userId,'reservation_nursery_current_register_number')
              if(text=='なし'){
                await redis.hsetStatus(userId,'reservation_child_cramps_caution_'+current_child_number,'false')
              }else{
                await redis.hsetStatus(userId,'reservation_child_cramps_caution_'+current_child_number,text)
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
              replyMessage = "アレルギーに関する連絡事項は「"+text+"」ですね。\n\n保護者様のお名前を返信してください。\n例）西沢香里"
              if(text=='なし'){
                await redis.hsetStatus(userId,'reservation_child_allergy_caution_'+current_child_number,'false')
              }else{
                await redis.hsetStatus(userId,'reservation_child_allergy_caution_'+current_child_number,text)
              }
              await redis.hsetStatus(userId,'reservation_status',15)
              await redis.hsetStatus(userId,'reservation_reply_status',150)
              break;
            case 15:
              replyMessage = "保護者さまのお名前は「"+text+"」ですね。\n\n保護者さまのお電話番号を記入してください。\n例）09012345678"
              await redis.hsetStatus(userId,'reservation_child_parent_name',text)
              await redis.hsetStatus(userId,'reservation_status',16)
              await redis.hsetStatus(userId,'reservation_reply_status',160)
              break;
            case 16://Register
              //TODO　キャンセル待ちフロー作成
              try {
                await redis.hsetStatus(userId,'reservation_child_parent_tel',text)
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
                    all_info +=  "症状："+disase_id[i]+"\n"
                    all_info +=  "食事："+meal_id[i]+"\n"
                    all_info +=  "食事の注意事項："+convertBooleanToJP(meal_caution[i])+"\n"
                    all_info +=  "熱性けいれんの注意事項："+convertBooleanToJP(cramps_caution[i])+"\n"
                    all_info +=  "アレルギーの注意事項："+convertBooleanToJP(allergy_caution[i])+"\n"
                  }
                  let cancel_status = await redis.hgetStatus(userId, 'reservation_status_cancel')
                  let reservation_status = ''
                  if(cancel_status == 'true'){
                    reservation_status = 'キャンセル待ち登録'
                  }else{
                    reservation_status = '予約'
                  }
                  replyMessage = "保護者様の電話番号は「"+text+"」ですね。\n\n以下の内容で"+reservation_status+"をします。\nよろしければ「はい」、予約しない場合は「いいえ」を返信してください。\n\n"+all_info
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
                    reservation_status = 'Reserved'
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
                      queryString = `INSERT INTO public."Reservation"("MemberID", "NurseryID", "ReservationStatus", "ReservationDate") VALUES ('${memberid[i]}' ,'${res.reservation_nursery_id_1}', '${reservation_status}', '${getTimeStampWithTimeDayFrom8Number(res.reservation_date)}') RETURNING "ID";` 
                      let reservationID = await registerIntoReservationTable(queryString)
                      if(Number.isInteger(reservationID)){
                        queryString = `INSERT INTO public."ReservationDetails"( "ID", "MemberID", "DiseaseID", "ReservationDate", "firstNursery", "secondNursery", "thirdNursery", "ParentName", "ParentTel", "SistersBrothersID", "MealType", "MealDatails", "Cramps", "Allergy", "InTime", "OutTime") VALUES ('${reservationID}','${memberid[i]}', '${disase_id[i]}', '${getTimeStampWithTimeDayFrom8Number(res.reservation_date)}', '${res.reservation_nursery_id_1}', '${res.reservation_nursery_id_2}', '${res.reservation_nursery_id_3}', '${res.reservation_child_parent_name}', '${res.reservation_child_parent_tel}', '{}', '${meal_id[i]}', '${meal_caution[i]}', '${cramps_caution[i]}', '${allergy_caution[i]}', '${getTimeStampFromDay8NumberAndTime4Number(res.reservation_date, res.reservation_nursery_intime)}', '${getTimeStampFromDay8NumberAndTime4Number(res.reservation_date, res.reservation_nursery_outtime)}');`
                        let reserved = await insertReservationDetails(queryString)
                        if(reserved){
                          await redis.resetAllStatus(userId)
                          if(cancel_status == 'true'){
                            replyMessage = "キャンセル待ち登録が完了しました。"//TODO注意事項をかく//TODOキャンセル待ちの返信時間フローつくる
                          }else{
                            replyMessage = "予約を完了しました。"//TODO注意事項をかく//TODOキャンセル待ちの返信時間フローつくる
                          }
                          
                        }
                      }
                    }
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
                replyMessage =  "予約を完了する場合は「はい」を返信してください。\n中止する場合は「いいえ」を返信してください。"
                break;
              };
              break;
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

function hankaku2Zenkaku(s) {
  return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
      return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  });
}

function zenkaku2Hankaku(str) {
  return str.replace(/[A-Za-z0-9]/g, function(s) {
      return String.fromCharCode(s.charCodeAt(0) + 0xFEE0);
  });
}

//TODO　ちゃんと判定できているか不安

function isValidNum(s){
  //半角と全角どちらでも受け付ける
  if(Number(s) == NaN){
    if(Number(zenkaku2Hankaku(s)) == NaN){
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

function getTimeStampWithTimeDayFrom8Number(s){
  //20221122 -> 2022-11-22 0:00
  if(isValidDate(s)){
    return Number(s.substr( 0, 4 ))+'-'+Number(s.substr( 4, 2 ))+'-'+Number(s.substr( 6, 2 ))+' 0:00'
  }else{
    return s
  } 
}

function getTimeStampFromDay8NumberAndTime4Number(day, time){
  //20221122,1500 -> 2022-11-22 15:00
  if(isValidDate(day) && isValidTime(time)){
    return Number(day.substr( 0, 4 ))+'-'+Number(day.substr( 4, 2 ))+'-'+Number(day.substr( 6, 2 ))+' '+Number(time.substr( 0, 2 ))+':'+Number(time.substr( 2, 4 ))
  }else{
    return day
  } 
}

function getJpTimeHourFromFormattedDate(day){
  //2021-12-31 11:30 -> 11時30分
  let time = day.replace(':', '')
  return time.substr( 11, 2 )+':'+time.substr( 13, 2 )
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
  let result = await psgl.isValidMealInMealTable(id)
  if(result[0] != undefined && result[0].ID != null){
    return true
  }else{
    false
  }
}

async function isValidDisease(id){
  try {
    let result = await psgl.isValidDiseaseInDiseaseTable(id)
    if(result[0] != undefined || result[0].ID != null){
      return true
    }else{
      return false
    }
  } catch (error) {
    return false
  }
}
/*
async function getJpValueFromPsglIds(obj){
  try {
    let result = []
    for (const o of obj) {
      let val = await psgl.getValueNameByMemberID(o.MemberID)
      result.push({MemberID:val})
      val = await psgl.getValueNameByDiseaseID(o.DiseaseID)
      result.push({DiseaseID:val})
      val = await psgl.getValueNameByDiseaseID(o.ReservationDate)
      result.push({ReservationDate:val})
      val = await psgl.getValueNameByNurseryID(o.firstNursery)
      result.push({firstNursery:val})
      let val = await psgl.getValueNameByNurseryrID(o.secondNursery)
      result.push({secondNursery:val})
      val = await psgl.getValueNameByNurseryID(o.thirdNursery)
      result.push({thirdNursery:val})
      val = await psgl.getValueNameByMealType(o.MealType)
      result.push({MealType:val})
      val = await psgl.getValueNameByDiseaseID(o.ReservationTime)
      result.push({ReservationTime:val})
      //ReservationDate: 2021-12-19T15:00:00.000Z, なおす
    }
    return result
  } catch (error) {
    console.log("ERROR @getJpValueFromPsglIds()")
  }
}*/

module.exports = router