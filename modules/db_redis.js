const express = require('express');
const router = express.Router()
const Redis = require("ioredis");
const redis_client = new Redis(process.env.REDIS_URL);

exports.hsetStatus = async function (id,key,val){
  try {
    //SET Status 2
    await redis_client.hset(id,key,val, (err, reply) => {
      if (err) throw err;
      console.log('HSET Status :'+ id + ', key:' + key + ', val: '+ val);
    });
  }
  catch (err) {
    console.log(`REDIS ERR: ${err}`)
    return null
  }
}

exports.hgetStatus = async function (id,key){
  try {
    //SET Status 2
    await redis_client.hget(id,key, (err, reply) => {
      if (err) throw err;
      console.log('HGET Status :'+ id + ', key:' + key + ', val: '+ reply);
      return reply
    });
  }
  catch (err) {
    console.log(`REDIS ERR: ${err}`)
    return null
  }
}

exports.hgetAll = async function (id,key){
  try {
    //SET Status 2
    await redis_client.hgetall(id, (err, reply) => {
      if (err) throw err;
      console.log('HGETALL Status :'+ reply);
      return reply
    });
  }
  catch (err) {
    console.log(`REDIS ERR: ${err}`)
    return null
  }
}

exports.resetAllStatus = async function (id){
  await redis_client.hgetall(id, (err, reply) => {
    if (err) throw err;
    console.log('REDIS DELETED ID: ' + id)
    Object.keys(reply).forEach(async function (key,val) {
      await redis_client.hdel(id, key,(err, reply) => {
        if (err) throw err;
        console.log('REDIS DELETED KEY: ' + key)
        console.log('REDIS DELETED VALUE: ' + val)
      });
    });
  });
}