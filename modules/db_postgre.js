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

exports.getAvailableNurseryOnThatDay = async function (date){
  let available = {}
  Object.entries(await psgl.getNurseryTable()).forEach(async ([k, v]) =>  {
      let sql = `SELECT COUNT ("ID") FROM public."Reservation" WHERE "ReservationStatus" = 'Reserved' and "ReservationDate"::text LIKE '`+date+`%' and "NurseryID" = '`+v['ID']+`';`
      let c = await psgl.sqlToPostgre(sql)
      Object.entries(c).forEach(async ([k, v]) =>  {
        console.log('aaaaa ' +k +', '+v[0]['count'])
      })
      if(Number(c) <= Number(v['Capacity'])){
        available += {id: v['ID'], capacity: c}
      }
  }) 
  return available
}