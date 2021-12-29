const express = require('express');
const router = express.Router()
const https = require("https");
const psgl = require('./db_postgre')
const redis = require('./db_redis')
const view = require('./view_data_render');
const Holidays = require('date-holidays');
const { is } = require('express/lib/request');
const TOKEN = process.env.LINE_ACCESS_TOKEN

router
  .post('/', async (req, res) => {
    /*
    Ajax Message
    */
    try {
      const action = req.body.action

      if (action == 'update_status_from_home') {
        const status = req.body.status
        const new_nurseryid = req.body.nurseryid
        const rsvid = req.body.rsvid

        let current_nurseryid = await psgl.getNurseryIDByResevationID(rsvid)
        current_nurseryid = current_nurseryid[0].NurseryID
        if(new_nurseryid != current_nurseryid){
          let nursery_capacity = await psgl.getNurseryCapacityByID(new_nurseryid)
          nursery_capacity = nursery_capacity[0].Capacity
          let reservation_date = await psgl.getReservationDateByID(rsvid)
          reservation_date = reservation_date[0].ReservationDate
          console.log(reservation_date)
          let reservation_num_on_day = await psgl.canNurseryReservationOnThatDay(view.getPsglTimeStampFromDayDataObj(reservation_date), new_nurseryid)
          let new_capacity = Number(reservation_num_on_day[0].count)
          console.log('org'+nursery_capacity)
          console.log('new'+new_capacity)
          if((nursery_capacity - new_capacity) > 0){
            await psgl.updateStatusNurseryConfirmationByReservationID(rsvid, status, new_nurseryid)
            res.status(200).send('Success');
          }else{
            res.status(406).send('満員のため変更できませんでした。');
            return
          }
        }else{
          await psgl.updateStatusNurseryConfirmationByReservationID(rsvid, status, new_nurseryid)
          res.status(200).send('Success');
        }
      }
    } catch (err) {
      console.error("Ajax Receiver： "+err);
      res.status(503).send('申し訳ありません。変更できませんでした。');
    }

  })

module.exports = router