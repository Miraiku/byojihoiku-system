

$(function() {
  $defaultsConfirmModal = {
    confirmButton: 'はい',
    cancelButton: 'いいえ',
    fadeAnimation: true,
    modalVerticalCenter: true,
    autoFocusOnConfirmBtn: true
  };

  $(".btn_status_update").on('click', function(e) {
    e.preventDefault();              
    $.confirmModal('変更してよろしいですか？', function(el) {
      alert('OK was clicked!');
      //do something...
    });         
  });

});//end of jquery