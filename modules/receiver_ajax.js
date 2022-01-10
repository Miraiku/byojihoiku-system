const express = require('express');
const router = express.Router()
const psgl = require('./db_postgre')
const view = require('./view_data_render');

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
          res.status(406).send('予約の空きがないため変更できませんでした。');
          return
        }
      }else if(action == 'update_member_from_member_entry'){
        let updated = await psgl.updateMemberInfo(req.body)
        if(updated > 0 && updated != null){
          res.status(200).send('Success');
        }else{
          res.status(406).send();
        }
      }else if(action == 'update_member_from_reservation_entry'){
        const new_nurseryid = req.body.nursery
        const rsvid = req.body.rsvid
        let canUpdate = false

        let current_nurseryid = await psgl.getNurseryIDByResevationID(rsvid)
        current_nurseryid = current_nurseryid[0].NurseryID
        if(new_nurseryid != current_nurseryid){
          let nursery_capacity = await psgl.getNurseryCapacityByID(new_nurseryid)
          nursery_capacity = nursery_capacity[0].Capacity
          let reservation_date = await psgl.getReservationDateByID(rsvid)
          reservation_date = reservation_date[0].ReservationDate
          let reservation_num_on_day = await psgl.canNurseryReservationOnThatDay(view.getPsglTimeStampFromDayDataObj(reservation_date), new_nurseryid)
          let new_capacity = Number(reservation_num_on_day[0].count)
          if((nursery_capacity - new_capacity) > 0){
            canUpdate = true
          }else{
            canUpdate = false
          }
        }else{
          canUpdate = true
        }
        if(canUpdate){
          let reservation_date = await psgl.getReservationDateByID(req.body.rsvid)
          reservation_date = reservation_date[0].ReservationDate
          reservation_date_formatted_psgl = view.getPsglTimeStampYMDFromDayDataObj(reservation_date)
          let intime = reservation_date_formatted_psgl + ' ' + ('00' + req.body.intime_hour).slice(-2) + ':' + ('00' + req.body.intime_mins).slice(-2) + ':00'
          let outtime = reservation_date_formatted_psgl + ' ' + ('00' + req.body.outtime_hour).slice(-2) + ':' + ('00' + req.body.outtime_mins).slice(-2) + ':00'
          let updated = await psgl.updateReservationInfo(req.body, intime, outtime)
  
          if(updated > 0 && updated != null){
            res.status(200).send('Success');
          }else{
            res.status(503).send();
          }
        }else{
          res.status(406).send();
        }
      }else if(action == 'delete_member'){
        let can_delete = await psgl.getReservationStatusByMemberIDGraterThanToday(req.body.memberid)
        if(can_delete.length > 0){
          res.status(409).send();
        }else{
          let deleted = await psgl.delMemberByIDName(req.body.memberid, req.body.name)
          if(deleted > 0 && deleted != null){
            res.status(200).send('Success');
          }else{
            res.status(406).send();
          }
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