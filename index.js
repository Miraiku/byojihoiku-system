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
const client = new Redis(process.env.REDIS_URL);

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
      const client = await pool.connect();
      const result = await client.query('SELECT * FROM test_table');
      const results = { 'results': (result) ? result.rows : null};
      res.render('pages/db', results );
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  .post("/webhook", async (req, res) => {
    const text = req.body.events[0].message.text
    const userId = req.body.events[0].source.userId

    res.send("HTTP POST request sent to the webhook URL!")
    // ユーザーがボットにメッセージを送った場合、返信メッセージを送る
    if (req.body.events[0].type === "message") {
      let dataString
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
        try {
          const client = await pool.connect(); 
          let queryString = `INSERT INTO public."Member" ("MiraikuID","LINEID","BirthDay","Name","Allergy") VALUES(
          '', '`+userId+`', '11111111', ' ヨダミナミ', 'true')`;
          const result = await client.query(queryString);

          const results = { 'results': (result) ? result.rows : null};
          console.log(results);
          client.release();
        } catch (err) {
          console.error(err);
        }
      }else if(text === "d"){
        dataString = JSON.stringify({
            replyToken: req.body.events[0].replyToken,
            messages: [
              {
                "type": "text",
                "text": userId
              },{
                "type": "text",
                "text": req.body.events[0].replyToken
              }
            ]
          })
  
        client.set(userId, text, (err, reply) => {
          if (err) throw err;
          console.log(reply);
  
          client.get(userId, (err, reply) => {
              if (err) throw err;
              console.log(reply);
          });
        });
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
  
      }
  
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