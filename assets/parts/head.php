<?php
$page_ogp_img = '';
$page_description = '';
?>

<meta charset="utf-8">
<meta name="viewport" content="width=device-width">

<title><?php if(isset($page_title)) { echo $page_title . '｜';} ?>みらいく病児予約システム</title>
<meta name="description" content="<?php echo $page_description ?>">

<meta name="format-detection" content="telephone=no">
<meta http-equiv="X-UA-Compatible" content="IE=edge">

<!-- OGP -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="みらいく病児予約システム">
<meta property="og:title" content="<?php if(isset($page_title)) { echo $page_title . '｜';} ?>みらいく病児予約システム">
<meta property="og:description" content="<?php echo $page_description ?>">
<meta property="og:url" content="<?php echo (empty($_SERVER["HTTPS"]) ? "http://" : "https://") . $_SERVER["HTTP_HOST"] . $_SERVER["REQUEST_URI"]; ?>">
<meta property="og:locale" content="ja_JP">
<meta property="fb:app_id" content="">
<meta property="og:image" content="<?php echo $page_ogp_img ?>">

<!-- Twitter Cards -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@VookJp">
<meta name="twitter:image" content="<?php echo $page_ogp_img ?>">

<link rel="shortcut icon" href="/assets/img/favicon.ico">
<link rel="apple-touch-icon" href="/assets/img/webclip.png">

<!-- CSS -->
<link rel="stylesheet" type="text/css" href="/assets/css/reset.css">
<link rel="stylesheet" type="text/css" href="/assets/css/vendor.css">

<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
<script>
$(function(){
  $('tr[data-href]').click(function (e) {
      if ($(e.target).is('td')) {
        window.location = $(this).data('href');
      };
  });
});
</script>