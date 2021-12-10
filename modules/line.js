const express = require('express');
const router = express.Router()
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
const Redis = require("ioredis");
const https = require("https");
const TOKEN = process.env.LINE_ACCESS_TOKEN
const redis_client = new Redis(process.env.REDIS_URL);

router
  .post('/', async (req, res) => {
    try {
      
      const text = req.body.events[0].message.text
      const userId = req.body.events[0].source.userId
      let dataString

      res.send("HTTP POST request sent to the webhook URL!")
      
      // ユーザーがボットにメッセージを送った場合、返信メッセージを送る
      if (req.body.events[0].type === "message") {
        //GET CURRENT STATUS
        let register_status
        let register_reply_status
        await redis_client.hget(userId,'register_status', (err, reply) => {
          if (err) throw err;
          register_status = reply;
          console.log('CURRENT　register_status : ' +reply);
        });
        await redis_client.hget(userId,'register_reply_status', (err, reply) => {
          if (err) throw err;
          register_reply_status = reply;
          console.log('CURRENT　register_reply_status : '+reply);
        });

        if(text === "予約"){
            try {
              const psgl_client = await pool.connect(); 
              let queryString = `SELECT * FROM public."Member" WHERE "LINEID" = '`+userId+`';`;
              const result = await psgl_client.query(queryString);
              const results = { 'results': (result) ? result.rows : null};
              console.log('LINEID select length:' + Object.keys(results).length);
              console.table(results.rows)
              psgl_client.release();
            }
            catch (err) {
              console.log(`PSGL ERR: ${err}`)
            }
            //'お子様のお名前を返信してください。\n例）西沢未来さんの場合、「ニシザワミライ」'
            //'お子様の誕生日を返信してください。\n例）2020年1月30日生まれの場合、「20210130」'
            dataString = JSON.stringify({
                replyToken: req.body.events[0].replyToken,
                messages: [
                  {
                    "type": "text",
                    "text": "病児保育の予約ですね"
                  }
                ]
              })
        }else if(text === "登録"){
          //SET Status 1
          await redis_client.hset(userId,'register_status',1, (err, reply) => {
            if (err) throw err;
            console.log('started register_status 1 :'+ reply);
          });
          //SET Reply Status 10
          await redis_client.hset(userId,'register_reply_status',10, (err, reply) => {
            if (err) throw err;
            console.log('started register_reply_status 10 :' + reply);
          });

          dataString = JSON.stringify({
            replyToken: req.body.events[0].replyToken,
            messages: [
              {
                "type": "text",
                "text": "会員登録開始します。\n始めにお子様のお名前を全角カナで返信してください。\n例）西沢未来の場合「ニシザワミライ」"
              }
            ]
          })
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
        }else if(register_status!=null && text==='中止'){
          await redis_client.hdel(userId, 'register_status', 'register_reply_status', 'Name', 'BirthDay','Allergy',(err, reply) => {
            if (err) throw err;
            console.log('REDIS DELETED: ' + userId)
          });

          dataString = JSON.stringify({
            replyToken: req.body.events[0].replyToken,
            messages: [
              {
                "type": "text",
                "text": "手続きを中止しました。"
            }
            ]
          })
        }else if(register_status!=null){
          //ACTION
          switch (Number(register_status)) {
            //Name
            case 1:
              if(register_reply_status==10){
                let name = text.replace(/\s+/g, "")
                if(isZenkakuKana(name)){
                  dataString = JSON.stringify({
                    replyToken: req.body.events[0].replyToken,
                    messages: [
                      {
                        "type": "text",
                        "text": "お子様のお名前は「"+name+"」さんですね。\n次に、お子様の生年月日を数字で返信してください。\n例）2020年1月30日生まれの場合、20210130と入力してください。"
                      }
                    ]
                  })//close json
                  //SET Name Value
                  await redis_client.hset(userId,'Name',name, (err, reply) => {
                    if (err) throw err;
                    console.log('SET Name Value:'+reply);
                  });
                  //SET Status 2
                  await redis_client.hset(userId,'register_status',2, (err, reply) => {
                    if (err) throw err;
                    console.log('SET Status 2:'+reply);
                  });
                  //SET Reply Status 20
                  await redis_client.hset(userId,'register_reply_status',20, (err, reply) => {
                    if (err) throw err;
                    console.log('SET Reply Status 20:' + reply);
                  });
                }else{
                  dataString = JSON.stringify({
                    replyToken: req.body.events[0].replyToken,
                    messages: [
                      {
                        "type": "text",
                        "text": "申し訳ございません。\nお子様のお名前を全角カナで返信してください。\n例）西沢未来の場合「ニシザワミライ」\n\n手続きを中止する場合は「中止」と返信してください。"
                      }
                    ]
                  })//close json
                }// close ZenkakuKana
              }
            break;//CASE1
            //BirthDay
            case 2:
              if(isBirthdayNum(text)){
                dataString = JSON.stringify({
                  replyToken: req.body.events[0].replyToken,
                  messages: [
                    {
                      "type": "text",
                      "text": "お子様の誕生日は「"+BirthDayToJp(text)+"」ですね。\n次に、お子様のアレルギーの有無を返信してください。\n例）有りの場合「あり」、無しの場合「なし」"
                    }
                  ]
                })//close json
                //SET Name Value
                await redis_client.hset(userId,'BirthDay',text, (err, reply) => {
                  if (err) throw err;
                  console.log('SET BirthDay Value:'+reply);
                });
                //SET Status 3
                await redis_client.hset(userId,'register_status',3, (err, reply) => {
                  if (err) throw err;
                  console.log('SET Status 3:'+reply);
                });
                //SET Reply Status 30
                await redis_client.hset(userId,'register_reply_status',30, (err, reply) => {
                  if (err) throw err;
                  console.log('SET Reply Status 30:' + reply);
                });
              }else{
                dataString = JSON.stringify({
                  replyToken: req.body.events[0].replyToken,
                  messages: [
                    {
                      "type": "text",
                      "text": "申し訳ございません。\nお子様の生年月日を数字で返信してください。\n例）2020年1月30日生まれの場合、20210130と返信してください。\n\n手続きを中止する場合は「中止」と返信してください。"
                    }
                  ]
                })//close json
              }
              break;//CASE2
            //Allergy
            case 3:
              if(hasAllergyValidation(text)){
                //SET Name Value
                await redis_client.hset(userId,'Allergy',text, (err, reply) => {
                  if (err) throw err;
                  console.log('SET Allergy Value:'+reply);
                });
                //SET Status 4
                await redis_client.hset(userId,'register_status',4, (err, reply) => {
                  if (err) throw err;
                  console.log('SET Status 4:'+reply);
                });
                //SET Reply Status 40
                await redis_client.hset(userId,'register_reply_status',40, (err, reply) => {
                  if (err) throw err;
                  console.log('SET Reply Status 40:' + reply);
                });
                //Get all information
                await redis_client.hgetall(userId, (err, reply) => {
                  if (err) throw err;
                  regsiter_informations = reply
                });
                let all_info = ''
                Object.entries(regsiter_informations).forEach(([k, v]) => { // ★
                    console.log({k, v});
                    if(k=='Name'){
                      all_info += "お名前："+v+"\n"
                    }else if(k=='BirthDay'){
                      all_info += "お誕生日："+BirthDayToJp(v)+"\n"
                    }else if(k=='Allergy'){
                      all_info += "アレルギー："+v+"\n"
                    }
                });

                dataString = JSON.stringify({
                  replyToken: req.body.events[0].replyToken,
                  messages: [
                    {
                      "type": "text",
                      "text": "お子様のアレルギーは「"+text+"」ですね。\n\n以下の内容で会員情報をします。\nよろしければ「はい」を返信してください。\n登録を中止する場合は「いいえ」を返信してください。\n\n"+all_info
                    }
                  ]
                })//close json
                break;
              }else{
                dataString = JSON.stringify({
                  replyToken: req.body.events[0].replyToken,
                  messages: [
                    {
                      "type": "text",
                      "text": "申し訳ございません。\n再度、お子様のアレルギーの有無を返信してください。\n例）ありの場合「あり」、なしの場合「なし」\n\n手続きを中止する場合は「中止」と返信してください。"
                    }
                  ]
                })//close json
                break;
              };//CASE3
            case 4:
              if(yesOrNo(text)){
                if(text==='はい'){
                  try {
                    //Get all information
                    let info
                    await redis_client.hgetall(userId, (err, reply) => {
                      if (err) throw err;
                      info = reply
                    });
                    const psgl_client = await pool.connect(); 
                    let queryString = `INSERT INTO public."Member" ("LINEID","BirthDay","Name","Allergy") VALUES(
                    '`+userId+`', '`+info['BirthDay']+`', '`+info['Name']+`', '`+convertAllergyBoolean(info['Allergy'])+`')`;
                    const result = await psgl_client.query(queryString);

                    const results = { 'results': (result) ? result.rows : null};
                    console.log(results);
                    
                    await redis_client.hdel(userId, 'register_status', 'register_reply_status', 'Name', 'BirthDay','Allergy',(err, reply) => {
                      if (err) throw err;
                      console.log('REDIS DELETED: ' + userId)
                    });
                    psgl_client.release();
                    //redis_client.release();
                  } catch (err) {
                    console.error(err);
                  }
                  dataString = JSON.stringify({
                    replyToken: req.body.events[0].replyToken,
                    messages: [
                      {
                        "type": "text",
                        "text": "会員登録を完了しました。\n続けてご兄妹を登録する場合は「登録」と返信してください。"
                      }
                    ]
                  })
                  break;
                }else if(text=='いいえ'){
                  await redis_client.hdel(userId, 'register_status', 'register_reply_status', 'Name', 'BirthDay','Allergy',(err, reply) => {
                    if (err) throw err;
                    console.log('REDIS DELETED: ' + userId)
                  });
                  //redis_client.release();
                  dataString = JSON.stringify({
                    replyToken: req.body.events[0].replyToken,
                    messages: [
                      {
                        "type": "text",
                        "text": "会員登録を中止しました。"
                      }
                    ]
                  })
                }
                break;
              }else{
                dataString = JSON.stringify({
                  replyToken: req.body.events[0].replyToken,
                  messages: [
                    {
                      "type": "text",
                      "text": "登録を完了する場合は「はい」を返信してください。\n登録を中止する場合は「いいえ」を返信してください。"
                    }
                  ]
                })//close json
                break;
              };
            break;//CASE4
            default:
              console.log('Nothing to do in switch ') 
            break;
          }// end of switch
        }else{
          //通常Message
          dataString = JSON.stringify({
            replyToken: req.body.events[0].replyToken,
            messages: [
              {
                "type": "text",
                "text": "こんにちは！みらいくの病児保育予約システムです。\n▶予約の開始は「予約」\n▶予約内容の確認は「予約確認」\n▶各園の予約状況を確認は「カレンダー」\n▶会員登録は「登録」\nと返信してください。"
              }
            ]
          })
    
        }// end default message reply

    
        // リクエストヘッダー
        const headers = {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + TOKEN
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
function BirthDayToJp(s){
  if(isBirthdayNum(s)){
    return Number(s.substr( 0, 4 ))+'年'+Number(s.substr( 4, 2 ))+'月'+Number(s.substr( 6, 2 ))+'日'
  }else{
    return s
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

module.exports = router