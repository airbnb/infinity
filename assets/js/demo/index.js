!function(window, $, infinity, Pug) {
  var _ = require('underscore'),
      modal = require('o2-modal'),
      PugStorage = Pug.storage;

  var spinnerTemplate = _.template($('#spinner-template').html());

  infinity.config.PAGE_TO_SCREEN_RATIO = 3;
  infinity.config.SCROLL_THROTTLE = 200;

  var currPug = null;
  $(document).on('click', '.modal .save', function() {
    if(currPug) {
      currPug.addClass('saved');
      var $box = currPug.closest('.pug-box');
      PugStorage.save(
        $box.attr('data-pug'),
        $box.attr('data-name'),
        $box.attr('data-caption')
      );
    }
    modal.close();
    return false;
  });
  $(document).on('click', '.modal .no-save', function() {
    currPug = null;
    modal.close();
    return false;
  });
  $(document).on('click', '.heart', function() {
    currPug = $(this);
    if(!currPug.hasClass('saved')) modal('#save-modal').open();
    return false;
  });


  !function() {
    var spinner = $(spinnerTemplate());
    var updateScheduled = false;
    function onscreen($el) {
      var viewportBottom = $(window).scrollTop() + $(window).height();
      return $el.offset().top <= viewportBottom;
    }
    spinner.insertAfter($('#demo').closest('.row'));
    $(window).on('scroll', function() {
      if(!updateScheduled) {
        setTimeout(function() {
          if(onscreen(spinner)) Pug.bomb(100);
          updateScheduled = false;
        }, 500);
        updateScheduled = true;
      }
    });
  }();


  Pug.bomb(400);
}(window, jQuery, infinity, Pug);
