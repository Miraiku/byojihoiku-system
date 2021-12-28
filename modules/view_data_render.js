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
    res.render("pages/home/index", {Status3Days: status3days})
  } catch (error) {
    res.render("pages/index")
    console.log("ERR @getMemberNameByMemberID: "+ error)
  }
}