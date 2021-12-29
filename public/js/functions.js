$(function() {
  $defaultsConfirmModal = {
    confirmButton: 'はい',
    cancelButton: 'いいえ',
    fadeAnimation: true,
    modalVerticalCenter: true,
    autoFocusOnConfirmBtn: true
  };

  $(".btn_status_update").on('click', function(e) {
    console.log(e);
    console.log($(this).val());
    console.log($(this).name());
    e.preventDefault();              
    $.confirmModal('「'+$(this).name()+'」に変更してよろしいですか？', function(el) {
      
    console.log(el);
      //do something...
    });         
  });

});//end of jquery