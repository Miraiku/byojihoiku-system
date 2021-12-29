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
          position = "center", // left, center, right, bottom
          autohide = true,
          msg = "",
          opacity = 0.8,
          multiline: 0,
          fade: 0,
          bgcolor: "",
          color: "",
          timeout: 5000,
          zindex: null,
          offset: 0,
          animation: 'slide'
        });
        //成功
        console.log("成功"+data)
        console.log("成功"+textStatus)
        console.log("成功"+jqXHR)
      }).fail(function( jqXHR, textStatus, errorThrown) {
        notif({
          type: "error",
          position = "center",
          msg = "",
          opacity = 0.8,
          multiline: 0,
          fade: 0,
          bgcolor: "",
          color: "",
          timeout: 5000,
          zindex: null,
          offset: 0,
          animation: 'slide'
        });
        console.log("失敗"+jqXHR)
        console.log("失敗"+textStatus)
        console.log("失敗"+errorThrown)
      }).always(function( jqXHR, textStatus) {
        //通信完了
        console.log("通信完了")
      });//end of ajax
    })//end of confirm
  });

});//end of jquery