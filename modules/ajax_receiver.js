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

        let current_nurseryid = await psgl.getNurseryIDByResevationID(nurseryid)
        current_nurseryid = current_nurseryid[0].NurseryID
        if(new_nurseryid != current_nurseryid){
          let nursery_capacity = await psgl.getNurseryCapacityByID(new_nurseryid)
          let reservation_date = await getReservationDateByID(rsvid)
          let reservation_num_on_day = await psgl.canNurseryReservationOnThatDay(view.getPsglTimeStampFromDayDataObj(reservation_date), new_nurseryid)
          let new_capacity = Number(reservation_num_on_day[0].count)
          console.log(nursery_capacity)
          console.log(new_capacity)
          if(nursery_capacity - new_capacity > 0){
            //await psgl.updateStatusNurseryConfirmationByReservationID(rsvid, status, new_nurseryid)
          }else{
            res.status(503).send('満員のため変更できませんでした。');
            return
          }
        }else{
          //await psgl.updateStatusNurseryConfirmationByReservationID(rsvid, status, new_nurseryid)
          res.status(200).send('Success: '+action);
        }
      }
    } catch (err) {
      console.error("Ajax Receiver： "+err);
      res.status(503).send('申し訳ありません。変更できませんでした。');
    }

  })

module.exports = router