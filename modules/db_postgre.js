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

exports.sqlToPostgre = async function (queryString){
  try {
    const psgl_client = await pool.connect(); 
    const results = await psgl_client.query(queryString);
    console.log(`Postgles sql: `+ queryString)
    psgl_client.release();
    return results.rows
    //{k: index, v:{sql result}}
  }
  catch (err) {
    console.log(`Postgles sql: `+ queryString)
    console.log(`PSGL ERR: ${err}`)
    return null
  }
}

exports.getNurseryTable = async function (){
  let sql = `SELECT "ID", "NurseryName", "Capacity", "OpenDay", "OpenTime", "CloseTime" FROM public."Nursery";`
  return await psgl.sqlToPostgre(sql)
}

exports.getNurseryName = async function (){
  let nursery_list = []
  let nursery = await psgl.getNurseryTable()
  for await (const v of nursery) {
    nursery_list.push({name:v['NurseryName']})
  }
  return nursery_list
}

exports.getNurseryID_Name_Capacity = async function (){
  let nursery_list = []
  let nursery = await psgl.getNurseryTable()
  for await (const v of nursery) {
    nursery_list.push({id:v['ID'], name:v['NurseryName'], capacity:v['Capacity']})
  }
  return nursery_list
}


exports.getNurseryCapacityByName = async function (name){
  let sql = `SELECT "Capacity" FROM public."Nursery" WHERE "NurseryName" = '`+name+`';`
  return await psgl.sqlToPostgre(sql)
}

exports.getNurseryIdByName = async function (name){
  let sql = `SELECT "ID" FROM public."Nursery" WHERE "NurseryName" = '`+name+`';`
  return await psgl.sqlToPostgre(sql)
}
exports.getNurseryNameByID = async function (id){
  let sql = `SELECT "NurseryName" FROM public."Nursery" WHERE "ID" = '`+id+`';`
  return await psgl.sqlToPostgre(sql)
}

exports.getAvailableNurseryOnThatDay = async function (date){
  let available = []
  let nursery = await psgl.getNurseryTable()
  for await (const v of nursery) {
    let sql = `SELECT COUNT ("ID") FROM public."Reservation" WHERE "ReservationStatus" = 'Reserved' and "ReservationDate"::text LIKE '`+date+`%' and "NurseryID" = '`+v['ID']+`';`
    let c = await psgl.sqlToPostgre(sql)
    let current_capacity = Number(v['Capacity']) - Number(c[0]['count'])
    if(current_capacity > 0){
      available.push({id:v['ID'], name:v['NurseryName'], capacity:current_capacity})
    }
  }
  return available
}

exports.canNurseryReservationOnThatDay = async function (date, nursery_id){
  let sql = `SELECT COUNT ("ID") FROM public."Reservation" WHERE "ReservationStatus" = 'Reserved' and "ReservationDate"::text LIKE '`+date+`%' and "NurseryID" = '`+nursery_id+`';`
  return await psgl.sqlToPostgre(sql)
}

exports.getNurseryOpenTimeFromName = async function (name){
  let sql = `SELECT "OpenTime" FROM public."Nursery" WHERE "NurseryName" = '`+name+`';`
  return await psgl.sqlToPostgre(sql)
}

exports.getNurseryCloseTimeFromName = async function (name){
  let sql = `SELECT "CloseTime" FROM public."Nursery" WHERE "NurseryName" = '`+name+`';`
  return await psgl.sqlToPostgre(sql)
  //コントローラーではopentime[0].CloseTimeで取得
}

exports.isMemberedInMemberTable = async function (lineid, name, birthday){
  let sql = `SELECT "ID" FROM public."Member" WHERE "Name" = '`+name+`' and "LINEID" = '`+lineid+`' and "BirthDay" = '`+birthday+`' and "MiraikuID" IS NOT NULL;`
  return await psgl.sqlToPostgre(sql)
}

exports.getMemberedIDFromNameAndBirthDay = async function (lineid, name, birthday){
  let sql = `SELECT "ID" FROM public."Member" WHERE "Name" = '`+name+`' and "LINEID" = '`+lineid+`' and "BirthDay" = '`+birthday+`' and "MiraikuID" IS NOT NULL;`
  return await psgl.sqlToPostgre(sql)
}

