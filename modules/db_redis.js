const express = require('express');
const router = express.Router()
const Redis = require("ioredis");
const redis_client = new Redis(process.env.REDIS_URL);

exports.hsetStatus = async function (id,key,val){
  try {
    //SET Status 2
    await redis_client.hset(id,key,val, (err, reply) => {
      if (err) throw err;
      console.log('HSET Status :'+ id + ', key:' + key + 'val: '+ val);
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
    await redis_client.hset(id,key, (err, reply) => {
      if (err) throw err;
      console.log('HSET Status :'+ id + ', key:' + key);
    });
  }
  catch (err) {
    console.log(`REDIS ERR: ${err}`)
    return null
  }
}

exports.client = function (){
  return redis_client
}

