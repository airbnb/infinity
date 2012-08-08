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

  infinity.config.PAGE_TO_SCREEN_RATIO = 2;
  infinity.config.SCROLL_THROTTLE = 100;

  var listView = new ListView($('#demo'), {
    lazy: function() {
      $(this).find('.pug').each(function() {
        var $ref = $(this);
        $ref.attr('src', $ref.attr('data-original'));
      });
    }
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
          if(onscreen(spinner)) pb(200);
          updateScheduled = false;
        }, 500);
        updateScheduled = true;
      }
    });
  }();

  function pug(num, pug, name, caption) {
    var rotate, rotateRight, rotateLeft;
    pugCount++;

    rotate = Math.random() > 0.5;
    rotateRight = rotate && Math.random() > 0.5;
    rotateLeft = rotate && !rotateRight;
    saved = PugStorage.check(pug.src, name, caption);
    if(saved) console.log('YES!');

    return pugTemplate({
      num: num,
      pug: pug,
      title: name,
      caption: caption,
      saved: saved,
      price: Math.floor(Math.random() * 100 + 10),
      rotateRight: rotateRight,
      rotateLeft: rotateLeft
    });
  }

  function pugs(num) {
    var tagline, name, pugData, caption,
        pugs = [];
    for(var index = 0; index < num; index++) {
      tagline = _.template(PugTaglines[
        Math.floor(Math.random() * PugTaglines.length)
      ]);
      name = PugNames[Math.floor(Math.random() * PugNames.length)];
      caption = tagline({name: name});
      pugData = Pugs[Math.floor(Math.random() * Pugs.length)];

      pugs.push(pug(num, pugData, name, caption));
    }
    return pugs;
  }

  function row(num) {
    return template({
      pugs: pugs(num)
    });
  }

  function pb(num) {
    for(var i = num; i > 0; i--) {
      /*
      $('#demo').append(row(3));
      $('.pug').each(function() {
        $(this).attr('src', $(this).attr('data-original'));
      });
      */
      listView.append(row(3));
    }
  }

  pb(200);

  window._debugListView = function() {
    return listView;
  }
  window.pugCount = function() { return pugCount; };
}(window, jQuery, infinity, Pug);
