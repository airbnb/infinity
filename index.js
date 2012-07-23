!function(window, $, infinity, Pugs) {
  var ListView = infinity.ListView,
      ListItem = infinity.ListItem,
      _ = require('underscore');

  var template = _.template($('#demo-template').html()),
      pugTemplate = _.template($('#demo-pug-template').html());

  function pug(num) {
    var pugs = [];
    for(var index = 0; index < num; index++) {
      pugs.push(pugTemplate({
        num: num,
        src: Pugs[Math.floor(Math.random() * Pugs.length)],
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

    for(var i = 100; i > 0; i--) {
      $('#demo').append(row(Math.floor(Math.random() * 2) + 2));
    }
    $('.pug').each(function() {
      $(this).width($(this).parent().width() - 2);
    });
}(window, jQuery, infinity, Pugs);
