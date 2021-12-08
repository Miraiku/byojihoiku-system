const cool = require('cool-ascii-faces');
const express = require('express');
const path = require('path');
const PORT = process.env.PORT || 5555;
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
const member_table = ['LINEID','Name','BirthDay','Allergy']

express()
  .use(express.static(path.join(__dirname, 'public')))
  .use(express.json())
  .use(express.urlencoded({extended: true}))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  .get('/cool', (req, res) => res.send(cool()))
  .get('/times', (req, res) => res.send(showTimes()))
  .get('/db', async (req, res) => {
    try {
      const psgl_client = await pool.connect();
      const result = await psgl_client.query('SELECT * FROM test_table');
      const results = { 'results': (result) ? result.rows : null};
      res.render('pages/db', results );
      psgl_client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  .post('/webhook', async (req, res) => {
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
          console.log('register_status : ' +reply);
        });
        await redis_client.hget(userId,'register_reply_status', (err, reply) => {
          if (err) throw err;
          register_reply_status = reply;
          console.log('register_reply_status : '+reply);
        });

        if(text === "予約"){
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
          /*
          try {
            const psgl_client = await pool.connect(); 
            let queryString = `INSERT INTO public."Member" ("LINEID","BirthDay","Name","Allergy") VALUES(
            '`+userId+`', '11111111', 'ヨダミナミ', 'true')`;
            const result = await psgl_client.query(queryString);

            const results = { 'results': (result) ? result.rows : null};
            //console.log(results);
            psgl_client.release();
          } catch (err) {
            console.error(err);
          }*/
          //REDIS CONTROL
          //Is Already Registerd?
          let alreay_registerd
          await redis_client.hget(userId, 'register_status',(err, reply) => {
            if (err) throw err;
            console.log('Is Already Registerd? : ' + reply);
            alreay_registerd = reply
          });
          if(alreay_registerd===null){
            //SET Status 1
            await redis_client.hset(userId,'register_status',1, (err, reply) => {
              if (err) throw err;
              console.log('register_status 1 :'+ reply);
            });
            //SET Reply Status 10
            await redis_client.hset(userId,'register_reply_status',10, (err, reply) => {
              if (err) throw err;
              console.log('register_reply_status 10 :' + reply);
            });
          }

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
        }else if(register_status!=null){
          //ACTION
          switch (Number(register_status)) {
            //Name
            case 1:
              if(register_reply_status==10){
                if(isZenkakuKana(text)){
                  dataString = JSON.stringify({
                    replyToken: req.body.events[0].replyToken,
                    messages: [
                      {
                        "type": "text",
                        "text": "お子様のお名前は「"+text+"」ですね。次に、お子様の生年月日を数字で返信してください。例）2020年01月30日生まれの場合、20210130と入力してください。"
                      }
                    ]
                  })//close json
                  //SET Name Value
                  await redis_client.hset(userId,'Name',text, (err, reply) => {
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
                        "text": "申し訳ございません。お子様のお名前を全角カナで返信してください。例）西沢未来の場合「ニシザワミライ」"
                      }
                    ]
                  })//close json
                }// close ZenkakuKana
              };//CASE1
            //BirthDay
            case 2:
              if(isBirthdayNum(text)){
                dataString = JSON.stringify({
                  replyToken: req.body.events[0].replyToken,
                  messages: [
                    {
                      "type": "text",
                      "text": "お子様の誕生日は「"+text+"」ですね。次に、お子様のアレルギーの有無を返信してください。例）有りの場合「はい」、無しの場合「いいえ」"
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
                      "text": "申し訳ございません。お子様の生年月日を数字で返信してください。例）2020年01月30日生まれの場合、20210130と返信してください。"
                    }
                  ]
                })//close json
              }// close ZenkakuKana
            ;
            //Allergy
            case 3:
              if(hasAllergyValidation(text)){
                dataString = JSON.stringify({
                  replyToken: req.body.events[0].replyToken,
                  messages: [
                    {
                      "type": "text",
                      "text": "お子様の誕生日は「"+text+"」ですね。次に、お子様のアレルギーの有無を返信してください。例）有りの場合「はい」、無しの場合「いいえ」"
                    }
                  ]
                })//close json
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
              }else{
                dataString = JSON.stringify({
                  replyToken: req.body.events[0].replyToken,
                  messages: [
                    {
                      "type": "text",
                      "text": "申し訳ございません。再度、お子様のアレルギーの有無を返信してください。例）ありの場合「はい」、なしの場合「いいえ」"
                    }
                  ]
                })//close json
              }// close ZenkakuKana
            ;
            case 4:
              let regsiter_informations
              await redis_client.hgetall(userId, (err, reply) => {
                if (err) throw err;
                console.log('REG all:'+reply);
                regsiter_informations = reply
              });
              Object.entries(regsiter_informations).forEach(([k, v]) => { // ★
                  console.log({k, v});
              });
            ;
            default:
              console.log('Nothing to do in switch ') 
            ;
          }  
        }else{
          //通常Message
          dataString = JSON.stringify({
            replyToken: req.body.events[0].replyToken,
            messages: [
              {
                "type": "text",
                "text": "こんにちは！みらいくの病児保育予約システムです。\n▶予約の開始は「予約」\n▶予約内容の確認は「予約確認」\n▶各園の予約状況を確認は「カレンダー」\nと入力してください。"
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
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));

showTimes = () => {
  let result = '';
  const times = process.env.TIMES || 5;
  for (i = 0; i < times; i++) {
    result += i + ' ';
  }
  return result;
}

function isZenkakuKana(s) {
  return !!s.match(/^[ァ-ヶー　]*$/);  // 「　」は全角スペース
}

function isBirthdayNum(s){
  if(s.match(/^[0-9]+$/) && s.length==8){
    return true
  }else{
    return false
  }
}

function hasAllergyValidation(s){
  if(s === 'はい' || s === 'いいえ'){
    return true
  }else{
    return false
  }
}

function insertMember(s) {

}