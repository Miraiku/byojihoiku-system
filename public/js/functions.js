$(function() {
  $defaultsConfirmModal = {
    confirmButton: 'はい',
    cancelButton: 'いいえ',
    fadeAnimation: true,
    modalVerticalCenter: true,
    autoFocusOnConfirmBtn: true
  };

  //update from /home
  $(".btn_status_update").on('click', function(e) {
    const btn_value = $(this).val()
    const status = btn_value.substr(0, btn_value.indexOf('_'))
    const rsvid = btn_value.substr(btn_value.indexOf('_') + 1)
    const nurseryid = $(`[name=row_nursery_${rsvid}]`).val()
    e.preventDefault();            
    $.confirmModal('「'+$(this).text()+'」でよろしいですか？', function(el) {
      $.ajax({
        url: '/updater',
        type: 'POST',
        data: {
          'action': 'update_status_from_home',
          'status': status,
          'nurseryid': nurseryid,
          'rsvid': rsvid
        },
        dataType: 'text'
      }).done(function( data, textStatus, jqXHR ) {
        notif({
          type: "success",
          position: "center",
          autohide: true,
          msg: "変更が完了しました",
          opacity:0.8,
          multiline: 0,
          fade: 0,
          bgcolor: "",
          color: "",
          timeout: 5000,
          zindex: null,
          offset: 0,
          animation: 'slide'
        });
      }).fail(function( jqXHR, textStatus, errorThrown) {
        let errmsg = ''
        if(errorThrown == 'Service Unavailable'){
          errmsg = '申し訳ありません、変更できませんでした'
        }else if(errorThrown == 'Not Acceptable'){
          errmsg = '変更先が満員のため変更できませんでした'
        }
        notif({
          type: "error",
          position: "center",
          msg: errmsg,
          opacity: 0.8,
          multiline: 0,
          fade: 0,
          bgcolor: "",
          color: "",
          timeout: 5000,
          zindex: null,
          offset: 0,
          animation: 'slide'
        });
        console.log("失敗"+errorThrown)
      }).always(function( jqXHR, textStatus) {
      });//end of ajax
    })//end of confirm
  });

  //update from /reservation
  $(".btn_status_update_rsv").on('click', function(e) {
    const btn_value = $(this).val()
    const status = btn_value.substr(0, btn_value.indexOf('_'))
    const rsvid = btn_value.substr(btn_value.indexOf('_') + 1)
    const nurseryid = $(`[name=row_nursery_${rsvid}]`).val()
    e.preventDefault();            
    $.confirmModal('「'+$(this).text()+'」でよろしいですか？', function(el) {
      $.ajax({
        url: '/updater',
        type: 'POST',
        data: {
          'action': 'update_status_from_rsv',
          'status': status,
          'nurseryid': nurseryid,
          'rsvid': rsvid
        },
        dataType: 'text'
      }).done(function( data, textStatus, jqXHR ) {
        notif({
          type: "success",
          position: "center",
          autohide: true,
          msg: "変更が完了しました",
          opacity:0.8,
          multiline: 0,
          fade: 0,
          bgcolor: "",
          color: "",
          timeout: 5000,
          zindex: null,
          offset: 0,
          animation: 'slide'
        });
      }).fail(function( jqXHR, textStatus, errorThrown) {
        let errmsg = ''
        if(errorThrown == 'Service Unavailable'){
          errmsg = '申し訳ありません、変更できませんでした'
        }else if(errorThrown == 'Not Acceptable'){
          errmsg = '変更先が満員のため変更できませんでした'
        }
        notif({
          type: "error",
          position: "center",
          msg: errmsg,
          opacity: 0.8,
          multiline: 0,
          fade: 0,
          bgcolor: "",
          color: "",
          timeout: 5000,
          zindex: null,
          offset: 0,
          animation: 'slide'
        });
        console.log("失敗"+errorThrown)
      }).always(function( jqXHR, textStatus) {
      });//end of ajax
    })//end of confirm
  });

  //update from /member/entry
  $(".btn_update_member").on('click', function(e) {
    const miraikuid = $('input[name="miraikuid"]').val()
    const name = $('input[name="name"]').val()
    const year = $('input[name="year"]').val()
    const month = $('[name="month"] option:selected').val()
    const day = $('[name="day"] option:selected').val()
    const allergy = $('input[name="allergy"]:checked').val()
    console.log(miraikuid)
    console.log(name)
    console.log(year)
    console.log(month)
    console.log(day)
    console.log(allergy)
    /*           
    e.preventDefault(); 
    $.confirmModal('「'+$(this).text()+'」でよろしいですか？', function(el) {
      $.ajax({
        url: '/updater',
        type: 'POST',
        data: {
          'action': 'update_status_from_rsv',
          'status': status,
          'nurseryid': nurseryid,
          'rsvid': rsvid
        },
        dataType: 'text'
      }).done(function( data, textStatus, jqXHR ) {
        notif({
          type: "success",
          position: "center",
          autohide: true,
          msg: "変更が完了しました",
          opacity:0.8,
          multiline: 0,
          fade: 0,
          bgcolor: "",
          color: "",
          timeout: 5000,
          zindex: null,
          offset: 0,
          animation: 'slide'
        });
      }).fail(function( jqXHR, textStatus, errorThrown) {
        let errmsg = ''
        if(errorThrown == 'Service Unavailable'){
          errmsg = '申し訳ありません、変更できませんでした'
        }else if(errorThrown == 'Not Acceptable'){
          errmsg = '変更先が満員のため変更できませんでした'
        }
        notif({
          type: "error",
          position: "center",
          msg: errmsg,
          opacity: 0.8,
          multiline: 0,
          fade: 0,
          bgcolor: "",
          color: "",
          timeout: 5000,
          zindex: null,
          offset: 0,
          animation: 'slide'
        });
        console.log("失敗"+errorThrown)
      }).always(function( jqXHR, textStatus) {
      });//end of ajax
    })//end of confirm
    */
  });

  //update from /reservation/entry
  $(".btn_update_reservation").on('click', function(e) {
    const btn_value = $(this).val()
    const status = btn_value.substr(0, btn_value.indexOf('_'))
    const rsvid = btn_value.substr(btn_value.indexOf('_') + 1)
    const nurseryid = $(`[name=row_nursery_${rsvid}]`).val()

  });

  $('select').on('change', function() {
    $("option:selected", this).removeAttr("selected");
  });

  $('input[type="radio"]').on('change', function() {
    $(this).removeAttr("checked");
  });

  function escapeHTML(string){
    return string.replace(/&/g, '&lt;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, "&#x27;");
  }

  function zenkaku2Hankaku(val) {
    var regex = /[Ａ-Ｚａ-ｚ０-９！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝]/g;

    // 入力値の全角を半角の文字に置換
    value = val
      .replace(regex, function (s) {
        return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
      })
      .replace(/[‐－―]/g, "-") // ハイフンなど
      .replace(/[～〜]/g, "~") // チルダ
      .replace(/　/g, " "); // スペース
    return value;
  }

  function isValidNum(s){
    //半角と全角どちらでも受け付ける
    if(Number.isNaN(Number(s))){
      if(Number.isNaN(Number(zenkaku2Hankaku(s)))){
        return false
      }else{
        return true
      }
    }else{
      return true
    }
  }
  
});//end of jquery