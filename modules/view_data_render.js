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
const { off } = require('process');
const { all } = require('./line_receiver');

exports.getNurseryStatus3Days = async function (req, res){
  try {
    /*　未処理の予約 */
    let all_unread_list = []
    const list = await psgl.getReservationStatusUnreadGraterThanToday() 
    if(list.length > 0){
      for (const member of list) {
        const name = await psgl.getMemberNameByMemberID(member.MemberID)
        const birthday = await psgl.getMemberBirthDayByID(member.MemberID)
        const disease = await psgl.getDiseaseNameFromID(member.DiseaseID)
        const first = await psgl.getNurseryNameByID(member.firstNursery)
        let second,third
        try {
          second = await psgl.getNurseryNameByID(member.secondNursery)
        } catch (error) {
          //NurseryID = 0
          second = 'なし'
        }
        try {
          third = await psgl.getNurseryNameByID(member.thirdNursery)
        } catch (error) {
          //NurseryID = 0
          third = 'なし'
        }
        all_unread_list.push({name:name[0].Name, birthday:birthday[0].BirthDay, disease:disease[0].DiseaseName, first:first[0].NurseryName, second:second, third:third})
      }
    }

    /*　各園の3日間の状況 */
    let status3days = []
    const nursery_list = await psgl.getNurseryID_Name_Capacity()
    const JST = new Date().toLocaleString({ timeZone: 'Asia/Tokyo' })
    const today_JST = new Date(JST)
    const tomorrow_JST = new Date(today_JST);
    tomorrow_JST.setDate(tomorrow_JST.getDate() + 1);
    const dayaftertomorrow_JST = new Date(today_JST);
    dayaftertomorrow_JST.setDate(dayaftertomorrow_JST.getDate() + 2);
    let today_data, tomorrow_data, dayaftertomorrow_data
    for(let i = 0; i < nursery_list.length; i++){
      let todayStatus = await psgl.ReservationStatusTodayByNursery(nursery_list[i].id)
      if(todayStatus.length > 0){
        for (const status of todayStatus) {
          let Unread = 0
          let Cancelled = 0
          let Waiting = 0
          let Rejected = 0
          let Reserved = 0
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
          today_data = {date:DayToJPFromDateObj(today_JST), unread:Unread, cancelled:Cancelled, waiting:Waiting, rejected:Rejected, reserved:Reserved}
        }
      }else{
        today_data = {date:DayToJPFromDateObj(today_JST), unread:0, cancelled:0, waiting:0, rejected:0, reserved:0}
      }
      let tomorrowStatus = await psgl.ReservationStatusTomorrowByNursery(nursery_list[i].id)
      if(tomorrowStatus.length > 0){
        for (const status of await psgl.ReservationStatusTomorrowByNursery(nursery_list[i].id)) {
          let Unread = 0
          let Cancelled = 0
          let Waiting = 0
          let Rejected = 0
          let Reserved = 0
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
          tomorrow_data = {date:DayToJPFromDateObj(tomorrow_JST), unread:Unread, cancelled:Cancelled, waiting:Waiting, rejected:Rejected, reserved:Reserved}
        }
      }else{
        tomorrow_data = {date:DayToJPFromDateObj(tomorrow_JST), unread:0, cancelled:0, waiting:0, rejected:0, reserved:0}
      }
      let dayaftertomorrowStatus = await psgl.ReservationStatusDayAfterTomorrowByNursery(nursery_list[i].id)
      if(dayaftertomorrowStatus.length > 0){
        for (const status of await psgl.ReservationStatusDayAfterTomorrowByNursery(nursery_list[i].id)) {
          let Unread = 0
          let Cancelled = 0
          let Waiting = 0
          let Rejected = 0
          let Reserved = 0
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
          dayaftertomorrow_data = {date:DayToJPFromDateObj(dayaftertomorrow_JST), unread:Unread, cancelled:Cancelled, waiting:Waiting, rejected:Rejected, reserved:Reserved}
        }
      }else{
        dayaftertomorrow_data = {date:DayToJPFromDateObj(dayaftertomorrow_JST), unread:0, cancelled:0, waiting:0, rejected:0, reserved:0}
      }
      status3days.push({id:nursery_list[i].id, name:nursery_list[i].name, today:today_data, tomorrow:tomorrow_data, dayaftertomorrow:dayaftertomorrow_data})
    }// end for nursery list
    console.log(all_unread_list[0])
    res.render("pages/home/index", {Status3Days: status3days, AllUnread: all_unread_list[0]})
  } catch (error) {
    console.log("ERR @getMemberNameByMemberID: "+ error)
    res.render("pages/index")
  }
}

function DayToJPFromDateObj(dt){
  //2021/11/2(火)
  var y = dt.getFullYear();
  var m = ('00' + (dt.getMonth()+1)).slice(-2);
  var d = ('00' + dt.getDate()).slice(-2);
  var w = [ "日", "月", "火", "水", "木", "金", "土" ][dt.getDay()]
  return (y + '/' + m + '/' + d + '('+w+')');
}
