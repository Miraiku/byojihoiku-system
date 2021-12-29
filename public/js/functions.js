const message = "変更を保存しますか？";
const title = "確認メッセージ";

$(".btn_status_update").on('click', function(e) {
  e.preventDefault();              
  $.confirmModal('Are you sure you want to do this?', function(el) {
    alert('OK was clicked!');
    //do something...
  });         
});
