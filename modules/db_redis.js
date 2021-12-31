const express = require('express');
const router = express.Router()
const Redis = require("ioredis");
const { default: redis } = require('ioredis/built/redis');
const redis_client = new Redis(process.env.REDIS_URL);
const redis_modules = require('./db_redis')

exports.hsetStatus = async function (id,key,val){
  try {
    let now = Date.now()
    await redis_client.hset('update_time',id, now, (err, reply) => {
      if (err) throw err;
      console.log('HSET updated time : id:' + id + ', time: '+ now);
    });
    await redis_client.hset(id,key,val, (err, reply) => {
      if (err) throw err;
      console.log('HSET Status :'+ id + ', key:' + key + ', val: '+ val);
      return true
    });
  }catch (err) {
    console.log(`REDIS ERR: ${err}`)
    return false
  }
}

exports.hgetStatus = async function (id,key){
  try {
    let result
    await redis_client.hget(id,key, (err, reply) => {
      if (err) throw err;
      console.log('HGET Status :'+ id + ', key:' + key + ', val: '+ reply);
      result = reply
    });
    return result
  }
  catch (err) {
    console.log(`REDIS ERR: ${err}`)
    return null
  }
}

exports.hgetAll = async function (id,key){
  try {
    let result
    await redis_client.hgetall(id, (err, reply) => {
      if (err) throw err;
      Object.entries(reply).forEach(([k, v]) => {
        console.log("REDIS hgetall result: "+k+"："+v)
      });
      result = reply
    });
    return result
  }
  catch (err) {
    console.log(`REDIS ERR: ${err}`)
    return null
  }
}

exports.resetAllStatus = async function (id){
  await redis_client.hgetall(id, async (err, reply) => {
    if (err) throw err;
    Object.keys(reply).forEach(async function (key,val) {
      await redis_client.hdel(id, key,(err, reply) => {
        if (err) throw err;
        console.log('REDIS DELETED KEY: ' + key+ ' ,' + reply)
      });
    });
    await redis_client.del(id, (err, reply) => {
      if (err) throw err;
      console.log('REDIS DELETED ID: ' + id + ' ,' + reply)
    });
  });
}

exports.flushALL = async function(){
  await redis_client.flushall((err, reply) => {
    if (err) throw err;
    console.log("REDIS flushall:" + reply)
  });
}

exports.flushALLNoUpdate20mins = async function(){
  try {
    let result
    await redis_client.hgetall('update_time', (err, reply) => {
      if (err) throw err;
      result = reply
    });
    Object.entries(result).forEach(async ([k, v]) => { 
      if(k == 'waitinglist'){ //waitingリストは手動で削除する
        continue
      }
      let now = Date.now()
      let diff_time = now - v;
      console.log('HDETALL No Update within 20mins :'+ k + ', '+ v);
      let pass_minutes = Math.floor(diff_time / (60 * 1000));
      console.log("DIFF TIMEL mins " +pass_minutes)
      if(pass_minutes > 20){
        redis_modules.resetAllStatus(k)
        await redis_client.hdel('update_time', k, (err, reply) => {
          if (err) throw err;
          console.log('REDIS DELETED update_time: ' + k + ' ,' + reply)
        })
      }
    });
  }
  catch (err) {
    console.log(`REDIS ERR: ${err}`)
  }
}