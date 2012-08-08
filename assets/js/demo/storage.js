!function(window, Pug) {
  var KEY = 'Pugbnb';

  var data = (function() {
    var str = localStorage.getItem(KEY);
    return str ? JSON.parse(str) : {};
  }());

  function generateKey(pug, name, caption) {
    return '' + pug + name + caption;
  }

  Pug.storage = {
    check: function(pug, name, caption) {
      return !!data[generateKey(pug, name, caption)];
    },
    save: function(pug, name, caption) {
      data[generateKey(pug, name, caption)] = 1;
      localStorage.setItem(KEY, JSON.stringify(data));
    }
  };
}(window, Pug);
