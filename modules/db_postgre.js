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
  let sql = `SELECT "ID" FROM public."Member" WHERE "Name" = '`+name+`' and "LINEID" = '`+lineid+`' and "BirthDay" = '`+birthday+`';`
  return await psgl.sqlToPostgre(sql)
}

exports.getMemberedIDFromNameAndBirthDay = async function (lineid, name, birthday){
  let sql = `SELECT "ID" FROM public."Member" WHERE "Name" = '`+name+`' and "LINEID" = '`+lineid+`' and "BirthDay" = '`+birthday+`';`
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

exports.isValidMealInMealTable = async function (id){
  let sql = `SELECT "ID" FROM public."Disease" WHERE "DiseaseID" = '`+id+`';`
  return await psgl.sqlToPostgre(sql)
}

exports.getDiseaseList = async function (date){
  let results = []
  let sql = `SELECT "DiseaseID", "DiseaseName" FROM public."Disease";`
  let r = await psgl.sqlToPostgre(sql)
  for await (const v of r) {
    results.push({id:v['DiseaseID'], name:v['MealName']})
  }
  return results
}

exports.getDiseaseNameFromID = async function (id){
  let sql = `SELECT "DiseaseName" FROM public."Disease" WHERE "DiseaseID" = '`+id+`';`
  return await psgl.sqlToPostgre(sql)
}