exports.getMealList = async function (date){
  let results = []
  let sql = `SELECT "ID", "MealName" FROM public."Meal";`
  let r = await psgl.sqlToPostgre(sql)
  for await (const v of r) {
    results.push({id:v['ID'], name:v['MealName']})
  }
  return results
}

exports.isValidMealInMealTable = async function (id){
  let sql = `SELECT "ID" FROM public."Meal" WHERE "ID" = '`+id+`';`
  return await psgl.sqlToPostgre(sql)
}

exports.getMealNameFromID = async function (id){
  let sql = `SELECT "MealName" FROM public."Meal" WHERE "ID" = '`+id+`';`
  return await psgl.sqlToPostgre(sql)
}

exports.isValidDiseaseInDiseaseTable = async function (id){
  let sql = `SELECT "ID" FROM public."Disease" WHERE "DiseaseID" = '`+id+`';`
  return await psgl.sqlToPostgre(sql)
}


exports.getDiseaseList = async function (date){
  let results = []
  let sql = `SELECT "DiseaseID", "DiseaseName" FROM public."Disease";`
  let r = await psgl.sqlToPostgre(sql)
  for await (const v of r) {
    results.push({id:v['DiseaseID'], name:v['DiseaseName']})
  }
  return results
}

exports.getDiseaseNameFromID = async function (id){
  let sql = `SELECT "DiseaseName" FROM public."Disease" WHERE "DiseaseID" = '`+id+`';`
  return await psgl.sqlToPostgre(sql)
}

exports.getDiseaseNameFromUniqueID = async function (id){
  let sql = `SELECT "DiseaseName" FROM public."Disease" WHERE "ID" = '`+id+`';`
  return await psgl.sqlToPostgre(sql)
}

exports.getUniqueIDFromDiseaseID = async function (id){
  let sql = `SELECT "ID" FROM public."Disease" WHERE "DiseaseID" = '`+id+`';`
  return await psgl.sqlToPostgre(sql)
}

exports.getReservationStatusByMemberIDGraterThanToday = async function (id){
  let sql = `SELECT * FROM public."Reservation" WHERE "MemberID" = ${id} and "ReservationDate" >= DATE 'today';`

  let result = await psgl.sqlToPostgre(sql)
  return result
}

exports.getReservationStatusReservedByMemberIDGraterThanToday = async function (id){
  let sql = `SELECT * FROM public."Reservation" WHERE "MemberID" = ${id} and "ReservationDate" >= DATE 'today' and "ReservationStatus" = 'Reserved';`
  let result = await psgl.sqlToPostgre(sql)
  return result
}


exports.getReservationStatusWaitingByMemberIDGraterThanToday = async function (id){
  let sql = `SELECT * FROM public."Reservation" WHERE "MemberID" = ${id} and "ReservationDate" >= DATE 'today' and "ReservationStatus" = 'Unread';`

  let result = await psgl.sqlToPostgre(sql)
  return result
}


exports.getReservationStatusCancelledByMemberIDGraterThanToday = async function (id){
  let sql = `SELECT * FROM public."Reservation" WHERE "MemberID" = ${id} and "ReservationDate" >= DATE 'today' and "ReservationStatus" = 'Cancelled';`

  let result = await psgl.sqlToPostgre(sql)
  return result
}

exports.getTomorrowReminderStatusByLINEID = async function (lineid){
  try {
    let memberids = await psgl.getMemberIDByLINEID(lineid)
    let status = []
    for (const r of memberids) {
      let sql = `SELECT "Reminder" FROM public."Reservation" WHERE "MemberID" = '${r.ID}' and "ReservationDate" = DATE 'tomorrow' and "ReservationStatus" = 'Reserved';`
      status.push(await psgl.sqlToPostgre(sql))
    }
    return status
  } catch (error) {
    console.log('getTomorrowReminderStatusByLINEID: ' + error)
    return []
  }
}

exports.getTodayReminderStatusByLINEID = async function (lineid){
  try {
    let memberids = await psgl.getMemberIDByLINEID(lineid)
    let status = []
    for (const r of memberids) {
      let sql = `SELECT "Reminder" FROM public."Reservation" WHERE "MemberID" = '${r.ID}' and "ReservationDate" = DATE 'today' and "ReservationStatus" = 'Reserved';`
      status.push(await psgl.sqlToPostgre(sql))
    }
    return status
  } catch (error) {
    console.log('getTomorrowReminderStatusByLINEID: ' + error)
    return []
  }
}

