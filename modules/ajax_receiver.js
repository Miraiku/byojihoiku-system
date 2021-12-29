const express = require('express');
const router = express.Router()
const https = require("https");
const psgl = require('./db_postgre')
const redis = require('./db_redis')
const Holidays = require('date-holidays');
const { is } = require('express/lib/request');
const TOKEN = process.env.LINE_ACCESS_TOKEN

router
  .post('/', async (req, res) => {
    const JST = new Date().toLocaleString({ timeZone: 'Asia/Tokyo' })
    const today = new Date(JST)
    const dayaftertomorrow = new Date(today);
    dayaftertomorrow.setDate(dayaftertomorrow.getDate() + 2);
    /*
    Ajax Message
    */
    try {
      console.log(req.body)
      const text = req.body.events[0].message.text
      const userId = req.body.events[0].source.userId
      let dataString = null
      let replyMessage = null
      let current_child_number = null

      res.send("HTTP POST request sent to the webhook URL!")
      if (req.body.events[0].type === "message") {
      }

    } catch (err) {
        console.error("Ajax Receiver： "+err);
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
function zenkaku2Hankaku(val) {
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
function hankaku2Zenkaku(str) {
  return str.replace(/[A-Za-z0-9]/g, function(s) {
      return String.fromCharCode(s.charCodeAt(0) + 0xFEE0);
  });
}

function isValidNum(s){
  //半角と全角どちらでも受け付ける
  if(Number.isNaN(Number(s))){
    if(Number.isNaN(Number(zenkaku2Hankaku(s)))){
      return false
    }else{
      return true
    }
  }else{
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


function getTimeStampFromDayDataObj(dataobj){
  //un Dec 19 2021 11:41:53 GMT+0900 (Japan Standard Time) -> 2021-12-19 11:41:53
  let date = new Date(dataobj);
  return date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' +('0' + date.getDate()).slice(-2) + ' ' +  ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2) + ':' + ('0' + date.getSeconds()).slice(-2)
}


function getTimeJPFormattedFromDayDataObj(dataobj){
  //un Dec 19 2021 11:41:53 GMT+0900 (Japan Standard Time) -> 11:41
  let date = new Date(dataobj);
  return ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2)
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
  //2021-12-31 11:30:00 -> 11時30分
  let time = day.substr( 11, 2 )+'時'+day.substr( 14, 2 )+'分'
  return time 
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
  let JST = new Date(s).toLocaleString({ timeZone: 'Asia/Tokyo' })
  let day = new Date(JST)
  return '('+[ "日", "月", "火", "水", "木", "金", "土" ][day.getDay()]+')'
}

function timenumberToDayJP(s){
  //秒数から○年○月○日と表記
  let JST = new Date(s).toLocaleString({ timeZone: 'Asia/Tokyo' })
  let day = new Date(JST)
  return DayToJP(String(day.getFullYear())+String((day.getMonth() + 1))+String(day.getDate()))
}

function isBeforeToday8AM(s){
  if(isValidDate(s)){
    let reservationday = new Date(getYear(s), Number(getMonth(s)-1), getDay(s)).toLocaleString({ timeZone: 'Asia/Tokyo' })//月のみ0インデックス, 秒で出力
    let reservationday_dateobj = new Date(reservationday)
    let JST = new Date().toLocaleString({ timeZone: 'Asia/Tokyo' })
    let today = new Date(JST).setHours(0,0,0,0)//時間は考慮しない
    let today_hour = new Date(JST)//時間は考慮しない
    if(today == reservationday_dateobj.getTime() &&  today_hour.getHours() >= 8){
      return false
    }
    return true
  }
  return false
}

function isValidRegisterdDay(s){
  const holiday = new Holidays('JP')
  holiday.setTimezone(process.env.TZ)
  holiday.setHoliday('12-29', 'miraiku-holiday')
  holiday.setHoliday('12-30', 'miraiku-holiday')
  holiday.setHoliday('12-31', 'miraiku-holiday')
  holiday.setHoliday('01-01', 'miraiku-holiday')
  holiday.setHoliday('01-02', 'miraiku-holiday')
  holiday.setHoliday('01-03', 'miraiku-holiday')
  if(isValidDate(s)){
    let reservationday = new Date(getYear(s), Number(getMonth(s)-1), getDay(s)).toLocaleString({ timeZone: 'Asia/Tokyo' })//月のみ0インデックス, 秒で出力 //12/21/2021, 12:00:00 AM
    let reservationday_formatted = new Date(reservationday)//月のみ0インデックス, 秒で出力
    let JST = new Date().toLocaleString({ timeZone: 'Asia/Tokyo' })
    let today = new Date(JST).setHours(0,0,0,0)//時間は考慮しない //1639839600000
    let dayaftertomorrow = new Date(JST) //2021-12-20T15:00:00.000Z
    dayaftertomorrow.setDate(dayaftertomorrow.getDate() + 2)
    dayaftertomorrow.setHours(0,0,0,0)
    let milltime_of_today = today
    let milltime_of_reservationday = reservationday_formatted.getTime()
    let milltime_of_dayaftertomorrow = dayaftertomorrow.getTime()
    if(holiday.isHoliday(reservationday) || reservationday_formatted.getDay() == 0 ||  reservationday_formatted.getDay() == 6){
      return false
    }else if(milltime_of_reservationday > milltime_of_dayaftertomorrow){
      return false
    }else if(milltime_of_reservationday < milltime_of_today){
      return false
    }else if(milltime_of_reservationday >= milltime_of_today && milltime_of_reservationday <= milltime_of_dayaftertomorrow){
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

async function isAvailableReservation(id){
  try {
    let queryString = `SELECT * FROM public."Member" WHERE "LINEID" = '`+id+`' and "MiraikuID" IS NOT NULL;`;
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
    console.log('insertReservationDetails Object.keys(results).length:'+Object.keys(results).length)
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
  try {
    let num = zenkaku2Hankaku(id)
    let result = await psgl.isValidMealInMealTable(num)
    if(result[0] != undefined && result[0].ID != null){
      return true
    }else{
      false
    }
  } catch (error) {
    return false
  }
}

async function isValidDisease(id){
  try {
    let num = zenkaku2Hankaku(id)
    let result = await psgl.isValidDiseaseInDiseaseTable(num)
    if(result[0] != undefined || result[0].ID != null){
      return true
    }else{
      return false
    }
  } catch (error) {
    return false
  }
}

async function getJpValueFromPsglIds(o){
  try {
    let result = []
    let name = await psgl.getMemberNameByMemberID(o.MemberID)
    let disease= await psgl.getDiseaseNameFromUniqueID(o.DiseaseID)
    let firstn= await psgl.getNurseryNameByID(o.firstNursery)
    let secondn
    try {
      secondn = await psgl.getNurseryNameByID(o.secondNursery)
      secondn = secondn[0].NurseryName
    } catch (error) {
      //NurseryID = 0
      secondn = 'なし'
    }
    let thirdn
    try {
      thirdn = await psgl.getNurseryNameByID(o.thirdNursery)
      thirdn = thirdn[0].NurseryName
    } catch (error) {
      //NurseryID = 0
      thirdn = 'なし'
    }
    let mealname = await psgl.getMealNameFromID(o.MealType)
    result.push({MemberID:name[0].Name, DiseaseID:disease[0].DiseaseName, firstNursery:firstn[0].NurseryName, secondNursery:secondn, thirdNursery:thirdn, MealType:mealname[0].MealName})
    return result
  } catch (error) {
    console.log("ERROR @getJpValueFromPsglIds() "+error)
  }
}

function escapeHTML(string){
  return string.replace(/&/g, '&lt;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, "&#x27;");
}
module.exports = router