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
const redis = require('./db_redis')
const psgl = require('./db_postgre');
const view = require('./view_data_render');
const login = require('./view_login')
const Holidays = require('date-holidays');
const holiday = new Holidays('JP')
holiday.setTimezone(process.env.TZ)
holiday.setHoliday('12-29', 'miraiku-holiday')
holiday.setHoliday('12-30', 'miraiku-holiday')
holiday.setHoliday('12-31', 'miraiku-holiday')
holiday.setHoliday('01-01', 'miraiku-holiday')
holiday.setHoliday('01-02', 'miraiku-holiday')
holiday.setHoliday('01-03', 'miraiku-holiday')

//login page
exports.getLoginPage = async function (req, res){
  try {
    const sub_title = 'ログイン'
    /* トップ専用ログイン確認 */
    let isLogined = false
    if(req.session.token && req.session.name){
      const userSession = {token: req.session.token, name: req.session.name}
      isLogined = await login.authenticate(userSession)
    }
    if (isLogined) {
      res.redirect('/home')
    }else{
      res.render("pages/index",{SubTitle:''})
    }
  } catch (error) {
    console.log("ERR @getLoginPage: "+ error)
    res.redirect('/logout')
  }
}

//register page
exports.getRegisterPage = async function (req, res){
  try {
    /* ログイン確認 */
    let isLogined = false
    if(req.session.token && req.session.name){
      const userSession = {token: req.session.token, name: req.session.name}
      isLogined = await login.authenticate(userSession)
    }
    if (!isLogined) {
      res.render('/logout')
    }else{
      res.render("pages/function/register",{SubTitle:'会員登録　｜　'})
    }
    /* ログイン確認終了 */
  } catch (error) {
    console.log("ERR @getRegisterPage: "+ error)
    res.redirect('/logout')
  }
}


//logout page
exports.getLogout = async function (req, res){
  try {
    if(req.session){
      req.session = null
    }
    res.redirect('/')
  } catch (error) {
    console.log("ERR @getLogout: "+ error)
    res.redirect('/')
  }
}

