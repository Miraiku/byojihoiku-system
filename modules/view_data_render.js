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
const view = require('./view_data_render');
const e = require('connect-flash');
const { off } = require('process');
const { all } = require('./line_receiver');

//home view
exports.getNurseryStatus3Days = async function (req, res){
  try {
    /*　未処理の予約 */
    let all_unread_list = []
    const list = await psgl.getReservationConfirmationFalseGraterThanToday() 
    if(list.length > 0){
      for (const member of list) {
        const name = await psgl.getMemberNameByMemberID(member[0].MemberID)
        const miraikuid = await psgl.getMiraikuIDByMemberID(member[0].MemberID)
        let birthday = await psgl.getMemberBirthDayByID(member[0].MemberID)
        birthday = view.getAgeMonth(birthday[0].BirthDay)
        const disease = await psgl.getDiseaseNameFromUniqueID(member[0].DiseaseID)
        const first = await psgl.getNurseryNameByID(member[0].firstNursery)
        let rsvdate = view.getDateformatFromPsglTimeStamp(member[0].ReservationDate)
        let second,third
        try {
          second = await psgl.getNurseryNameByID(member[0].secondNursery)
          second = second[0].NurseryName
        } catch (error) {
          //NurseryID = 0
          second = 'なし'
        }
        try {
          third = await psgl.getNurseryNameByID(member[0].thirdNursery)
          third = third[0].NurseryName
        } catch (error) {
          //NurseryID = 0
          third = 'なし'
        }
        all_unread_list.push({memberid:member[0].MemberID, id:miraikuid[0].MiraikuID, name:name[0].Name, date:rsvdate,  birthday:birthday, disease:disease[0].DiseaseName, first:first[0].NurseryName, second:second, third:third})
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
    res.render("pages/home/index", {Status3Days: status3days, AllUnread: all_unread_list})
  } catch (error) {
    console.log("ERR @getNurseryStatus3Days: "+ error)
    res.render("pages/index")
  }
}

//member view
exports.getMembersPage = async function (req, res){
  try {
    let mem =[]
    let members = await psgl.getMembers()
    for (const m of members) {
      let id
      if(m.MiraikuID == undefined){
        id = '未付与'
      }else{
        id = m.MiraikuID
      }
      let name = m.Name
      let birthday = view.getSlashDateFromt8Number(m.BirthDay)
      let age = view.getAgeMonth(m.BirthDay)
      let allergy = m.Allergy
      if(allergy){
        allergy = '有り'
      }else{
        allergy = '無し'
      }
      mem.push({miraikuid:id, name:name, birthday:birthday, age:age, allergy:allergy, memberid:m.ID})
    }
    res.render("pages/member/index", {Members:mem})
  } catch (error) {
    console.log("ERR @MembersPage: "+ error)
    res.redirect('/home')
  }
}

//member/entry view
exports.getEntryPage = async function (req, res){
  try {
    const memberid = req.params.id
    let info = await psgl.getMemberInfoByMemberID(memberid)
    let mem =[]
    let id
    if(info[0].MiraikuID == undefined){
      id = ''
    }else{
      id = info[0].MiraikuID
    }
    let name = info[0].Name
    let birthday = view.getSlashDateFromt8Number(info[0].BirthDay)
    let bYear = info[0].BirthDay.substr( 0, 4 )
    let bMonth = info[0].BirthDay.substr( 4, 2 )
    let bDay = info[0].BirthDay.substr( 6, 2 )
    let age = view.getAgeMonth(info[0].BirthDay)
    let allergy = info[0].Allergy
    mem.push({miraikuid:id, name:name, birthday:birthday, bYear:bYear, bMonth:bMonth, bDay:bDay, age:age, allergy:allergy, memberid:info[0].ID})
    res.render("pages/member/entry",{Member:info})
  } catch (error) {
    console.log("ERR @getEntryPage: "+ error)
    res.redirect('/member')
  }
}

//calendar view
exports.getCalendarPage = async function (req, res){
  try {
    //園ごとの日付
    let calendarData = []
    const nursery_list = await psgl.getNurseryID_Name_Capacity()
    for(let i = 0; i < nursery_list.length; i++){
      let today = await psgl.ReservedTodayByNursery(nursery_list[i].id)
      let tomorrow = await psgl.ReservedTomorrowByNursery(nursery_list[i].id)
      let dayaftertomorrow = await psgl.ReservedDayAfterTomorrowByNursery(nursery_list[i].id)
      console.log(typeof today[0])
      console.log(nursery_list[i].capacity - today[0].count)
      console.log(nursery_list[i].capacity - tomorrow[0].count)
      console.log(nursery_list[i].capacity - dayaftertomorrow[0].count)
      calendarData.push({id:nursery_list[i].id, name:nursery_list[i].name, today:today_data, tomorrow:tomorrow_data, dayaftertomorrow:dayaftertomorrow_data})
    }// end for nursery list
    res.render("pages/calendar/index",{calendarData:calendarData})
  } catch (error) {
    console.log("ERR @getCalendarPage: "+ error)
    res.redirect('/')
  }
}

function DayToJPFromDateObj(dt){
  //2021/11/2(火)
  var y = dt.getFullYear()
  var m = ('00' + (dt.getMonth()+1)).slice(-2);
  var d = ('00' + dt.getDate()).slice(-2);
  var w = [ "日", "月", "火", "水", "木", "金", "土" ][dt.getDay()]
  return (y + '/' + m + '/' + d + '('+w+')');
}

exports.getAgeMonth = function (eightBirthdayNumber){
  let str_birthday = String(eightBirthdayNumber)
  let bYear = Number(str_birthday.substr( 0, 4 ))
  let bMonth = Number(str_birthday.substr( 4, 2 ))
  let bDay = Number(str_birthday.substr( 6, 2 ))
  /// 現在日時と誕生日日時のDateを取得
  let dateNow = new Date();
  let dateBirth = new Date(bYear, bMonth-1, bDay);
 
  /// 現在日時までのミリ秒と日数を計算
  let timeTillNow = dateNow.getTime() - dateBirth.getTime(); 
  let daysTillNow = timeTillNow / (1000 * 3600 * 24); 
  
  /// 年齢の年部分・月部分・日部分をそれぞれ計算
  const DAYS_PER_MONTH = 365 / 12;
  let ageY = Math.floor(daysTillNow / 365);
  let ageM = Math.floor((daysTillNow - 365*ageY) / DAYS_PER_MONTH);
  let ageD = Math.floor((daysTillNow - 365*ageY - DAYS_PER_MONTH*ageM));
  return ageY+"歳"+ageM+"ヶ月"//+ageD+"日"
}

exports.getDateformatFromPsglTimeStamp = function (dataobj){
  //2021-12-21T15:00:00.000Z -> 2021/01/01(月)
  let date = new Date(dataobj);
  return date.getFullYear() + '/' + ('0' + (date.getMonth() + 1)).slice(-2) + '/' +('0' + date.getDate()).slice(-2)  + '('+[ "日", "月", "火", "水", "木", "金", "土" ][date.getDay()]+')'
}

exports.getSlashDateFromt8Number = function (num){
//20221122 -> 2022/11/22
let s = String(num)
return Number(s.substr( 0, 4 ))+'/'+Number(s.substr( 4, 2 ))+'/'+Number(s.substr( 6, 2 ))
}