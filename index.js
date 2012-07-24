!function(window, $, infinity, Pugs) {
  var ListView = infinity.ListView,
      ListItem = infinity.ListItem,
      _ = require('underscore');

  var template = _.template($('#demo-template').html()),
      pugTemplate = _.template($('#demo-pug-template').html());

  var listView = new ListView({
    className: 'list-view',
    lazy: function() {
      $(this).find('.pug').each(function() {
      });
    }
  });
  listView.appendTo($('#demo'));

  function pug(num) {
    var pugs = [];
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

  for(var i = 50; i > 0; i--) {
    listView.append(row(Math.floor(Math.random() * 2) + 2));
  }

  window._debugListView = function() {
    return listView;
  }
  console.log(listView);
}(window, jQuery, infinity, Pugs);
