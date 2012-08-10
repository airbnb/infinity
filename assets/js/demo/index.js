!function(window, $, infinity, Pug) {
  var ListView = infinity.ListView,
      ListItem = infinity.ListItem,
      _ = require('underscore'),
      modal = require('o2-modal'),
      Pugs = Pug.images,
      PugNames = Pug.names,
      PugTaglines = Pug.taglines,
      PugStorage = Pug.storage;

  var template = _.template($('#demo-template').html()),
      pugTemplate = _.template($('#demo-pug-template').html()),
      spinnerTemplate = _.template($('#spinner-template').html());

  var columns = $('.list-view');

  infinity.config.PAGE_TO_SCREEN_RATIO = 3;
  infinity.config.SCROLL_THROTTLE = 200;

  columns.each(function() {
    var listView = new ListView($(this), {
      lazy: function() {
        $(this).find('.pug').each(function() {
          var $ref = $(this);
          $ref.attr('src', $ref.attr('data-original'));
        });
      }
    });
    $(this).data('listView', listView);
  });

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

  var pugCount = 0;

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
          if(onscreen(spinner)) pb(100);
          updateScheduled = false;
        }, 500);
        updateScheduled = true;
      }
    });
  }();

  function pug() {
    var rotate, rotateRight, rotateLeft, name, caption, pugData;
    pugCount++;

    tagline = _.template(PugTaglines[
      Math.floor(Math.random() * PugTaglines.length)
    ]);
    name = PugNames[Math.floor(Math.random() * PugNames.length)];
    caption = tagline({name: name});
    pugData = Pugs[Math.floor(Math.random() * Pugs.length)];

    rotate = Math.random() > 0.5;
    rotateRight = rotate && Math.random() > 0.5;
    rotateLeft = rotate && !rotateRight;
    saved = PugStorage.check(pugData.src, name, caption);

    return pugTemplate({
      pug: pugData,
      title: name,
      caption: caption,
      saved: saved,
      price: Math.floor(Math.random() * 100 + 10),
      rotateRight: rotateRight,
      rotateLeft: rotateLeft
    });
  }


  function row(num) {
    var index, colIndex, length, minCol, currCol;

    for(index = 0; index < num; index++) {

      for(colIndex = 0, length = columns.length; colIndex < length; colIndex++) {
        currCol = $(columns[colIndex]);
        if(!minCol) minCol = currCol;
        else minCol = minCol.height() > currCol.height() ? currCol : minCol;
      }

      minCol.data('listView').append(pug());
    }
  }

  function pb(num) {
    for(var i = num; i > 0; i--) {
      row(3);
    }
  }

  pb(200);

  window._debugListView = function() {
    return listView;
  }
  window.pugCount = function() { return pugCount; };
}(window, jQuery, infinity, Pug);
