const message = "変更を保存しますか？";
const title = "確認メッセージ";

$(".btn_status_update").click(function(){
  eModal
  .confirm(message, title)
  .then(
    function (dom) { 

      console.log('updated:'+dom)

    },
    function (dom) { 
      console.log('updated cancel:'+dom)
    }
  );
});