//home view
exports.getNurseryStatus3Days = async function (req, res){
  try {
    /* ログイン確認 */
    let isLogined = false
    if(req.session.token && req.session.name){
      const userSession = {token: req.session.token, name: req.session.name}
      isLogined = await login.authenticate(userSession)
    }
    if (!isLogined) {
      res.redirect('/logout')
    }
    /* ログイン確認終了 */
    /*　未処理の予約 */
    let all_unread_list = []
    const list = await psgl.getReservationConfirmationFalseGraterThanToday() 
    if(list.length > 0){
      for (const member of list) {
        const status = await psgl.getReservationInfoByReservationID(member[0].ID)
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
        all_unread_list.push({rsvid:member[0].ID, memberid:member[0].MemberID, id:miraikuid[0].MiraikuID, name:name[0].Name, date:rsvdate, rsvstatus:status[0].ReservationStatus,  birthday:birthday, disease:disease[0].DiseaseName, first:first[0].NurseryName, second:second, third:third})
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
        let Unread = 0
        let Cancelled = 0
        let Waiting = 0
        let Rejected = 0
        let Reserved = 0
        for (const status of todayStatus) {
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
        let Unread = 0
        let Cancelled = 0
        let Waiting = 0
        let Rejected = 0
        let Reserved = 0
        for (const status of await psgl.ReservationStatusTomorrowByNursery(nursery_list[i].id)) {
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
        let Unread = 0
        let Cancelled = 0
        let Waiting = 0
        let Rejected = 0
        let Reserved = 0
        for (const status of await psgl.ReservationStatusDayAfterTomorrowByNursery(nursery_list[i].id)) {
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
    res.render("pages/home/index", {Status3Days: status3days, AllUnread: all_unread_list, SubTitle:'予約情報　｜　'})
  } catch (error) {
    console.log("ERR @getNurseryStatus3Days: "+ error)
    res.redirect('/logout')
  }
}

//member view
exports.getMembersPage = async function (req, res){
  try {
    /* ログイン確認 */
    let isLogined = false
    if(req.session.token && req.session.name){
      const userSession = {token: req.session.token, name: req.session.name}
      isLogined = await login.authenticate(userSession)
    }
    if (!isLogined) {
      res.redirect('/logout')
    }
    /* ログイン確認終了 */

    const sub_title = '会員情報　｜　'
    let mem =[]

    /*全員 */
    /*
    let members = await psgl.getMembersOrderByName()
    for (const m of members) {
      let id
      if(m.MiraikuID == 0){
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
    */

    /*　新規メンバー */
    
    let members = await psgl.getNoIDMembersOrderByName()
    let newmembers = []
    for (const m of members) {
      let id
      if(m.MiraikuID == 0){
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
      newmembers.push({miraikuid:id, name:name, birthday:birthday, age:age, allergy:allergy, memberid:m.ID})
    }
    /* get Year for Tab */
    const today = new Date()
    //年度が変わったら１年繰り上げ
    let i = 0
    if(today.getMonth() >= 3){
      i = 2
    }else{
      i = 1
    }
    let year10 = []
    for (i = 1; i <= 12; i++) {
      const y = String(today.getFullYear()-i).toString().substr(-2)
      let result = await psgl.getYearMembersOrderByName(y)
      let mem = []
      for (const m of result) {
        let id
        if(m.MiraikuID == 0){
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
      year10.push({year:today.getFullYear()-i, members:mem})
    }
    res.render("pages/member/index", {SubTitle:sub_title,Year10:year10, NewMembers:newmembers})//Members:mem,
  } catch (error) {
    console.log("ERR @MembersPage: "+ error)
    res.redirect('/home/')
  }
}

//member/entry view
exports.getEntryPage = async function (req, res){
  try {
    /* ログイン確認 */
    let isLogined = false
    if(req.session.token && req.session.name){
      const userSession = {token: req.session.token, name: req.session.name}
      isLogined = await login.authenticate(userSession)
    }
    if (!isLogined) {
      res.redirect('/logout')
    }
    /* ログイン確認終了 */
    let memberid = req.params.memberid
    memberid = view.zenkaku2Hankaku(memberid)
    if(!view.isValidNum(memberid)){
      throw new Error('invalid num')
    }
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
    let bYear = String(info[0].BirthDay).substr( 0, 4 )
    let bMonth = String(info[0].BirthDay).substr( 4, 2 )
    let bDay = String(info[0].BirthDay).substr( 6, 2 )
    let age = view.getAgeMonth(info[0].BirthDay)
    let allergy = info[0].Allergy
    const sub_title = name +'さま　会員情報の変更　｜　'
    mem.push({miraikuid:id, name:name, birthday:birthday, bYear:bYear, bMonth:bMonth, bDay:bDay, age:age, allergy:allergy, memberid:info[0].ID})
    res.render("pages/member/entry",{Member:mem,SubTitle:sub_title})
  } catch (error) {
    console.log("ERR @getEntryPage: "+ error)
    res.redirect('/member/')
  }
}

//calendar view
exports.getCalendarPage = async function (req, res){
  try {
    //園ごとの日付
    const JST = new Date().toLocaleString({ timeZone: 'Asia/Tokyo' })
    const day1_JST = new Date(JST)
    const day2_JST = new Date(day1_JST);
    day2_JST.setDate(day2_JST.getDate() + 1);
    const day3_JST = new Date(day1_JST);
    day3_JST.setDate(day3_JST.getDate() + 2);
    const day4_JST = new Date(day1_JST);
    day4_JST.setDate(day4_JST.getDate() + 3);
    const day5_JST = new Date(day1_JST);
    day5_JST.setDate(day5_JST.getDate() + 4);
    const day6_JST = new Date(day1_JST);
    day6_JST.setDate(day6_JST.getDate() + 5);
    const day7_JST = new Date(day1_JST);
    day7_JST.setDate(day7_JST.getDate() + 6);

    let day1,day2,day3,day4,day5,day6,day7
    let today_capa, tomorrow_capa, dayaftertomorrow_capa
    let calendarData = []
    let formattedWeek = []
    let formattedWeekDay = []
    formattedWeek.push({day1:MonthDayToJPFromDateObj(day1_JST),day2:MonthDayToJPFromDateObj(day2_JST),day3:MonthDayToJPFromDateObj(day3_JST),day4:MonthDayToJPFromDateObj(day4_JST),day5:MonthDayToJPFromDateObj(day5_JST),day6:MonthDayToJPFromDateObj(day6_JST),day7:MonthDayToJPFromDateObj(day7_JST)})
    formattedWeekDay.push({day1:WeekDayToJPFromDateObj(day1_JST),day2:WeekDayToJPFromDateObj(day2_JST),day3:WeekDayToJPFromDateObj(day3_JST),day4:WeekDayToJPFromDateObj(day4_JST),day5:WeekDayToJPFromDateObj(day5_JST),day6:WeekDayToJPFromDateObj(day6_JST),day7:WeekDayToJPFromDateObj(day7_JST)})
    const nursery_list = await psgl.getNurseryID_Name_Capacity()
    for(let i = 0; i < nursery_list.length; i++){
      if(holiday.isHoliday(day1_JST) ||day1_JST.getDay() == 0 ||  day1_JST.getDay() == 6){
        day1 = '休'
      }else{
        let tmp_cnt = await redis.hgetStatus(`reservation_line_tmp_count_by_nurseryid_${view.getTimeStampFrom8DayDataObj(day1_JST)}`, nursery_list[i].id)
        if(tmp_cnt == null){
          tmp_cnt = 0
        }
        let today = await psgl.ReservedTodayByNursery(nursery_list[i].id)
        let today_cnt = 0
        if(today.length < 0){
          today_cnt = today[0].count
        }
        today_capa = nursery_list[i].capacity - today_cnt - tmp_cnt
        if(today_capa> 0){
          day1 = '○'
        }else{
          day1 = '✕'
        }
      }

      if(holiday.isHoliday(day2_JST) ||day2_JST.getDay() == 0 ||  day2_JST.getDay() == 6){
        day2 = '休'
      }else{
        let tomorrow = await psgl.ReservedTomorrowByNursery(nursery_list[i].id)
        tmp_cnt = await redis.hgetStatus(`reservation_line_tmp_count_by_nurseryid_${view.getTimeStampFrom8DayDataObj(day2_JST)}`, nursery_list[i].id)
        if(tmp_cnt == null){
          tmp_cnt = 0
        }
        let tomorrow_cnt = 0
        if(tomorrow.length < 0){
          tomorrow_cnt = tomorrow[0].count
        }
        tomorrow_capa = nursery_list[i].capacity - tomorrow_cnt - tmp_cnt
        if(tomorrow_capa> 0){
          day2 = '○'
        }else{
          day2 = '✕'
        }
      }

      if(holiday.isHoliday(day3_JST) ||day3_JST.getDay() == 0 ||  day3_JST.getDay() == 6){
        day3 = '休'
      }else{
        let dayaftertomorrow = await psgl.ReservedDayAfterTomorrowByNursery(nursery_list[i].id)
        tmp_cnt = await redis.hgetStatus(`reservation_line_tmp_count_by_nurseryid_${view.getTimeStampFrom8DayDataObj(day3_JST)}`, nursery_list[i].id)
        if(tmp_cnt == null){
          tmp_cnt = 0
        }

        let dayaftertomorrow_cnt = 0
        if(dayaftertomorrow.length < 0){
          tomorrow_cnt = tomorrow[0].count
        }
        dayaftertomorrow_capa = nursery_list[i].capacity - dayaftertomorrow_cnt - tmp_cnt
        if(dayaftertomorrow_capa> 0){
          day3 = '○'
        }else{
          day3 = '✕'
        }
      }
    
      if(holiday.isHoliday(day4_JST) ||day4_JST.getDay() == 0 ||  day4_JST.getDay() == 6){
        day4 = '休'
      }else{
        day4 = '○'
      }

      if(holiday.isHoliday(day5_JST) ||day5_JST.getDay() == 0 ||  day5_JST.getDay() == 6){
        day5 = '休'
      }else{
        day5 = '○'
      }

      if(holiday.isHoliday(day6_JST) ||day6_JST.getDay() == 0 ||  day6_JST.getDay() == 6){
        day6 = '休'
      }else{
        day6 = '○'
      }
    
      if(holiday.isHoliday(day7_JST) ||day7_JST.getDay() == 0 ||  day7_JST.getDay() == 6){
        day7 = '休'
      }else{
        day7 = '○'
      }
      calendarData.push({id:nursery_list[i].id, name:nursery_list[i].name, day1:day1, day2:day2, day3:day3, day4:day4, day5:day5, day6:day6, day7:day7})
    }
    const sub_title = '空き状況カレンダー　｜　'
    res.render("pages/calendar/index",{calendarData:calendarData,formattedWeek:formattedWeek,formattedWeekDay:formattedWeekDay,SubTitle:sub_title})
  } catch (error) {
    console.log("ERR @getCalendarPage: "+ error)
    res.redirect('/')
  }
}

//reservation view
exports.getReservationPage = async function (req, res){
  try {
    /* ログイン確認 */
    let isLogined = false
    if(req.session.token && req.session.name){
      const userSession = {token: req.session.token, name: req.session.name}
      isLogined = await login.authenticate(userSession)
    }
    if (!isLogined) {
      res.redirect('/logout')
    }
    /* ログイン確認終了 */
    
    let nurseryid
    if(req.params.nurseryid != undefined){
      nurseryid = req.params.nurseryid
    }else if(req.query.nursery != undefined){
      nurseryid = req.query.nursery
    }else{
      throw new Error('no page')
    }
    nurseryid = view.zenkaku2Hankaku(nurseryid)
    if(!view.isValidNum(nurseryid)){
      throw new Error('invalid num')
    }

    /*　各園の3日間の状況 */
    const JST = new Date().toLocaleString({ timeZone: 'Asia/Tokyo' })
    const today_JST = new Date(JST)
    const tomorrow_JST = new Date(today_JST);
    tomorrow_JST.setDate(tomorrow_JST.getDate() + 1);
    const dayaftertomorrow_JST = new Date(today_JST);
    dayaftertomorrow_JST.setDate(dayaftertomorrow_JST.getDate() + 2);
    const nursery_name = await psgl.getNurseryNameByID(nurseryid)

    let today_data, tomorrow_data, dayaftertomorrow_data
    today_data = {date:MonthDayToJPFromDateObj(today_JST),day:WeekDayToJPFromDateObj(today_JST)}
    tomorrow_data = {date:MonthDayToJPFromDateObj(tomorrow_JST),day:WeekDayToJPFromDateObj(tomorrow_JST)}
    dayaftertomorrow_data = {date:MonthDayToJPFromDateObj(dayaftertomorrow_JST),day:WeekDayToJPFromDateObj(dayaftertomorrow_JST)}

    let status3days = []
    status3days.push({id:nurseryid, name:nursery_name[0].NurseryName, today:today_data, tomorrow:tomorrow_data, dayaftertomorrow:dayaftertomorrow_data})
    
    /*　予約確定・キャンセル待ち */
    let day1_reserved = []
    let day1_waiting = []
    const day1_reservedlist = await psgl.ReservedInfoTodayByNursery(nurseryid) 
    const day1_waitinglist = await psgl.WaitingInfoTodayByNursery(nurseryid) 
    if(day1_reservedlist.length > 0){
      for (const member of day1_reservedlist) {
        const name = await psgl.getMemberNameByMemberID(member[0].MemberID)
        const miraikuid = await psgl.getMiraikuIDByMemberID(member[0].MemberID)
        let birthday = await psgl.getMemberBirthDayByID(member[0].MemberID)
        birthday = view.getAgeMonth(birthday[0].BirthDay)
        const disease = await psgl.getDiseaseNameFromUniqueID(member[0].DiseaseID)
        const first = await psgl.getNurseryNameByID(member[0].firstNursery)
        let rsvdate = view.getDateformatFromPsglTimeStamp(member[0].ReservationDate)
        day1_reserved.push({rsvid:member[0].ID, memberid:member[0].MemberID, id:miraikuid[0].MiraikuID, name:name[0].Name, date:rsvdate,  birthday:birthday, disease:disease[0].DiseaseName, first:first[0].NurseryName})
      }
    }
    if(day1_waitinglist.length > 0){
      for (const member of day1_waitinglist) {
        let status = await psgl.getReservationStatusByID(member[0].ID)
        status = status[0].ReservationStatus
        const name = await psgl.getMemberNameByMemberID(member[0].MemberID)
        const miraikuid = await psgl.getMiraikuIDByMemberID(member[0].MemberID)
        let birthday = await psgl.getMemberBirthDayByID(member[0].MemberID)
        birthday = view.getAgeMonth(birthday[0].BirthDay)
        const disease = await psgl.getDiseaseNameFromUniqueID(member[0].DiseaseID)
        const first = await psgl.getNurseryNameByID(member[0].firstNursery)
        let rsvdate = view.getDateformatFromPsglTimeStamp(member[0].ReservationDate)
        
        day1_waiting.push({status:status, rsvid:member[0].ID, memberid:member[0].MemberID, id:miraikuid[0].MiraikuID, name:name[0].Name, date:rsvdate,  birthday:birthday, disease:disease[0].DiseaseName, first:first[0].NurseryName})
      }
    }

    let day2_reserved = []
    let day2_waiting = []
    const day2_reservedlist = await psgl.ReservedInfoTomorrowByNursery(nurseryid) 
    const day2_waitinglist = await psgl.WaitingInfoTomorrowByNursery(nurseryid) 
    if(day2_reservedlist.length > 0){
      for (const member of day2_reservedlist) {
        const name = await psgl.getMemberNameByMemberID(member[0].MemberID)
        const miraikuid = await psgl.getMiraikuIDByMemberID(member[0].MemberID)
        let birthday = await psgl.getMemberBirthDayByID(member[0].MemberID)
        birthday = view.getAgeMonth(birthday[0].BirthDay)
        const disease = await psgl.getDiseaseNameFromUniqueID(member[0].DiseaseID)
        const first = await psgl.getNurseryNameByID(member[0].firstNursery)
        let rsvdate = view.getDateformatFromPsglTimeStamp(member[0].ReservationDate)
        
        day2_reserved.push({rsvid:member[0].ID, memberid:member[0].MemberID, id:miraikuid[0].MiraikuID, name:name[0].Name, date:rsvdate,  birthday:birthday, disease:disease[0].DiseaseName, first:first[0].NurseryName})
      }
    }
    if(day2_waitinglist.length > 0){
      for (const member of day2_waitinglist) {
        let status = await psgl.getReservationStatusByID(member[0].ID)
        status = status[0].ReservationStatus
        const name = await psgl.getMemberNameByMemberID(member[0].MemberID)
        const miraikuid = await psgl.getMiraikuIDByMemberID(member[0].MemberID)
        let birthday = await psgl.getMemberBirthDayByID(member[0].MemberID)
        birthday = view.getAgeMonth(birthday[0].BirthDay)
        const disease = await psgl.getDiseaseNameFromUniqueID(member[0].DiseaseID)
        const first = await psgl.getNurseryNameByID(member[0].firstNursery)
        let rsvdate = view.getDateformatFromPsglTimeStamp(member[0].ReservationDate)
        
        day2_waiting.push({status:status,rsvid:member[0].ID, memberid:member[0].MemberID, id:miraikuid[0].MiraikuID, name:name[0].Name, date:rsvdate,  birthday:birthday, disease:disease[0].DiseaseName, first:first[0].NurseryName})
      }
    }

    let day3_reserved = []
    let day3_waiting = []
    const day3_reservedlist = await psgl.ReservedInfoDayAfterTomorrowByNursery(nurseryid) 
    const day3_waitinglist = await psgl.WaitingInfoDayAfterTomorrowByNursery(nurseryid) 
    if(day3_reservedlist.length > 0){
      for (const member of day3_reservedlist) {
        const name = await psgl.getMemberNameByMemberID(member[0].MemberID)
        const miraikuid = await psgl.getMiraikuIDByMemberID(member[0].MemberID)
        let birthday = await psgl.getMemberBirthDayByID(member[0].MemberID)
        birthday = view.getAgeMonth(birthday[0].BirthDay)
        const disease = await psgl.getDiseaseNameFromUniqueID(member[0].DiseaseID)
        const first = await psgl.getNurseryNameByID(member[0].firstNursery)
        let rsvdate = view.getDateformatFromPsglTimeStamp(member[0].ReservationDate)
        
        day3_reserved.push({rsvid:member[0].ID, memberid:member[0].MemberID, id:miraikuid[0].MiraikuID, name:name[0].Name, date:rsvdate,  birthday:birthday, disease:disease[0].DiseaseName, first:first[0].NurseryName})
      }
    }
    if(day3_waitinglist.length > 0){
      for (const member of day3_waitinglist) {
        let status = await psgl.getReservationStatusByID(member[0].ID)
        status = status[0].ReservationStatus
        console.log(status)
        const name = await psgl.getMemberNameByMemberID(member[0].MemberID)
        const miraikuid = await psgl.getMiraikuIDByMemberID(member[0].MemberID)
        let birthday = await psgl.getMemberBirthDayByID(member[0].MemberID)
        birthday = view.getAgeMonth(birthday[0].BirthDay)
        const disease = await psgl.getDiseaseNameFromUniqueID(member[0].DiseaseID)
        const first = await psgl.getNurseryNameByID(member[0].firstNursery)
        let rsvdate = view.getDateformatFromPsglTimeStamp(member[0].ReservationDate)
        
        day3_waiting.push({status:status, rsvid:member[0].ID, memberid:member[0].MemberID, id:miraikuid[0].MiraikuID, name:name[0].Name, date:rsvdate,  birthday:birthday, disease:disease[0].DiseaseName, first:first[0].NurseryName})
      }
    }
    const sub_title = nursery_name[0].NurseryName +'病児保育室　予約情報　｜　'
    const nursery_list = await psgl.getNurseryID_Name_Capacity()
    res.render("pages/reservation/index", {Status3Days: status3days, Nurserys:nursery_list, Day1Rsv:day1_reserved, Day2Rsv:day2_reserved, Day3Rsv:day3_reserved, Day1Wait:day1_waiting, Day2Wait:day2_waiting,Day3Wait:day3_waiting,SubTitle:sub_title})
  } catch (error) {
    console.log("ERR @getReservationPage: "+ error)
    res.redirect('/home/')
  }
}

//reservation/confirm view
exports.getReservationConfirmPage = async function (req, res){
  let prev
  try {
    /* ログイン確認 */
    let isLogined = false
    if(req.session.token && req.session.name){
      const userSession = {token: req.session.token, name: req.session.name}
      isLogined = await login.authenticate(userSession)
    }
    if (!isLogined) {
      res.redirect('/logout')
    }
    /* ログイン確認終了 */
    
    prev = req.query.nursery
    const reservationid = req.params.reservationid
    if(!view.isValidNum(reservationid)){
      throw new Error('invalid num')
    }
    let info = []
    const rsv = await psgl.getReservationInfoByReservationID(reservationid)
    const rsv_details = await psgl.getReservationDetailsByReservationID(reservationid)
    const name = await psgl.getMemberNameByMemberID(rsv[0].MemberID)
    const miraikuid = await psgl.getMiraikuIDByMemberID(rsv[0].MemberID)
    let age = await psgl.getMemberBirthDayByID(rsv[0].MemberID)
    age = view.getAgeMonth(age[0].BirthDay)
    const disease = await psgl.getDiseaseNameFromUniqueID(rsv_details[0].DiseaseID)
    let rsvdate = view.getDateformatFromPsglTimeStamp(rsv[0].ReservationDate)
    const intime = view.getHoursJPFormattedFromDayDataObj(rsv_details[0].InTime)
    const outtime = view.getHoursJPFormattedFromDayDataObj(rsv_details[0].OutTime)
    const nursery = await psgl.getNurseryNameByID(rsv[0].NurseryID)
    let status
    if(rsv[0].ReservationStatus == 'Reserved'){
      status = '予約確定'
    }else if(rsv[0].ReservationStatus == 'Waiting'){
      status = 'キャンセル待ち'
    }else if(rsv[0].ReservationStatus == 'Rejected'){
      status = '対応不可'
    }else if(rsv[0].ReservationStatus == 'Cancelled'){
      status = 'キャンセル'
    }else if(rsv[0].ReservationStatus == 'Unread'){
      status = '看護師の最終確認待ち'
    }
    const parent_name = rsv_details[0].ParentName
    const parent_tel = rsv_details[0].ParentTel
    let lineid = await psgl.getLINEIDByMemberID(rsv[0].MemberID)
    const sameday_members = await psgl.getReservedMemberIDOnTheDay(view.getPsglTimeStampFromDayDataObj(rsv[0].ReservationDate))

    let bros_num = 0
    if(sameday_members.length > 0){
      for (const m of sameday_members) {
        let mem = await psgl.getLINEIDByMemberID(m.MemberID)
        if(mem.length > 0 && mem[0].LINEID == lineid[0].LINEID){
          bros_num += 1
        }
      }
    }
    if(bros_num > 1){
      brothers = '有り'
    }else{
      brothers = '無し'
    }
    const meal = await psgl.getMealNameFromMainID(rsv_details[0].MealType)
    const meal_details = await psgl.getMealNameFromSubID(rsv_details[0].MealDetails)
    let cramps
    if(rsv_details[0].Cramps == 'false'){
      cramps = '無し'
    }else{
      cramps = rsv_details[0].Cramps
    }
    let allergy
    if(rsv_details[0].Allergy == 'false'){
      allergy = '無し'
    }else{
      allergy = rsv_details[0].Allergy
    }
    const sub_title = name[0].Name +'さま　予約情報　｜　'
    info.push({rsvid:reservationid, prev:prev, name:name[0].Name, miraikuid:miraikuid[0].MiraikuID, age:age, disease:disease[0].DiseaseName, rsvdate:rsvdate, intime:intime, outtime:outtime, nursery:nursery[0].NurseryName , status:status, parent_name:parent_name, parent_tel:parent_tel, brothers:brothers, meal:meal[0].MealName, meal_details:meal_details[0].MealName, cramps:cramps, allergy:allergy})
    res.render("pages/reservation/confirm",{Info:info,SubTitle:sub_title})
  } catch (error) {
    console.log("ERR @getReservationConfirmPage: "+ error)
    if(prev != null){
      res.redirect('/reservation/?nursery='+prev)
    }else{
      res.redirect('/home')
    }
  }
}


//reservation/entry view
exports.getReservationEntryPage = async function (req, res){
  let prev
  try {
    /* ログイン確認 */
    let isLogined = false
    if(req.session.token && req.session.name){
      const userSession = {token: req.session.token, name: req.session.name}
      isLogined = await login.authenticate(userSession)
    }
    if (!isLogined) {
      res.redirect('/logout')
    }
    /* ログイン確認終了 */
    prev = req.query.nursery
    const reservationid = req.params.reservationid
    if(!view.isValidNum(reservationid)){
      throw new Error('invalid num')
    }
    let info = []
    const rsv = await psgl.getReservationInfoByReservationID(reservationid)
    const rsv_details = await psgl.getReservationDetailsByReservationID(reservationid)
    const name = await psgl.getMemberNameByMemberID(rsv[0].MemberID)
    const miraikuid = await psgl.getMiraikuIDByMemberID(rsv[0].MemberID)
    let age = await psgl.getMemberBirthDayByID(rsv[0].MemberID)
    age = view.getAgeMonth(age[0].BirthDay)
    const disease = await psgl.getDiseaseNameFromUniqueID(rsv_details[0].DiseaseID)
    let rsvdate = view.getDateformatFromPsglTimeStamp(rsv[0].ReservationDate)
    const intime_hour = view.getHourJPFormattedFromDayDataObj(rsv_details[0].InTime)
    const outtime_hour = view.getHourJPFormattedFromDayDataObj(rsv_details[0].OutTime)
    const intime_mins = view.getMinsJPFormattedFromDayDataObj(rsv_details[0].InTime)
    const outtime_mins = view.getMinsJPFormattedFromDayDataObj(rsv_details[0].OutTime)
    const nursery = await psgl.getNurseryNameByID(rsv[0].NurseryID)
    let status
    if(rsv[0].ReservationStatus == 'Reserved'){
      status = '予約確定'
    }else if(rsv[0].ReservationStatus == 'Waiting'){
      status = 'キャンセル待ち'
    }else if(rsv[0].ReservationStatus == 'Rejected'){
      status = '対応不可'
    }else if(rsv[0].ReservationStatus == 'Cancelled'){
      status = 'キャンセル'
    }else if(rsv[0].ReservationStatus == 'Unread'){
      status = '看護師の最終確認待ち'
    }
    const parent_name = rsv_details[0].ParentName
    const parent_tel = rsv_details[0].ParentTel
    let lineid = await psgl.getLINEIDByMemberID(rsv[0].MemberID)
    const sameday_members = await psgl.getReservedMemberIDOnTheDay(view.getPsglTimeStampFromDayDataObj(rsv[0].ReservationDate))

    let bros_num = 0
    if(sameday_members.length > 0){
      for (const m of sameday_members) {
        let mem = await psgl.getLINEIDByMemberID(m.MemberID)
        if(mem.length > 0 && mem[0].LINEID == lineid[0].LINEID){
          bros_num += 1
        }
      }
    }
    if(bros_num > 1){
      brothers = '有り'
    }else{
      brothers = '無し'
    }
    
    const meal = await psgl.getMealNameFromMainID(rsv_details[0].MealType)
    const meal_details = await psgl.getMealNameFromSubID(rsv_details[0].MealDetails)
    let cramps
    if(rsv_details[0].Cramps == 'false'){
      cramps = '無し'
    }else{
      cramps = rsv_details[0].Cramps
    }
    let allergy
    if(rsv_details[0].Allergy == 'false'){
      allergy = '無し'
    }else{
      allergy = rsv_details[0].Allergy
    }
    const allergy_bool = await psgl.getMemberAllergyByMemberID(rsv[0].MemberID)
    const disease_list = await psgl.getDiseaseList()
    const meal_list = await psgl.getMainMealList()
    const meal_details_list = await psgl.getSubMealList()
    const nursery_list = await psgl.getNurseryID_Name_Capacity()
    const sub_title = name[0].Name +'さま　予約情報の変更　｜　'
    info.push({allergy_bool:allergy_bool[0].Allergy, disease_list:disease_list, meal_list:meal_list,meal_details_list:meal_details_list, nursery_list:nursery_list, rsvid:reservationid, prev:prev, name:name[0].Name, miraikuid:miraikuid[0].MiraikuID, age:age, disease:disease[0].DiseaseName, rsvdate:rsvdate, intime_hour:intime_hour, intime_mins:intime_mins, outtime_hour:outtime_hour, outtime_mins:outtime_mins, nursery:nursery[0].NurseryName , status:status, parent_name:parent_name, parent_tel:parent_tel, brothers:brothers, meal:meal[0].MealName, meal_details:meal_details[0].MealName, cramps:cramps, allergy:allergy})
    res.render("pages/reservation/entry",{Info:info,SubTitle:sub_title})
  } catch (error) {
    console.log("ERR @getReservationEntryPage: "+ error)
    if(prev != null){
      res.redirect('/reservation/?nursery='+prev)
    }else{
      res.redirect('/home')
    }
  }
}


function MonthDayToJPFromDateObj(dt){
  //11/2
  var m = dt.getMonth()+1
  var d = dt.getDate()
  return ( m + "/" + d );
}

function WeekDayToJPFromDateObj(dt){
  //(火)
  var w = [ "日", "月", "火", "水", "木", "金", "土" ][dt.getDay()]
  return "("+w+")"
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

exports.isValidNum = function (s){
  //半角と全角どちらでも受け付ける
  if(Number.isNaN(Number(s))){
    if(Number.isNaN(Number(view.zenkaku2Hankaku(s)))){
      return false
    }else{
      return true
    }
  }else{
    return true
  }
}

exports.zenkaku2Hankaku = function (val) {
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

exports.getHoursJPFormattedFromDayDataObj = function (dataobj){
  //un Dec 19 2021 11:41:53 GMT+0900 (Japan Standard Time) -> 11:41
  let date = new Date(dataobj);
  return ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2)
}
exports.getHourJPFormattedFromDayDataObj = function (dataobj){
  //un Dec 19 2021 11:41:53 GMT+0900 (Japan Standard Time) -> 11
  let date = new Date(dataobj);
  return ('0' + date.getHours()).slice(-2) 
}
exports.getMinsJPFormattedFromDayDataObj = function (dataobj){
  //un Dec 19 2021 11:41:53 GMT+0900 (Japan Standard Time) -> 41
  let date = new Date(dataobj);
  return ('0' + date.getMinutes()).slice(-2)
}

exports.getPsglTimeStampFromDayDataObj = function (dataobj){
  //un Dec 19 2021 11:41:53 GMT+0900 (Japan Standard Time) -> 2021-12-19 11:41:53
  let date = new Date(dataobj);
  return date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' +('0' + date.getDate()).slice(-2) + ' ' +  ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2) + ':' + ('0' + date.getSeconds()).slice(-2)
}

exports.getPsglTimeStampYMDFromDayDataObj = function (dataobj){
  //un Dec 19 2021 11:41:53 GMT+0900 (Japan Standard Time) -> 2021-12-19
  let date = new Date(dataobj);
  return date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' +('0' + date.getDate()).slice(-2)
}

exports.getTimeStampFrom8DayDataObj = function (dataobj){
  //un Dec 19 2021 11:41:53 GMT+0900 (Japan Standard Time) -> 20211219
  let date = new Date(dataobj);
  return date.getFullYear() + '' + ('00' + (date.getMonth() + 1)).slice(-2) + '' +('00' + date.getDate()).slice(-2)
}