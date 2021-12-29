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
    const status = btn_value.substr(0, btn_value.indexOf('_'));
    const rsvid = btn_value.substr(btn_value.indexOf('_') + 1);
    e.preventDefault();            
    //checkd trueにするのをわすれない  
    $.confirmModal('「'+$(this).text()+'」でよろしいですか？', function(el) {
      console.log(btn_value)
      console.log(status)
      console.log(rsvid)
      console.log($(`[name=.row_nursery_${rsvid}]`).val())
      /*$.ajax({
        url: '/updater',
        type: 'POST',
        data: {
          'status': status
        },
        dataType: 'text'
      }).done(function( data, textStatus, jqXHR ) {
        //成功
        console.log("成功")
      }).fail(function( jqXHR, textStatus, errorThrown) {
        //失敗
        console.log("失敗")
      }).always(function( jqXHR, textStatus) {
        //通信完了
        console.log("通信完了")
      });//end of ajax*/
    })//end of confirm
  });

});//end of jquery