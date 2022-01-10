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

exports.getNurseryCapacityByID = async function (name){
  let sql = `SELECT "Capacity" FROM public."Nursery" WHERE "ID" = '`+name+`';`
  return await psgl.sqlToPostgre(sql)
}

exports.getNurseryIdByName = async function (name){
  let sql = `SELECT "ID" FROM public."Nursery" WHERE "NurseryName" = '`+name+`';`
  return await psgl.sqlToPostgre(sql)
}
exports.getNurseryNameByID = async function (id){
  let sql = `SELECT "NurseryName" FROM public."Nursery" WHERE "ID" = '`+id+`';`
  return await psgl.sqlToPostgre(sql)
  // 0 == 'なし'
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

exports.getAvailableNurseryOnToday = async function (){
  let available = []
  let nursery = await psgl.getNurseryTable()
  for await (const v of nursery) {
    let sql = `SELECT COUNT ("ID") FROM public."Reservation" WHERE "ReservationStatus" = 'Reserved' and "ReservationDate" >= DATE 'today' and "NurseryID" = '`+v['ID']+`';`
    let c = await psgl.sqlToPostgre(sql)
    let current_capacity = Number(v['Capacity']) - Number(c[0]['count'])
    if(current_capacity > 0){
      available.push({id:v['ID'], name:v['NurseryName'], capacity:current_capacity})
    }
  }
  return available
}

exports.canNurseryReservationOnThatDay = async function (date, nursery_id){
  let sql = `SELECT COUNT ("ID") FROM public."Reservation" WHERE "ReservationDate"::text LIKE '`+date+`%' and "NurseryID" = '`+nursery_id+`'and ("ReservationStatus" = 'Reserved' or "ReservationStatus" = 'Waiting' or "ReservationStatus"::text LIKE 'Unread%');`
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
  let sql = `SELECT "ID" FROM public."Member" WHERE "Name" = '`+name+`' and "LINEID" = '`+lineid+`' and "BirthDay" = '`+birthday+`' and "MiraikuID" IS NOT NULL and "Disabled" = 'false';`
  return await psgl.sqlToPostgre(sql)
}

exports.getMemberedIDFromNameAndBirthDay = async function (lineid, name, birthday){
  let sql = `SELECT "ID" FROM public."Member" WHERE "Name" = '`+name+`' and "LINEID" = '`+lineid+`' and "BirthDay" = '`+birthday+`' and "MiraikuID" IS NOT NULL and "Disabled" = 'false';`
  return await psgl.sqlToPostgre(sql)
}

exports.updateMemberInfo = async function (info){
  try {
    //function,sqlだとresult2つ返ってきて返り値とれないので1つずつ実行する
    let sql = `CREATE OR REPLACE FUNCTION updateMember(miraikuid integer, birthday integer, name text, allergy boolean, id integer) RETURNS integer AS $$
    DECLARE
      rows_affected integer;
    BEGIN 
    UPDATE public."Member" SET "MiraikuID"=miraikuid, "BirthDay"=birthday, "Name"=name, "Allergy"='false', "UpdatedAt" = to_timestamp(${Date.now()} / 1000.0) WHERE "ID" = id;
      GET DIAGNOSTICS rows_affected = ROW_COUNT;
      RETURN rows_affected;
    END;
    $$ LANGUAGE plpgsql;`
    await psgl.sqlToPostgre(sql)
    sql = `SELECT updateMember(${info.miraikuid},${info.birthday},'${info.name}',${info.allergy},${info.memberid});`
    let res1 = await psgl.sqlToPostgre(sql)
    return res1[0].updatemember
  } catch (error) {
    return null
  }
}

exports.getMemberBirthDayByID = async function (id){
  let sql = `SELECT "BirthDay" FROM public."Member" WHERE "ID" = '`+id+`' and "MiraikuID" IS NOT NULL and "Disabled" = 'false';`
  return await psgl.sqlToPostgre(sql)
}

exports.getMainMealList = async function (date){
  let results = []
  let sql = `SELECT "ID", "MealName", "MealID" FROM public."Meal" WHERE "Type" = 'main';`
  let r = await psgl.sqlToPostgre(sql)
  for await (const v of r) {
    results.push({id:v['ID'], mealid:v['MealID']})
  }
  return results
}

exports.getSubMealList = async function (date){
  let results = []
  let sql = `SELECT "ID", "MealName", "MealID" FROM public."Meal" WHERE "Type" = 'sub';`
  let r = await psgl.sqlToPostgre(sql)
  for await (const v of r) {
    results.push({id:v['ID'], name:v['MealName'], mealid:v['MealID']})
  }
  return results
}

exports.isValidMealInMealTable = async function (id){
  let sql = `SELECT "ID" FROM public."Meal" WHERE "ID" = '`+id+`';`
  return await psgl.sqlToPostgre(sql)
}

exports.isValidMainMealInMealTable = async function (id){
  let sql = `SELECT "ID" FROM public."Meal" WHERE "MealID" = '`+id+`' and "Type" = 'main';`
  return await psgl.sqlToPostgre(sql)
}

exports.isValidSubMealInMealTable = async function (id){
  let sql = `SELECT "ID" FROM public."Meal" WHERE "MealID" = '`+id+`' and "Type" = 'sub';`
  return await psgl.sqlToPostgre(sql)
}

exports.getMealNameFromMainID = async function (id){
  let sql = `SELECT "MealName" FROM public."Meal" WHERE "MealID" = '`+id+`' and "Type" = 'main';`
  return await psgl.sqlToPostgre(sql)
}

exports.getMealNameFromSubID = async function (id){
  let sql = `SELECT "MealName" FROM public."Meal" WHERE "MealID" = '`+id+`' and "Type" = 'sub';`
  return await psgl.sqlToPostgre(sql)
}


exports.getUniqueIDFromMealName = async function (name){
  let sql = `SELECT "ID" FROM public."Meal" WHERE "MealName" = '`+ name+`';`
  return await psgl.sqlToPostgre(sql)
}


exports.isValidDiseaseInDiseaseTable = async function (id){
  let sql = `SELECT "ID" FROM public."Disease" WHERE "DiseaseID" = '`+id+`';`
  return await psgl.sqlToPostgre(sql)
}


exports.getDiseaseList = async function (date){
  let results = []
  let sql = `SELECT * FROM public."Disease";`
  let r = await psgl.sqlToPostgre(sql)
  for await (const v of r) {
    results.push({id:v['DiseaseID'], name:v['DiseaseName'], uniqueid:v['ID']})
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

exports.getReservationInfoByReservationID = async function (id){
  let sql = `SELECT * FROM public."Reservation" WHERE "ID" = ${id};`
  let result = await psgl.sqlToPostgre(sql)
  return result
}

exports.getReservationStatusByMemberIDGraterThanToday = async function (id){
  let sql = `SELECT * FROM public."Reservation" WHERE "MemberID" = ${id} and "ReservationDate" >= DATE 'today';`

  let result = await psgl.sqlToPostgre(sql)
  return result
}

exports.getReservationStatusReservedByMemberIDGraterThanToday = async function (id){
  let sql = `SELECT * FROM public."Reservation" WHERE "MemberID" = ${id} and "ReservationDate" >= DATE 'today' and ("ReservationStatus" = 'Reserved' or "ReservationStatus" = 'UnreadReservation');`
  let result = await psgl.sqlToPostgre(sql)
  return result
}

exports.getReservationStatusUnreadByMemberIDGraterThanToday = async function (id){
  let sql = `SELECT * FROM public."Reservation" WHERE "MemberID" = ${id} and "ReservationDate" >= DATE 'today' and "ReservationStatus" = 'Unread';`

  let result = await psgl.sqlToPostgre(sql)
  return result
}


exports.getReservationStatusWaitingByMemberIDGraterThanToday = async function (id){
  let sql = `SELECT * FROM public."Reservation" WHERE "MemberID" = ${id} and "ReservationDate" >= DATE 'today' and "ReservationStatus" = 'Waiting';`

  let result = await psgl.sqlToPostgre(sql)
  return result
}


exports.getReservationStatusUnreadAndWaitingByMemberIDGraterThanToday = async function (id){
  let sql = `SELECT * FROM public."Reservation" WHERE "MemberID" = ${id} and "ReservationDate" >= DATE 'today' and ("ReservationStatus" = 'Unread' or "ReservationStatus" = 'Waiting');`

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

exports.setTodayReservationStatusIsCancelled = async function (lineid){
  try {
    let lines = await psgl.getMemberIDByLINEID(lineid)
    if(lines.lengh > 0){
      for (const r of lines) {
        let sql = `UPDATE public."Reservation" SET "Reminder"= 'cancelled', "ReservationStatus"= 'Cancelled' WHERE "MemberID"= '${r[0].MemberID}' and "ReservationDate" = DATE 'today' and "ReservationStatus" = 'Waiting';`
        await psgl.sqlToPostgre(sql)
      }
      return true
    }else{
      return false
    }
  } catch (error) {
    console.log('setTodayReservationStatusIsCancelled: ' + error)
    return false
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

exports.updateTomorrowCancelledByLineID = async function (lineid){
  let sql = `SELECT "ID" FROM public."Member" WHERE "LINEID" = '${lineid}' and "Disabled" = 'false';`
  let result = await psgl.sqlToPostgre(sql)
  let res = []
  for (const r of result) {
    let sql = `UPDATE public."Reservation" SET "ReservationStatus" = 'Cancelled', "Reminder"= 'cancelled' , "UpdatedTime"=to_timestamp(${Date.now()} / 1000.0) WHERE "MemberID"= '${r.ID}' and "ReservationDate" = DATE 'tomorrow';`
    console.log(sql)
    res.push(await psgl.sqlToPostgre(sql))
  }
  return res
}


exports.updateTodayCancelledByLineID = async function (lineid){
  let sql = `SELECT "ID" FROM public."Member" WHERE "LINEID" = '${lineid}' and "Disabled" = 'false';`
  let result = await psgl.sqlToPostgre(sql)
  let res = []
  for (const r of result) {
    let sql = `UPDATE public."Reservation" SET "ReservationStatus" = 'Cancelled', "Reminder"= 'cancelled', "UpdatedTime"=to_timestamp(${Date.now()} / 1000.0)  WHERE "MemberID"= '${r.ID}' and "ReservationDate" = DATE 'today';`
    res.push(await psgl.sqlToPostgre(sql))
  }
  return res
}

exports.getLINEIDByReservedTomorrow = async function (){
  let sql = `SELECT "MemberID", "NurseryID" FROM public."Reservation" WHERE "ReservationDate" = DATE 'tomorrow' and "ReservationStatus" = 'Reserved';`
  let result = await psgl.sqlToPostgre(sql)
  let ids = []
  for (const r of result) {
    let nursery_name = await psgl.getNurseryNameByID(r.NurseryID)
    let lineid = await psgl.getLINEIDByMemberID(r.MemberID)
    let name = await psgl.getMemberNameByMemberID(r.MemberID)
    ids.push({lineid: lineid[0].LINEID, nurseryname: nursery_name[0].NurseryName, name: name[0].Name})
  }
  return ids
}

exports.updateTomorrowReservedReminderStatusByLineID = async function (lineid, status){
  let sql = `SELECT "ID" FROM public."Member" WHERE "LINEID" = '${lineid}' and "Disabled" = 'false';`
  let result = await psgl.sqlToPostgre(sql)
  let res = []
  for (const r of result) {
    let sql = `UPDATE public."Reservation" SET "Reminder"= '${status}' , "UpdatedTime"=to_timestamp(${Date.now()} / 1000.0) WHERE "MemberID"= '${r.ID}' and "ReservationDate" = DATE 'tomorrow' and "ReservationStatus" = 'Reserved' ;`
    console.log(sql)
    res.push(await psgl.sqlToPostgre(sql))
  }
  return res
}

exports.updateTodayWaitingUserToReservedUserByLineID = async function (lineid){
  try {
    let sql = `SELECT "ID" FROM public."Member" WHERE "LINEID" = '${lineid}' and "Disabled" = 'false';`
    let result = await psgl.sqlToPostgre(sql)
    let res = []
    for (const r of result) {
      let sql = `UPDATE public."Reservation" SET "ReservationStatus" = 'Reserved' , "UpdatedTime"=to_timestamp(${Date.now()} / 1000.0) WHERE "MemberID"= '${r.ID}' and "ReservationDate" = DATE 'today' and "ReservationStatus" = 'Waiting';`
      res.push(await psgl.sqlToPostgre(sql))
    }
    return res
  } catch (error) {
    console.log('ERROR @ updateTodayWaitingUserToReservedUserByLineID: '+ error)
    return null
  }
}

exports.updateTodayReservedReminderStatusByLineID = async function (lineid, status){
  let sql = `SELECT "ID" FROM public."Member" WHERE "LINEID" = '${lineid}' and "Disabled" = 'false';`
  let result = await psgl.sqlToPostgre(sql)
  let res = []
  for (const r of result) {
    let sql = `UPDATE public."Reservation" SET "Reminder"= '${status}', "UpdatedTime"=to_timestamp(${Date.now()} / 1000.0)  WHERE "MemberID"= '${r.ID}' and "ReservationDate" = DATE 'today' and "ReservationStatus" = 'Reserved';`
    res.push(await psgl.sqlToPostgre(sql))
  }
  return res
}


exports.updateTodayWaitingMemberToReservedMemberByReservationID = async function (rsvid){
  let sql = `UPDATE public."Reservation" SET "ReservationStatus"= 'Reserved' , "UpdatedTime"=to_timestamp(${Date.now()} / 1000.0) WHERE "MemberID"= '${rsvid}';`
  let result = await psgl.sqlToPostgre(sql)
  return result
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


exports.delMemberByIDName = async function (id, name){
  try {
    let sql = `CREATE OR REPLACE FUNCTION deleteMember(id integer, name text) RETURNS integer AS $$
    DECLARE
      rows_affected integer;
    BEGIN 
    UPDATE public."Member"
    	SET "Disabled"=true WHERE "ID" = id and "Name" = name;
      GET DIAGNOSTICS rows_affected = ROW_COUNT;
      RETURN rows_affected;
    END;
    $$ LANGUAGE plpgsql;`
    await psgl.sqlToPostgre(sql)
    sql = `SELECT deleteMember(${id},'${name}');`
    let res1 = await psgl.sqlToPostgre(sql)
    return res1[0].deletemember
  } catch (error) {
    console.log("ERR @delMemberByIDName: "+error)
    return null
  }
}


exports.getMembers = async function (){
  let sql = `SELECT * FROM public."Member" WHERE "Disabled" = 'false' ORDER BY "MiraikuID";`
  let result = await psgl.sqlToPostgre(sql)
  return result//[{},{}]
}

exports.getMembersOrderByName = async function (){
  let sql = `SELECT * FROM public."Member" WHERE "Disabled" = 'false' ORDER BY "Name" ASC;`
  let result = await psgl.sqlToPostgre(sql)
  return result//[{},{}]
}


exports.getNoIDMembersOrderByName = async function (){
  let sql = `SELECT * FROM public."Member" WHERE "MiraikuID" = 0 and "Disabled" = 'false' ORDER BY "Name" ASC;`
  let result = await psgl.sqlToPostgre(sql)
  return result//[{},{}]
}

exports.getYearMembersOrderByName = async function (year){
  //year -> 2021なら21
  let sql = `SELECT * FROM public."Member" WHERE "Disabled" = 'false' and "MiraikuID"::text LIKE '${year}%' ORDER BY "Name" ASC;`
  let result = await psgl.sqlToPostgre(sql)
  return result//[{},{}]
}

exports.getMemberInfoByMemberID = async function (id){
  let sql = `SELECT * FROM public."Member" WHERE "ID" = '${id}' and "Disabled" = 'false';`

  let result = await psgl.sqlToPostgre(sql)
  return result//[{},{}]
}


exports.getLINEIDByMemberID = async function (id){
  let sql = `SELECT "LINEID" FROM public."Member" WHERE "ID" = '${id}' and "Disabled" = 'false';`
  let result = await psgl.sqlToPostgre(sql)
  return result//[{}]
}


exports.getMemberIDByLINEID = async function (id){
  let sql = `SELECT "ID" FROM public."Member" WHERE "LINEID" = '${id}' and "Disabled" = 'false';`

  let result = await psgl.sqlToPostgre(sql)
  return result//[{},{}]
}

exports.getMemberNameByMemberID = async function (id){
  let sql = `SELECT "Name" FROM public."Member" WHERE "ID" = '${id}' and "Disabled" = 'false';`

  let result = await psgl.sqlToPostgre(sql)
  return result//[{}]
}

exports.getMiraikuIDByMemberID = async function (id){
  let sql = `SELECT "MiraikuID" FROM public."Member" WHERE "ID" = '${id}' and "Disabled" = 'false';`
  let result = await psgl.sqlToPostgre(sql)
  return result//[{}]
}

exports.getMemberAllergyByMemberID = async function (id){
  let sql = `SELECT "Allergy" FROM public."Member" WHERE "ID" = '${id}' and "Disabled" = 'false';`

  let result = await psgl.sqlToPostgre(sql)
  return result//[{}]
}

exports.getReservationDateByID = async function (id){
  let sql = `SELECT "ReservationDate" FROM public."Reservation" WHERE "ID" = '${id}';`
  let result = await psgl.sqlToPostgre(sql)
  return result//[{}]
}

exports.getReservationStatusByID = async function (id){
  let sql = `SELECT "ReservationStatus" FROM public."Reservation" WHERE "ID" = '${id}';`
  let result = await psgl.sqlToPostgre(sql)
  return result//[{}]
}

exports.ReservationStatusTodayByNursery = async function (id){
  let sql = `SELECT "ReservationStatus" FROM public."Reservation" WHERE "NurseryID" = '${id}' and "ReservationDate" = DATE 'today';`
  let result = await psgl.sqlToPostgre(sql)
  return result//[{}]
}

exports.ReservationStatusTomorrowByNursery = async function (id){
  let sql = `SELECT "ReservationStatus" FROM public."Reservation" WHERE "NurseryID" = '${id}' and "ReservationDate" = DATE 'tomorrow';`
  let result = await psgl.sqlToPostgre(sql)
  return result//[{}]
}

exports.ReservationStatusDayAfterTomorrowByNursery = async function (id){
  let sql = `SELECT "ReservationStatus" FROM public."Reservation" WHERE "NurseryID" = '${id}' and "ReservationDate" = CURRENT_DATE + 2;`
  let result = await psgl.sqlToPostgre(sql)
  return result//[{}]
}


exports.getLineIDByReservationID = async function (id){
  let sql = `SELECT "MemberID" FROM public."Reservation" WHERE "ID" = '${id}');`
  let result = await psgl.sqlToPostgre(sql)
  let res = []
  for (const i of result) {
    let sql = `SELECT "LINEID" FROM public."ReservationDetails" WHERE "ID" = '${i.ID}';`
    res.push(await psgl.sqlToPostgre(sql))
  }
  return res//[{}]
}

exports.updateReservationInfo = async function (info, intime, outime){
  try {
    let sql = `CREATE OR REPLACE FUNCTION updateReservation(status text, disease integer, nursery integer, parent_name text, parent_tel text, meal_details text, cramps text, allergy_details text, rsvid integer, meal integer, intime text, outtime text) RETURNS integer AS $$
    DECLARE
      rows_affected integer;
    BEGIN 
      UPDATE public."Reservation" SET "NurseryID"=nursery, "ReservationStatus"=status, "UpdatedTime"=to_timestamp(${Date.now()} / 1000.0), "Confirmation"='true' WHERE "ID"=rsvid;
      UPDATE public."ReservationDetails" SET "DiseaseID"=disease,  "firstNursery"=nursery, "ParentName"=parent_name, "MealType"=meal, "MealDetails"=meal_details, "Allergy"=allergy_details, "ParentTel"=parent_tel, "Cramps"=cramps, "InTime"=to_timestamp(intime,'YYYY-MM-DD HH24:MI:00'), "OutTime"=to_timestamp(outtime,'YYYY-MM-DD HH24:MI:00') WHERE "ID"=rsvid;
      GET DIAGNOSTICS rows_affected = ROW_COUNT;
      RETURN rows_affected;
    END;
    $$ LANGUAGE plpgsql;`
    await psgl.sqlToPostgre(sql)
    sql = `SELECT updateReservation('${info.status}',${info.disease},${info.nursery},'${info.parent_name}','${info.parent_tel}','${info.meal_details}','${info.cramps}','${info.allergy_details}',${info.rsvid},${info.meal},'${intime}','${outime}');`
    let res1 = await psgl.sqlToPostgre(sql)
    return res1[0].updatereservation
  } catch (error) {
    console.log("ERR @updateReservationInfo: "+error)
    return null
  }
}

exports.WaitingInfoTodayByNursery = async function (id){
  let sql = `SELECT "ID" FROM public."Reservation" WHERE "NurseryID" = '${id}' and "ReservationDate" = DATE 'today' and ("ReservationStatus" = 'Waiting' or "ReservationStatus" = 'Rejected' or "ReservationStatus" = 'Cancelled');`
  let result = await psgl.sqlToPostgre(sql)
  let res = []
  for (const i of result) {
    let sql = `SELECT "MemberID", "DiseaseID", "ReservationDate", "firstNursery", "secondNursery",  "thirdNursery", "ID" FROM public."ReservationDetails" WHERE "ID" = '${i.ID}';`
    res.push(await psgl.sqlToPostgre(sql))
  }
  return res//[{}]
}

exports.WaitingInfoTomorrowByNursery = async function (id){
  let sql = `SELECT "ID" FROM public."Reservation" WHERE "NurseryID" = '${id}' and "ReservationDate" = DATE 'tomorrow' and  ("ReservationStatus" = 'Waiting' or "ReservationStatus" = 'Rejected' or "ReservationStatus" = 'Cancelled');`
  let result = await psgl.sqlToPostgre(sql)
  let res = []
  for (const i of result) {
    let sql = `SELECT "MemberID", "DiseaseID", "ReservationDate", "firstNursery", "secondNursery",  "thirdNursery", "ID" FROM public."ReservationDetails" WHERE "ID" = '${i.ID}';`
    res.push(await psgl.sqlToPostgre(sql))
  }
  return res//[{}]
}

exports.WaitingInfoDayAfterTomorrowByNursery = async function (id){
  let sql = `SELECT "ID" FROM public."Reservation" WHERE "NurseryID" = '${id}' and "ReservationDate" = CURRENT_DATE + 2 and  ("ReservationStatus" = 'Waiting' or "ReservationStatus" = 'Rejected' or "ReservationStatus" = 'Cancelled');`
  let result = await psgl.sqlToPostgre(sql)
  let res = []
  for (const i of result) {
    let sql = `SELECT "MemberID", "DiseaseID", "ReservationDate", "firstNursery", "secondNursery",  "thirdNursery", "ID" FROM public."ReservationDetails" WHERE "ID" = '${i.ID}';`
    res.push(await psgl.sqlToPostgre(sql))
  }
  return res//[{}]
}

exports.ReservedInfoTodayByNursery = async function (id){
  let sql = `SELECT "ID" FROM public."Reservation" WHERE "NurseryID" = '${id}' and "ReservationDate" = DATE 'today' and "ReservationStatus" = 'Reserved';`
  let result = await psgl.sqlToPostgre(sql)
  let res = []
  for (const i of result) {
    let sql = `SELECT "MemberID", "DiseaseID", "ReservationDate", "firstNursery", "secondNursery",  "thirdNursery", "ID" FROM public."ReservationDetails" WHERE "ID" = '${i.ID}';`
    res.push(await psgl.sqlToPostgre(sql))
  }
  return res//[{}]
}

exports.ReservedInfoTomorrowByNursery = async function (id){
  let sql = `SELECT "ID" FROM public."Reservation" WHERE "NurseryID" = '${id}' and "ReservationDate" = DATE 'tomorrow' and "ReservationStatus" = 'Reserved';`
  let result = await psgl.sqlToPostgre(sql)
  let res = []
  for (const i of result) {
    let sql = `SELECT "MemberID", "DiseaseID", "ReservationDate", "firstNursery", "secondNursery",  "thirdNursery", "ID" FROM public."ReservationDetails" WHERE "ID" = '${i.ID}';`
    res.push(await psgl.sqlToPostgre(sql))
  }
  return res//[{}]
}

exports.ReservedInfoDayAfterTomorrowByNursery = async function (id){
  let sql = `SELECT "ID" FROM public."Reservation" WHERE "NurseryID" = '${id}' and "ReservationDate" = CURRENT_DATE + 2 and "ReservationStatus" = 'Reserved';`
  let result = await psgl.sqlToPostgre(sql)
  let res = []
  for (const i of result) {
    let sql = `SELECT "MemberID", "DiseaseID", "ReservationDate", "firstNursery", "secondNursery", "ID",  "thirdNursery" FROM public."ReservationDetails" WHERE "ID" = '${i.ID}';`
    res.push(await psgl.sqlToPostgre(sql))
  }
  return res//[{}]
}

exports.getTodayWaitingRsvIDLineIDListSortByCreatedAt = async function (){
  let sql = `SELECT "ID", "NurseryID" FROM public."Reservation" WHERE "ReservationDate" = DATE 'today' and "ReservationStatus" = 'Waiting' ORDER BY "CreatedAt";`
  let result = await psgl.sqlToPostgre(sql)
  let res = []
  for (const i of result) {
    let sql = `SELECT "MemberID" FROM public."ReservationDetails" WHERE "ID" = '${i.ID}';`
    let memberid = await psgl.sqlToPostgre(sql)
    sql = `SELECT "LINEID" FROM public."Member" WHERE "ID" = '${memberid[0].MemberID}';`
    let lineid = await psgl.sqlToPostgre(sql)
    res.push({rsvid:i.ID, memberid:memberid[0].MemberID, lineid:lineid[0].LINEID, nurseryid:i.NurseryID})
  }
  return res//[{}]
}

exports.getNurseryIDByResevationID = async function (id){
  let sql = `SELECT "NurseryID" FROM public."Reservation" WHERE  "ID" = '${id}';`
  let result = await psgl.sqlToPostgre(sql)
  return result//[{}]
}

exports.ReservedTodayByNursery = async function (id){
  let sql = `SELECT COUNT(*) FROM public."Reservation" WHERE "NurseryID" = '${id}' and "ReservationDate" = DATE 'today' and ("ReservationStatus" = 'Reserved' or "ReservationStatus" = 'Waiting');`
  let result = await psgl.sqlToPostgre(sql)
  return result//[{}]
}

exports.ReservedTomorrowByNursery = async function (id){
  let sql = `SELECT "ReservationStatus" FROM public."Reservation" WHERE "NurseryID" = '${id}' and "ReservationDate" = DATE 'tomorrow' and ("ReservationStatus" = 'Reserved' or "ReservationStatus" = 'Waiting');`
  let result = await psgl.sqlToPostgre(sql)
  return result//[{}]
}

exports.ReservedDayAfterTomorrowByNursery = async function (id){
  let sql = `SELECT "ReservationStatus" FROM public."Reservation" WHERE "NurseryID" = '${id}' and "ReservationDate" = CURRENT_DATE + 2 and ("ReservationStatus" = 'Reserved' or "ReservationStatus" = 'Waiting');`
  let result = await psgl.sqlToPostgre(sql)
  return result//[{}]
}

exports.getReservationConfirmationFalseGraterThanToday = async function (){
  let sql = `SELECT "ID" FROM public."Reservation" WHERE "ReservationDate" >= DATE 'today' and "Confirmation" = 'false';`
  let result = await psgl.sqlToPostgre(sql)
  let res = []
  for (const i of result) {
    let sql = `SELECT "MemberID", "DiseaseID", "ReservationDate", "firstNursery", "secondNursery",  "thirdNursery", "ID" FROM public."ReservationDetails" WHERE "ID" = '${i.ID}';`
    res.push(await psgl.sqlToPostgre(sql))
  }
  return res
}

exports.getReservationStatusByMemberID = async function (memberid){
  let sql = `SELECT "ReservationStatus" FROM public."Reservation" WHERE "MemberID" = '${memberid}';`
  let result = await psgl.sqlToPostgre(sql)
  return result
}

exports.getReservedMemberIDOnTheDay = async function (date){
  let sql = `SELECT "MemberID" FROM public."Reservation" WHERE "ReservationDate" = DATE '${date}';`
  let result = await psgl.sqlToPostgre(sql)
  return result//[{}]
}

exports.updateStatusNurseryConfirmationByReservationID = async function (rsvid, status, nurseryid){
  let sql = `BEGIN;
  UPDATE public."Reservation" SET "Confirmation"= 'true', "ReservationStatus" = '${status}', "NurseryID" = '${nurseryid}', "UpdatedTime"=to_timestamp(${Date.now()} / 1000.0)   WHERE "ID"= '${rsvid}';
  UPDATE public."ReservationDetails" SET "firstNursery"= '${nurseryid}' WHERE "ID"= '${rsvid}';
COMMIT;`
  let res = await psgl.sqlToPostgre(sql)
  console.log('updates:'+res)
  return res
}