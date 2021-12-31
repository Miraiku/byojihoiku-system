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

  //update /member/entry with validation
  (function(){
    $.extend($.validator.messages, {
      miraikuid: '*半角数字で入力してください',
      year: '*半角数字で入力してください',
      required: '*入力必須です',
      miraikuid: '*半角数字で入力してください',
      year: '*半角数字で入力してください',
      required: '*入力必須です'
    });
    $.validator.addMethod('zenkana', function(value, element){
        if ( this.optional( element ) ) {
          return true;
        }
        return !!value.match(/^[ァ-ヶー　]*$/)
      },'*全角カナで入力してください');

    var rules = {
      miraikuid: {required:true, number: true},
      year: {required:true, number: true},
      name: {required: true, zenkana:true}
    };

    var messages = {
      name: {
        required: "*名前を入力してください",
      },
      miraikuid: {
        required: "*IDを入力してください",
        number: "*半角数字で入力してください"
      },
      year: {
        required: "*半角数字を入力してください",
        number: "*半角数字で入力してください"
      }
    };

    $(function(){
      const memberInfo = $('#memberInfo')
      memberInfo.validate({
        rules: rules,
        messages: messages,
        errorPlacement: function(error, element){
          error.css('color','#F16B6D');
          if (element.is(':radio')) {
            error.appendTo(element.parent());
          }else {
            error.insertAfter(element);
          }
        }
      });
      //update from /member/entry
      $(".btn_update_member").on('click', function(e) {
        if (memberInfo.validate().form()) {
          const miraikuid = $('input[name="miraikuid"]').val()
          const name = $('input[name="name"]').val()
          const year = $('input[name="year"]').val()
          const month = $('[name="month"] option:selected').val()
          const day = $('[name="day"] option:selected').val()
          const allergy = $('input[name="allergy"]:checked').val()       
          const memberid = $('input[name="id"]').val()      
          const birthday = year+month+day 
          e.preventDefault(); 
          $.confirmModal('内容を変更しますか？', function(el) {
            $.ajax({
              url: '/updater',
              type: 'POST',
              data: {
                'action': 'update_member_from_member_entry',
                'miraikuid':miraikuid,
                'name':name,
                'birthday':birthday,
                'allergy':allergy,
                'memberid':memberid
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
        } else {
            return false
        }
      });
    });//validation function scope
  })();

  //update from /reservation/entry with validation
  (function(){
    $.extend($.validator.messages, {
      required: '*入力必須です'
    });
    var rules = {
      parent_name: {required:true},
      parent_tel: {required:true},
      meal_details: {required:true},
      cramps: {required:true},
      allergy_details: {required: true}
    };

    $(function(){
      const rsvInfo = $('#rsvInfo')
      rsvInfo.validate({
        rules: rules,
        errorPlacement: function(error, element){
          error.css('color','#F16B6D');
          if (element.is(':radio')) {
            error.appendTo(element.parent());
          }else {
            error.insertAfter(element);
          }
        }
      });
      //update from /reservation/entry
      $(".btn_update_reservation").on('click', function(e) {
        if (rsvInfo.validate().form()) {
          const status = $('[name="status"] option:selected').val()
          const disease = $('[name="disease"] option:selected').val()
          const intime_hour = $('[name="intime_hour"] option:selected').val()
          const intime_mins = $('[name="intime_mins"] option:selected').val()
          const outtime_hour = $('[name="outtime_hour"] option:selected').val()
          const outtime_mins = $('[name="outtime_mins"] option:selected').val()
          const nursery = $('[name="nursery"] option:selected').val()
          const parent_name = $('input[name="parent_name"]').val()
          const parent_tel = $('input[name="parent_tel"]').val()
          const meal_details = $('input[name="meal_details"]').val()
          const cramps = $('input[name="cramps"]').val()
          const allergy_details = $('input[name="allergy_details"]').val()
          const allergy = $('input[name="allergy"]:checked').val()
          console.log(status)
          console.log(disease)
          console.log(intime_hour)
          console.log(intime_mins)
          console.log(outtime_hour)
          console.log(outtime_mins)   
          console.log(nursery)
          console.log(parent_name)
          console.log(parent_tel)
          console.log(meal_details)
          console.log(cramps)
          console.log(allergy_details)       
          console.log(allergy)    
          e.preventDefault(); 
          $.confirmModal('内容を変更しますか？', function(el) {
            /*$.ajax({
              url: '/updater',
              type: 'POST',
              data: {
                'action': 'update_member_from_member_entry',
                'miraikuid':miraikuid,
                'name':name,
                'year':year,
                'month':month,
                'day':day,
                'allergy':allergy
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
            });//end of ajax*/
          })//end of confirm
        } else {
            return false
        }
      });
    });//validation function scope
  })();

  //update from / with validation
  (function(){
    $.extend($.validator.messages, {
      required: '*入力必須です'
    });
    var rules = {
      name: {required:true, },
      password: {required:true}
    };

    $(function(){
      const loginForm = $('#loginForm')
      loginForm.validate({
        rules: rules,
        errorPlacement: function(error, element){
          error.css('color','#F16B6D');
          if (element.is(':radio')) {
            error.appendTo(element.parent());
          }else {
            error.insertAfter(element);
          }
        }
      });
      $(".btn_login_check").on('click', function(e) {
        if (loginForm.validate().form()) {
          const name = $('input[name="name"]').val()
          const password = $('input[name="password"]').val()
          $.ajax({
            url: '/',
            type: 'POST',
            data: {
              'action': 'login_check',
              'Name':name,
              'Password':password
            },
            dataType: 'text'
          }).done(function( data, textStatus, jqXHR ) {
            window.location.href = '/home'
          }).fail(function( jqXHR, textStatus, errorThrown) {
            let errmsg = ''
            if(errorThrown == 'Not Acceptable'){
              errmsg = 'ログイン情報が間違っています'
            }else if(errorThrown == 'Service Unavailable'){
              errmsg = 'エラーが発生しました'
            }else if(errorThrown == 'Internal Server Error'){
              errmsg = 'エラーが発生しました'
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
        } else {
            return false
        }
      });
    });//validation function scope
  })();

  //register from /secret/register
  (function(){
    $.extend($.validator.messages, {
      required: '*入力必須です'
    });
    var rules = {
      name: {required:true, },
      password: {required:true}
    };

    $(function(){
      const registerForm = $('#registerForm')
      registerForm.validate({
        rules: rules,
        errorPlacement: function(error, element){
          error.css('color','#F16B6D');
          if (element.is(':radio')) {
            error.appendTo(element.parent());
          }else {
            error.insertAfter(element);
          }
        }
      });
      $(".btn_login_register").on('click', function(e) {
        if (registerForm.validate().form()) {
          const name = $('input[name="name"]').val()
          const password = $('input[name="password"]').val()
          $.ajax({
            url: '/secret/regsiter',
            type: 'POST',
            data: {
              'action': 'login_register',
              'Name':name,
              'Password':password
            },
            dataType: 'text'
          }).done(function( data, textStatus, jqXHR ) {
            notif({
              type: "success",
              position: "center",
              autohide: true,
              msg: "登録が完了しました",
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
            if(errorThrown == 'Not Found'){
              window.location.href = '/'
              return false
            }

            let errmsg = "登録に失敗しました"
            if(errorThrown == 'Not Acceptable'){
              errmsg = 'すでに登録されています'
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
        } else {
            return false
        }
      });
    });//validation function scope
  })();

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