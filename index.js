!function(window, $, infinity, Pugs) {
  var ListView = infinity.ListView,
      ListItem = infinity.ListItem,
      _ = require('underscore'),
      modal = require('o2-modal');

  var template = _.template($('#demo-template').html()),
      pugTemplate = _.template($('#demo-pug-template').html()),
      spinnerTemplate = _.template($('#spinner-template').html());

  var listView = new ListView({
    className: 'list-view',
    lazy: function() {
      $(this).find('.pug').each(function() {
      });
    }
  });
  listView.appendTo($('#demo'));

  var currPug = null;
  $(document).on('click', '.modal .save', function() {
    if(currPug) currPug.addClass('saved');
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
    modal('#save-modal').open();
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

  function pug(num) {
    var pugs = [];
    pugCount += num;
    for(var index = 0; index < num; index++) {
      pugs.push(pugTemplate({
        num: num,
        pug: Pugs[Math.floor(Math.random() * Pugs.length)],
        title: 'what are you',
        caption: 'I AM A PUG!!!!!!!!!!'
      }));
    }
    return pugs;
  }

  function row(num) {
    return template({
      pugs: pug(num)
    });
  }

  function pb(num) {
    for(var i = num; i > 0; i--) {
      listView.append(row(Math.floor(Math.random() * 2) + 2));
    }
  }

  pb(200);

  window._debugListView = function() {
    return listView;
  }
  window.pugCount = function() { return pugCount; };
}(window, jQuery, infinity, Pugs);
