const express = require('express');
const router = express.Router()
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
const https = require("https");
const psgl = require('./db_postgre');
const e = require('connect-flash');

exports.getMemberNameByMemberID = async function (req, res){
  try {
    const nursery_list = await psgl.getNurseryID_Name_Capacity();
    let status3days = []
    for(let i = 0; i < nursery_list.length; i++){
      let Unread = 0
      let Cancelled = 0
      let Waiting = 0
      let Rejected = 0
      let Reserved = 0
      for (const status of await psgl.ReservationStatus3DaysByNursery(nursery_list[i].id)) {
        if(status.ReservationStatus == 'Unread'){
          Unread += 1
        }else if(status.ReservationStatus == 'Cancelled'){
          Cancelled += 1
        }else if(status.ReservationStatus == 'Waiting'){
          Waiting += 1
        }else if(status.ReservationStatus == 'Rejected'){
          Rejected += 1
        }else if(status.ReservationStatus == 'Reserved'){
          Reserved += 1
        }
      }
      status3days.push({id:nursery_list[i].id, name:nursery_list[i].name, unread:Unread, cancelled:Cancelled, waiting:Waiting, rejected:Rejected, reserved:Reserved})
    }
    for (const status of status3days) {
      console.log(status)
    }
    
    res.render("pages/home/index")//, {todoDbList: results.rows}
  } catch (error) {
    console.log("ERR @getMemberNameByMemberID: "+ error)
  }
  //get nursery and date count today tomorrow
  //CURRENT_DATE + 2 AS DAYAFTERTOMORROW
  //1.Reserved（予約完了）
  //2. Unread（看護師未確認）,Waiting（看護師確認済かつ看護師が受入可能と判断し、キャンセル待ち登録が完了）
  //3. Rejected（看護師確認済、かつ看護師が対応不可と判断した状態）,Canceled（リマインダーで当日返信が来ない人）
  //All Nursery , Unread
  /**
   * pool.query(sql, (error, results) => {
          if (error) {
              throw error;
          }
          res.render("allItemInfo.ejs", {todoDbList: results.rows})
      })
   */
}