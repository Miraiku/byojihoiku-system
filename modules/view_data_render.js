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
const psgl = require('./db_postgre')

exports.getMemberNameByMemberID = async function (req, res){
  try {
    const nursery_list = await psgl.getNurseryID_Name_Capacity();
    let status3days = []
    for(let i = 0; i < nursery_list.length; i++){
      status3days.push(await psgl.ReservationStatus3DaysByNursery(nursery_list[i].id))
      console.log(status3days)
    }
    if (error) {
      throw error;
  }
    res.render("pages/home/index", {todoDbList: results.rows})
  } catch (error) {
    
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