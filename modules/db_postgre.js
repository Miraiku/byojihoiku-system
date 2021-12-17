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

exports.getNurseryID_Name_Capacity = async function (){
  let nursery_list = []
  let nursery = await psgl.getNurseryTable()
  for await (const v of nursery) {
    console.log(v)
    nursery_list.push({id:v['ID'], name:v['NurseryName'], capacity:v['Capacity']})
  }
  console.log(nursery_list)
  return nursery_list
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