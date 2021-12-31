const express = require('express');
const router = express.Router()
const https = require("https");
const psgl = require('./db_postgre')
const redis = require('./db_redis')
const view = require('./view_data_render');
const Holidays = require('date-holidays');
const { is } = require('express/lib/request');
const TOKEN = process.env.LINE_ACCESS_TOKEN
const login = require('./view_login');
const { off } = require('process');

router
  .post('/', async (req, res) => {
    /*
    Ajax Message
    */
    try {
      const action = req.body.action

      if (action == 'update_status_from_home' || action == 'update_status_from_rsv') {
        const status = req.body.status
        const new_nurseryid = req.body.nurseryid
        const rsvid = req.body.rsvid

        let current_nurseryid = await psgl.getNurseryIDByResevationID(rsvid)
        current_nurseryid = current_nurseryid[0].NurseryID
        if(new_nurseryid != current_nurseryid && status == "Reserved"){
          let nursery_capacity = await psgl.getNurseryCapacityByID(new_nurseryid)
          nursery_capacity = nursery_capacity[0].Capacity
          let reservation_date = await psgl.getReservationDateByID(rsvid)
          reservation_date = reservation_date[0].ReservationDate
          let reservation_num_on_day = await psgl.canNurseryReservationOnThatDay(view.getPsglTimeStampFromDayDataObj(reservation_date), new_nurseryid)
          let new_capacity = Number(reservation_num_on_day[0].count)
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
      }else if(action == 'update_member_from_member_entry'){
        let updated = await psgl.updateMemberInfo(req.body)
        if(updated > 0 && updated != null){
          res.status(200).send('Success');
        }else{
          res.status(406).send();
        }
      }else if(action == 'update_member_from_reservation_entry'){
        let reservation_date = await psgl.getReservationDateByID(req.body.rsvid)
        reservation_date = reservation_date[0].ReservationDate
        reservation_date_formatted_psgl = view.getPsglTimeStampYMDFromDayDataObj(reservation_date)
        let intime = reservation_date_formatted_psgl + ' ' + ('00' + req.body.intime_hour).slice(-2) + ':' + ('00' + req.body.intime_mins).slice(-2) + ':00'
        let outtime = reservation_date_formatted_psgl + ' ' + ('00' + req.body.outtime_hour).slice(-2) + ':' + ('00' + req.body.outtime_mins).slice(-2) + ':00'
        let updated = await psgl.updateReservationInfo(req.body, intime, outtime)

        if(updated > 0 && updated != null){
          res.status(200).send('Success');
        }else{
          res.status(406).send();
        }
      }else if(action == 'delete_member'){
        let can_delete = await psgl.getReservationStatusByMemberIDGraterThanToday(req.body.memberid)
        console.log(can_delete)
        if(can_delete == null){
          let deleted =  await psgl.delMemberByIDName(req.body.memberid, req.body.name)
          if(deleted > 0 && deleted != null){
            res.status(200).send('Success');
          }else{
            res.status(406).send();
          }
        }else{
          res.status(409).send();
        }

      }else{
        console.error("Ajax Receiver： Nothing Happend");
        res.status(503).send('エラーが発生しました');
      }
    } catch (err) {
      console.error("Ajax Receiver： "+err);
      res.status(503).send('エラーが発生しました');
    }

  })

module.exports = router