/**
 * ©2012 Airbnb, Inc.
 * infinity.js may be freely distributed under the terms of the BSD license.
 * For all licensing information, details, and documention:
 * http://airbnb.github.com/infinity
 */

!function(window, $) {
  'use strict';

  /*
   * infinity.js
   * ===========
   *
   * infinity.js is a UITableView for the web. Use it to speed up scroll
   * performance of long- or infinitely-scrolling lists of items.
   *
   * infinity.js has several caveats:
   *
   * 1. All DOM elements must either be visible or in the current layout.
   * infinity.js does not support elements that will at some point affect the
   * layout, but are currently hidden using `display:block`.
   *
   * 2. ListViews can't be nested.
   *
   * 3. Non-ListItem elements can't be the immediate children of ListView
   * elements. Only ListItems can be immediate children of ListViews.
   *
   * 4. ListView elements can't have heights set directly on them. For most
   * cases it is likely that `min-height`s and `max-height`s will also break.
   * However, setting heights on ListItems is ok.
   *
   * If you're reading this, we probably want to hear from you. If the feeling
   * is mutual: http://www.airbnb.com/jobs
   */

  // Packaging
  var oldInfinity = window.infinity,
      infinity = window.infinity = {};

  // Constants
  var PAGE_ID_ATTRIBUTE = 'data-infinity-pageid',
      NUM_BUFFER_PAGES = 1,
      SCROLL_THROTTLE = 150;


  /*
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   *
   * ListView class
   * ==============
   */

  function ListView(options) {
    options = options || {};

    this.$el = div();
    if(options.className) this.$el.addClass(options.className);
    if(options.id) this.$el.attr('id', options.id);

    initBuffer(this);

    this.top = 0;
    this.bottom = 0;
    this.width = 0;
    this.height = 0;

    this.pages = [];
    this.startIndex = 0;

    ScrollEvent.attach(this);
  }

  function initBuffer(listView) {
    listView._$buffer = blankDiv()
                        .prependTo(listView.$el);
  }



  /*
   * ListView manipulation
   * =====================
   */

  ListView.prototype.append = function(obj) {
    var item = convertToItem(obj);
  };

  ListView.prototype.prepend = function(obj) {
    var item = convertToItem(obj);
  };


  /*
   * appendTo
   * --------
   *
   * Proxies to jQuery to append the ListView's jQuery element to the given
   * jQuery element.
   *
   * - $el: a jQuery element.
   */

  ListView.appendTo = function($el) {
    this.$el.appendTo($el);
  };


  /*
   * prependTo
   * ---------
   * 
   * Proxies to jQuery to prepend the ListView's jQuery element to the given
   * jQuery element.
   *
   * - $el: a jQuery element.
   */

  ListView.prependTo = function($el) {
    this.$el.prependTo($el);
  };


  /*
   * remove
   * ------
   * 
   * Removes the ListView from the DOM and cleans up after it.
   */

  ListView.prototype.remove = function() {
    this.$el.remove();
    this.cleanup();
  };


  /*
   * convertToItem
   * -------------
   * 
   * Given an object that is either a ListItem instance or a jQuery element, 
   * makes sure to return either the ListItem itself or a new ListItem that 
   * wraps the element.
   *
   * - possibleItem: an object that is either a ListItem or a jQuery element.
   */
  
  function convertToItem(possibleItem) {
    if(possibleItem instanceof ListItem) return possibleItem;
    return new ListItem(possibleItem);
  }


  /*
   * ListView querying
   * =================
   */

  ListView.prototype.find = function(findObj) {
  };

  ListView.prototype.at = function(index) {
  };


  /*
   * startIndexWithinRange
   * ---------------------
   *
   * Finds the starting index for a listView, given a range. Wraps
   * indexWithinRange. Always returns a valid index: never returns a number
   * less than 0 or greater than the number of pages -- unless there are no
   * pages, in which case it will return 0 (which is still unindexable for an
   * empty array).
   *
   * - listView: the ListView whose startIndex you're calculating.
   * - top: the top of the range.
   * - bottom: the bottom of the range.
   */

  function startIndexWithinRange(listView, top, bottom) {
    var index = indexWithinRange(listView, top, bottom);
    index = Math.max(index - NUM_BUFFER_PAGES, 0);
    index = Math.min(index, listView.pages.length);
    return index;
  }


  /*
   * indexWithinRange
   * ----------------
   *
   * Finds the index of the page closest to being within a given range. It's
   * less useful than its wrapper function startIndexWithinRange, and you
   * probably won't need to call this unwrapped version.
   *
   * - listView: the ListView instance whose pages you're looking at.
   * - top: the top of the range.
   * - bottom: the bottom of the range.
   */

  function indexWithinRange(listView, top, bottom) {
    var index, length, curr,
        startIndex = listView.startIndex,
        pages = listView.pages;

    if(pages.length <= 0) return -1;

    curr = pages[startIndex];
    if(curr.top > bottom) {
      // search above
      for(index = startIndex - 1; index >= 0; index--) {
        curr = pages[index];
        if(curr.bottom < top) {
          if(index === pages.length - 1) return pages.length - 1;
          return index + 1;
        }
        if(curr.top <= bottom && curr.bottom >= top) return index;
      }
      return 0;
    } else if (curr.bottom < top) {
      // search below
      for(index = startIndex + 1, length = pages.length; index < length; index++) {
        curr = pages[index];
        if(curr.top > bottom) {
          if(index === 0) return 0;
          return index - 1;
        }
        if(curr.top <= bottom && curr.bottom >= top) return index;
      }
      return pages.length - 1;
    }

    // found it
    return startIndex;
  }


  /*
   * ListView cleanup
   * ================
   */

  ListView.prototype.cleanup = function() {
    ScrollEvent.detach(this);
  };


  /*
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   *
   * ListView scrolling 
   * ==================
   */

  var ScrollEvent = (function(window, $) {
    var scrollIsBound = false,
        scrollScheduled = false,
        boundViews = [],
        indexInView = new Array(NUM_BUFFER_PAGES * 2 + 1);

    /*
     * scrollHandler
     * -------------
     *
     * Callback called on scroll. Throttles the scroll event, and calls
     * `scrollAll` as needed.
     */

    function scrollHandler() {
      if(!scrollScheduled) {
        setTimeout(scrollAll, SCROLL_THROTTLE);
        scrollScheduled = true;
      }
    }

    /*
     * scrollAll
     * ---------
     *
     * Callback passed to the setTimeout throttle. Calls `scrollListView` on
     * every bound ListView, and then allows new scroll events to be
     * scheduled.
     */

    function scrollAll() {
      var index, length;
      for(index = 0, length = boundViews.length; index < length; index++) {
        scrollListView(boundViews[index]);
      }
      scrollScheduled = false;
    }


    /*
     * scrollListView
     * --------------
     */

    function scrollListView(listView) {
      var index, length,
          scrollTop = $(window).scrollTop(),
          viewportHeight = $(window).height(),
          scrollBottom = scrollTop + viewportHeight,
          startIndex = this.startIndex,
          nextIndex = startIndexWithinRange(listView, scrollTop, scrollBottom);

      if(nextIndex === startIndex) return;

    }

    return {

      /*
       * attach
       * ------
       *
       * Binds a given ListView to a throttled scroll event. Does not create
       * multiple event handlers if called by multiple ListViews.
       *
       * - listView: a ListView that is not currently bound to the scroll
       *   event.
       */

      attach: function(listView) {
        if(!scrollIsBound) {
          $(window).on('scroll', scrollHandler);
          scrollIsBound = true;
        }
        boundViews.push(listView);
      },


      /*
       * detach
       * ------
       *
       * Detaches a bound ListView from the throttled scroll event. If no
       * ListViews remain bound to the throttled scroll, unbinds the scroll
       * handler from the window's scroll event.
       *
       * Returns true if the listView was successfully detached, and false
       * otherwise.
       *
       * - listView: a ListView that is currently bound to the scroll event.
       */

      detach: function(listView) {
        var index, length;
        for(index = 0, length = boundViews.length; index < length; index++) {
          if(boundViews[index] === listView) {
            boundViews.splice(index, 1);
            if(boundViews.length === 0) {
              $(window).off('scroll', scrollHandler);
              scrollIsBound = false;
            }
            return true;
          }
        }
        return false;
      }
    };
  }(window, $));

  /*
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   *
   * Page class
   * ==========
   */
  
  function Page(items) {
    this.items = items;
    this.$el = blankDiv();

    this.id = generatePageId();
    this.$el.attr(PAGE_ID_ATTRIBUTE, this.id);

    this.top = 0;
    this.bottom = 0;
    this.width = 0;
    this.height = 0;
  }

  Page.prototype.append = function() {
  };

  Page.prototype.prepend = function() {
  };

  Page.prototype.appendTo = function() {
  };

  Page.prototype.prependTo = function() {
  };

  Page.prototype.remove = function() {
    this.cleanup();
  };

  Page.prototype.cleanup = function() {
  };

  var generatePageId = (function() {
    var pageId = 0;
    return function() {
      return pageId++;
    };
  }());


  /*
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   *
   * ListItem class
   * ==============
   */

  function ListItem($el) {
    this.$el = $el;

    this.parent = null;

    this.top = 0;
    this.bottom = 0;
    this.width = 0;
    this.height = 0;
  }

  ListItem.prototype.appendTo = function() {
  };

  ListItem.prototype.prependTo = function() {
  };

  ListItem.prototype.remove = function() {
    this.cleanup();
    this.$el.remove();
  };

  ListItem.prototype.cleanup = function() {
  };



  /*
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   *
   * Helper functions
   * ================
   */

  
  /*
   * div
   * ---
   *
   * Returns a new, empty `<div>` jQuery element.
   */

  function div() {
    return $('<div></div>');
  }


  /*
   * blankDiv
   * --------
   * 
   * Returns a new, empty `<div>` jQuery element. The `<div>` will have its 
   * border, margin, and padding set to zero or none, as appropriate.
   */

  function blankDiv() {
    return div().css({
      margin: 0,
      padding: 0,
      border: 'none'
    });
  }


  /*
   * pxToInt
   * -------
   *
   * Converts pixel values returned by jQuery to base-10 ints.
   *
   * - px: a string value, which starts with a number and is
   *   prefixed with the string `'px'`.
   */

  function pxToInt(px) {
    return parseInt(px.replace('px', ''), 10);
  }


  /*
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   *
   * Export
   * ======
   */

  infinity.ListView = ListView;
  infinity.Page = Page;
  infinity.ListItem = ListItem;

  infinity.noConflict = function() {
    window.infinity = oldInfinity;
    return infinity;
  };

}(window, jQuery);
