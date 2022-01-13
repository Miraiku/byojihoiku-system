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
    let btn_value = $(this).val()
    let btn_text = $(this).text()
    let status = btn_value.substr(0, btn_value.indexOf('_'))
    let rsvid = btn_value.substr(btn_value.indexOf('_') + 1)
    let nurseryid = $(`[name=row_nursery_${rsvid}]`).val()
    e.preventDefault();            
    $.confirmModal('「'+btn_text+'」でよろしいですか？', function(el) {
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
        setTimeout("location.reload()",2000);
      }).fail(function( jqXHR, textStatus, errorThrown) {
        let errmsg = ''
        if(errorThrown == 'Service Unavailable'){
          errmsg = '申し訳ありません、変更できませんでした'
        }else if(errorThrown == 'Not Acceptable'){
          errmsg = '変更先の空きがないため変更できませんでした'
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
  $(".btn_disable_member").on('click', function(e) {
    let del_memberid_name = $(this).val()
    let memberid = del_memberid_name.substr(0, del_memberid_name.indexOf('_'))
    let name = del_memberid_name.substr(del_memberid_name.indexOf('_') + 1)
    e.preventDefault();            
    $.confirmModal(`${name}さんの情報を削除しますか？`, function(el) {
      $.ajax({
        url: '/updater',
        type: 'POST',
        data: {
          'action': 'delete_member',
          'memberid': memberid,
          'name': name
        },
        dataType: 'text'
      }).done(function( data, textStatus, jqXHR ) {
        notif({
          type: "success",
          position: "center",
          autohide: true,
          msg: "削除が完了しました",
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
        setTimeout("location.reload()",2000);
      }).fail(function( jqXHR, textStatus, errorThrown) {
        let errmsg = '削除できませんでした'
        if(errorThrown == 'Conflict'){
          errmsg = '3日以内にご予約が入っているため削除できません'
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

  //delete from member/entry
  $(".btn_status_update_rsv").on('click', function(e) {
    let btn_value = $(this).val()
    let status = btn_value.substr(0, btn_value.indexOf('_'))
    let rsvid = btn_value.substr(btn_value.indexOf('_') + 1)
    let nurseryid = $(`[name=row_nursery_${rsvid}]`).val()
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
        setTimeout("location.reload()",2000);
      }).fail(function( jqXHR, textStatus, errorThrown) {
        let errmsg = ''
        if(errorThrown == 'Service Unavailable'){
          errmsg = '申し訳ありません、変更できませんでした'
        }else if(errorThrown == 'Not Acceptable'){
          errmsg = '変更先の空きがないため変更できませんでした'
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
      miraikuid: {required:true, number: true, min:1},
      year: {required:true, number: true, maxlength: 4, minlength: 4},
      name: {required: true, zenkana:true}
    };

    var messages = {
      name: {
        required: "*名前を入力してください",
      },
      miraikuid: {
        required: "*IDを入力してください",
        number: "*半角数字で入力してください",
        min: "*有効なIDを数字で入力してください"
      },
      year: {
        required: "*半角数字を入力してください",
        number: "*半角数字で入力してください",
        maxlength: '*数字は4桁で入力してください',
        minlength: '*数字は4桁で入力してください'
      }
    };

    $(function(){
      let memberInfo = $('#memberInfo')
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
          let miraikuid = $('input[name="miraikuid"]').val()
          let name = $('input[name="name"]').val()
          let year = $('input[name="year"]').val()
          let month = $('[name="month"] option:selected').val()
          month = ('00' + month).slice(-2);
          let day = $('[name="day"] option:selected').val()
          day = ('00' + day).slice(-2);
          let allergy = $('input[name="allergy"]:checked').val()       
          let memberid = $('input[name="id"]').val()      
          let birthday = year+month+day 
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
              setTimeout("location.reload()",2000);
            }).fail(function( jqXHR, textStatus, errorThrown) {
              let errmsg = ''
              if(errorThrown == 'Service Unavailable'){
                errmsg = '申し訳ありません、変更できませんでした'
              }else if(errorThrown == 'Not Acceptable'){
                errmsg = '申し訳ありません、変更できませんでした'
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
      let rsvInfo = $('#rsvInfo')
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
          let status = $('[name="status"] option:selected').val()
          let disease = $('[name="disease"] option:selected').val()
          let intime_hour = $('[name="intime_hour"] option:selected').val()
          let intime_mins = $('[name="intime_mins"] option:selected').val()
          let outtime_hour = $('[name="outtime_hour"] option:selected').val()
          let outtime_mins = $('[name="outtime_mins"] option:selected').val()
          let nursery = $('[name="nursery"] option:selected').val()
          let parent_name = $('input[name="parent_name"]').val()
          let parent_tel = $('input[name="parent_tel"]').val()
          let meal = $('[name="meal"] option:selected').val()
          let meal_details = $('[name="meal_details"] option:selected').val()
          let cramps = $('input[name="cramps"]').val()
          let allergy_details = $('input[name="allergy_details"]').val()
          let rsvid = $('input[name="rsvid"]').val() 
          if(meal_details == '無し'){
            meal_details = false
          }
          if(cramps == '無し'){
            cramps = false
          }
          if(allergy_details == '無し'){
            allergy_details = false
          }
          e.preventDefault(); 
          $.confirmModal('内容を変更しますか？', function(el) {
            $.ajax({
              url: '/updater',
              type: 'POST',
              data: {
                'action': 'update_member_from_reservation_entry',
                'status': status,
                'disease': disease,
                'intime_hour': intime_hour,
                'intime_mins': intime_mins,
                'outtime_hour': outtime_hour,
                'outtime_mins': outtime_mins ,
                'nursery': nursery,
                'parent_name': parent_name,
                'parent_tel': parent_tel,
                'meal': meal,
                'meal_details': meal_details,
                'cramps': cramps,
                'allergy_details': allergy_details,
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
              setTimeout("location.reload()",2000);
            }).fail(function( jqXHR, textStatus, errorThrown) {
              let errmsg = ''
              if(errorThrown == 'Service Unavailable'){
                errmsg = '変更できませんでした'
              }else if(errorThrown == 'Not Acceptable'){
                errmsg = '変更先の空きがないため変更できませんでした'
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
      let loginForm = $('#loginForm')
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
          let name = $('input[name="name"]').val()
          let password = $('input[name="password"]').val()
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
      let registerForm = $('#registerForm')
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
          let name = $('input[name="name"]').val()
          let password = $('input[name="password"]').val()
          $.ajax({
            url: '/secret/register',
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
            setTimeout("location.reload()",2000);
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

  /* menu is-active change */
  $('nav ul li').each(function() {
    let ahref = $(this).find('a').attr('href')
    let path = window.location.pathname
    if(path.includes(ahref)){
      $(this).addClass( "is-active" )
    }
  })
  
});//end of jquery