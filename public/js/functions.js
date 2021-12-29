$(function() {
  $defaultsConfirmModal = {
    confirmButton: 'はい',
    cancelButton: 'いいえ',
    fadeAnimation: true,
    modalVerticalCenter: true,
    autoFocusOnConfirmBtn: true
  };

  $(".btn_status_update").on('click', function(e) {
    const btn_value = $(this).val()
    const status = btn_value.substr(0, btn_value.indexOf('_'))
    const rsvid = btn_value.substr(btn_value.indexOf('_') + 1)
    const nurseryid = $(`[name=row_nursery_${rsvid}]`).val()
    console.log(nurseryid)
    e.preventDefault();            
    //checkd trueにするのをわすれない  
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

  $('select').on('change', function() {
    $('option:selected').removeAttr("selected");

    const btn_value = 'Reserved_33'
    const status = btn_value.substr(0, btn_value.indexOf('_'))
    const rsvid = btn_value.substr(btn_value.indexOf('_') + 1)
    const nurseryid = $(`[name=row_nursery_${rsvid}]`).val()
    console.log(nurseryid)
  });
});//end of jquery