exports.getLINEIDTodayReservationReminderStatusIsWaitingAndUpdateCancelled = async function (){
  try {
    let sql = `SELECT "MemberID" FROM public."Reservation" WHERE "ReservationDate" = DATE 'today' and "Reminder" = 'waiting' and "ReservationStatus" = 'Reserved';`
    let memberids = await psgl.sqlToPostgre(sql)
    let lineids = []
    for (const r of memberids) {
      let sql = `UPDATE public."Reservation" SET "Reminder"= 'cancelled', "ReservationStatus"= 'Cancelled' WHERE "MemberID"= '${r.MemberID}' and "ReservationDate" = DATE 'today' and "ReservationStatus" = 'Reserved' and "Reminder" = 'waiting';`
      await psgl.sqlToPostgre(sql)
      lineids.push(await psgl.getLINEIDByMemberID(r.MemberID))
    }
    return lineids
  } catch (error) {
    console.log('getLINEIDTodayReservationReminderStatusIsWaitingAndUpdateCancelled: ' + error)
    return []
  }
}

exports.getLINEIDByReservedTomorrow = async function (){
  let sql = `SELECT "MemberID" FROM public."Reservation" WHERE "ReservationDate" = DATE 'tomorrow' and "ReservationStatus" = 'Reserved';`
  let result = await psgl.sqlToPostgre(sql)
  let ids = []
  for (const r of result) {
    ids.push(await psgl.getLINEIDByMemberID(r.MemberID))
  }
  return ids
}

exports.updateTomorrowReservedReminderStatusByLineID = async function (lineid, status){
  let sql = `SELECT "ID" FROM public."Member" WHERE "LINEID" = '${lineid}';`
  let result = await psgl.sqlToPostgre(sql)
  let res = []
  for (const r of result) {
    let sql = `UPDATE public."Reservation" SET "Reminder"= '${status}' WHERE "MemberID"= '${r.ID}' and "ReservationDate" = DATE 'tomorrow' and "ReservationStatus" = 'Reserved';`
    console.log(sql)
    res.push(await psgl.sqlToPostgre(sql))
  }
  return res
}

exports.updateTodayReservedReminderStatusByLineID = async function (lineid, status){
  let sql = `SELECT "ID" FROM public."Member" WHERE "LINEID" = '${lineid}';`
  let result = await psgl.sqlToPostgre(sql)
  let res = []
  for (const r of result) {
    let sql = `UPDATE public."Reservation" SET "Reminder"= '${status}' WHERE "MemberID"= '${r.ID}' and "ReservationDate" = DATE 'today' and "ReservationStatus" = 'Reserved';`
    console.log(sql)
    res.push(await psgl.sqlToPostgre(sql))
  }
  return res
}


exports.getReservationDetailsByMemberIDGraterThanToday = async function (id){
  let sql = `SELECT * FROM public."ReservationDetails" WHERE "MemberID" = ${id} and "ReservationDate" >= DATE 'today';`

  let result = await psgl.sqlToPostgre(sql)
  return result
}
exports.getReservationDetailsByReservationID = async function (id){
  let sql = `SELECT * FROM public."ReservationDetails" WHERE "ID" = ${id} ;`

  let result = await psgl.sqlToPostgre(sql)
  return result
}

exports.getLINEIDByMemberID = async function (id){
  let sql = `SELECT "LINEID" FROM public."Member" WHERE "ID" = '${id}';`
  let result = await psgl.sqlToPostgre(sql)
  return result//[{}]
}

exports.getMemberIDByLINEID = async function (id){
  let sql = `SELECT "ID" FROM public."Member" WHERE "LINEID" = '${id}';`

  let result = await psgl.sqlToPostgre(sql)
  return result//[{},{}]
}

exports.getMemberNameByMemberID = async function (id){
  let sql = `SELECT "Name" FROM public."Member" WHERE "ID" = '${id}';`

  let result = await psgl.sqlToPostgre(sql)
  return result//[{}]
}

/* View */


exports.ReservationStatus3DaysByNursery = async function (id){
  let sql = `SELECT "ReservationStatus" FROM public."Reservation" WHERE "NurseryID" = '${id}' and "ReservationDate" >= DATE 'today' and "ReservationDate" <= CURRENT_DATE + 2;`
  let result = await psgl.sqlToPostgre(sql)
  return result//[{}]
}