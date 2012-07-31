/**
 * ©2012 Airbnb, Inc.
 * infinity.js may be freely distributed under the terms of the BSD license.
 * For all licensing information, details, and documention:
 * http://airbnb.github.com/infinity
 */

!function(window, Math, $) {
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
   * 4. ListView elements can't have heights set directly on them. In most
   * cases it is also likely that `min-height`s and `max-height`s will break.
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
      PAGE_TO_SCREEN_RATIO = 2,
      NUM_BUFFER_PAGES = 1,
      PAGES_ONSCREEN = NUM_BUFFER_PAGES * 2 + 1,
      SCROLL_THROTTLE = 50;


  /*
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   *
   * ListView class
   * ==============
   */

  function ListView($el, options) {
    options = options || {};

    this.$el = div();
    if(options.className) this.$el.addClass(options.className);
    if(options.id) this.$el.attr('id', options.id);
    this.lazy = !!options.lazy;
    this.lazyFn = options.lazy || null;

    initBuffer(this);

    this.top = 0;
    this.width = 0;
    this.height = 0;

    this.pages = [];
    this.startIndex = 0;

    ScrollEvent.attach(this);
    $el.html(this.$el);
  }

  function initBuffer(listView) {
    listView._$buffer = blankDiv()
                        .prependTo(listView.$el);
  }

  function updateBuffer(listView) {
    var firstPage,
        pages = listView.pages,
        $buffer = listView._$buffer;

    if(pages.length > 0) {
      firstPage = pages[listView.startIndex];
      $buffer.height(firstPage.top);
    } else {
      $buffer.height(0);
    }
  }

  /*
   * ListView manipulation
   * =====================
   */


  /*
   * append
   * ------
   *
   * Appends a jQuery element or a ListItem to the ListView.
   *
   * - obj: a jQuery element, a string of valid HTML, or a ListItem.
   *
   * TODO: optimized batch appends
   */

  ListView.prototype.append = function(obj) {
    var lastPage, index, length,
        item = convertToItem(obj),
        pages = this.pages,
        pagesToInsert = [],
        pageChange = false;

    cacheCoordsFor(this, item);
    this.height += item.height;
    this.$el.height(this.height);

    if(pages.length > 0) lastPage = pages[pages.length - 1];

    if(!lastPage || !lastPage.hasVacancy()) {
      lastPage = new Page();
      pages.push(lastPage);
      pageChange = true;
    }

    lastPage.append(item);

    // TODO: update index, buffer

    index = updateStartIndex(this);
    length = Math.min(index + PAGES_ONSCREEN, pages.length);
    for(index; index < length; index++) {
      pagesToInsert.push(pages[index]);
    }
    insertPagesInView(this);

    return item;
  };


  // WARNING: this will always break for prepends.
  // Once you add support for prepends, change this.
  function cacheCoordsFor(listView, listItem) {
    listItem.$el.remove();
    listView.$el.append(listItem.$el);
    updateCoords(listItem, listView.height);
    listItem.$el.remove();
  }

  
  // TODO: optimize
  function insertPagesInView(listView) {
    var index, length, curr,
        pages = listView.pages,
        inserted = false,
        inOrder = true;
    index = listView.startIndex;
    length = Math.min(index + PAGES_ONSCREEN, pages.length);

    for(index; index < length; index++) {
      curr = pages[index];
      curr.lazyload(listView.lazyFn);
      if(inserted && curr.onscreen) inOrder = false;

      if(!inOrder) {
        curr.remove();
        curr.appendTo(listView.$el);
      } else if(!curr.onscreen) {
        inserted = true;
        curr.appendTo(listView.$el);
      }
    }
  }


  /*
   * updateStartIndex
   * ----------------
   *
   * Updates a given ListView when the throttled scroll event fires. Attempts
   * to do as little work as possible: if the `startIndex` doesn't change,
   * it'll exit early. If the `startIndex` does change, it finds all pages
   * that have been scrolled out of view and removes them, then inserts only
   * pages that have been now been scrolled into view.
   *
   * - listView: the ListView needing to be updated.
   */

  function updateStartIndex(listView) {
    var index, length, curr, pages, indexInView,
        lastIndex, nextLastIndex,
        startIndex = listView.startIndex,
        scrollTop = $(window).scrollTop(),
        viewportHeight = $(window).height(),
        scrollBottom = scrollTop + viewportHeight,
        nextIndex = startIndexWithinRange(listView, scrollTop, scrollBottom);

    if( nextIndex < 0 || nextIndex === startIndex) return startIndex;

    pages = listView.pages;
    startIndex = listView.startIndex;
    indexInView = new Array(pages.length);
    lastIndex = Math.min(startIndex + PAGES_ONSCREEN, pages.length);
    nextLastIndex = Math.min(nextIndex + PAGES_ONSCREEN, pages.length);

    // mark current pages as valid
    for(index = nextIndex, length = nextLastIndex; index < length; index++) {
      indexInView[index] = true;
    }
    // sweep any invalid old pages
    for(index = startIndex, length = lastIndex; index < length; index++) {
      if(!indexInView[index]) pages[index].remove();
    }

    listView.startIndex = nextIndex;

    insertPagesInView(listView);
    updateBuffer(listView);
    return nextIndex;
  }


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
   * Given an object that is either a ListItem instance, a jQuery element, or a
   * string of valid HTML, makes sure to return either the ListItem itself or 
   * a new ListItem that wraps the element.
   *
   * - possibleItem: an object that is either a ListItem, a jQuery element, or
   *   a string of valid HTML.
   */
  
  function convertToItem(possibleItem) {
    if(possibleItem instanceof ListItem) return possibleItem;
    if(typeof possibleItem === 'string') possibleItem = $(possibleItem);
    return new ListItem(possibleItem);
  }


  /*
   * tooSmall
   * --------
   *
   * Alerts the given ListView that the given Page is too small. May result
   * in modifications to the `pages` array.
   */

  function tooSmall(listView, page) {
    var index, length, foundIndex,
        pages = listView.pages;
    
    for(index = 0, length = pages.length; index < length; index++) {
      if(pages[index] === page) {
        foundIndex = index;
        break;
      }
    }

    if(typeof foundIndex === 'undefined') return false;

    // TODO: check for other pages
    // merge if possible
    // split if necessary
    // splice out old pages
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
   * indexWithinRange. 
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
    var index, length, curr, startIndex,
        pages = listView.pages;

    // start looking at the index of the page last contained by
    // the screen -- not the first page in the onscreen pages
    startIndex = Math.min(listView.startIndex + NUM_BUFFER_PAGES, 
                          pages.length - 1);

    top -= listView.top;
    bottom -= listView.top;

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
   * ListView scrolling 
   * ==================
   *
   * Internal scroll binding and throttling. Allows ListViews to bind to a
   * throttled scroll event, and updates them as it fires.
   */

  var ScrollEvent = (function(window, $) {
    var scrollIsBound = false,
        scrollScheduled = false,
        boundViews = [];

    /*
     * scrollHandler
     * -------------
     *
     * Callback called on scroll. Schedules a `scrollAll` callback if needed,
     * and disallows future scheduling.
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
        updateStartIndex(boundViews[index]);
      }
      scrollScheduled = false;
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
   *
   * An internal class used for ordering items into roughly screen-sized pages.
   * Pages are removed and added to the DOM wholesale as they come in and out
   * of view.
   */
  
  function Page() {
    this.items = [];
    this.$el = blankDiv();

    this.id = generatePageId();
    this.$el.attr(PAGE_ID_ATTRIBUTE, this.id);

    this.top = 0;
    this.bottom = 0;
    this.width = 0;
    this.height = 0;

    this.lazyloaded = false;

    this.onscreen = false;
  }


  /*
   * append
   * ------
   *
   * Appends a ListItem to the Page.
   *
   * - item: a ListItem.
   */

  Page.prototype.append = function(item) {
    var items = this.items;

    // recompute coords, sizing
    if(items.length === 0) this.top = item.top;
    this.bottom = item.bottom;
    this.width = this.width > item.width ? this.width : item.width;
    this.height = this.bottom - this.top;

    items.push(item);
    item.parent = this;
    this.$el.append(item.$el);

    this.lazyloaded = false;
  };


  /*
   * prepend
   * -------
   *
   * Prepends a ListItem to the Page.
   *
   * - item: a ListItem.
   */

  Page.prototype.prepend = function(item) {
    var items = this.items;

    // recompute coords, sizing
    this.bottom += item.height;
    this.width = this.width > item.width ? this.width : item.width;
    this.height = this.bottom - this.top;

    items.push(item);
    item.parent = this;
    this.$el.prepend(item.$el);

    this.lazyloaded = false;
  };


  /*
   * hasVacancy
   * ----------
   *
   * Returns false if the Page is at max capacity; false otherwise.
   */

  Page.prototype.hasVacancy = function() {
    return this.height < $(window).height() * PAGE_TO_SCREEN_RATIO;
  };


  /*
   * appendTo
   * -----------
   * 
   * Proxies to jQuery to append the Page to the given jQuery element.
   */

  Page.prototype.appendTo = function($el) {
    if(!this.onscreen) {
      this.$el.appendTo($el);
      this.onscreen = true;
    }
  };


  /*
   * prependTo
   * ------------
   *
   * Proxies to jQuery to prepend the Page to the given jQuery element.
   */

  Page.prototype.prependTo = function($el) {
    if(!this.onscreen) {
      this.$el.prependTo($el);
      this.onscreen = true;
    }
  };


  /*
   * remove
   * ------
   *
   * Removes the Page from the DOM and cleans up after it.
   */

  Page.prototype.remove = function() {
    if(this.onscreen) {
      this.$el.remove();
      this.cleanup();
      this.onscreen = false;
    }
  };

  Page.prototype.cleanup = function() {
  };

  Page.prototype.lazyload = function(callback) {
    var index, length;
    if(!this.lazyloaded) {
      for(index = 0, length = this.$el.length; index < length; index++) {
        callback.call(this.$el[index]);
      }
      this.lazyloaded = true;
    }
  };


  /*
   * generatePageId
   * --------------
   *
   * Generates a unique ID for a Page.
   */

  var generatePageId = (function() {
    var pageId = 0;
    return function() {
      return pageId++;
    };
  }());

  function removeItemFromPage(item, page) {
    var index, length, foundIndex,
        items = this.items;
    for(index = 0, length = items.length; index < length; index++) {
      if(items[index] === item) {
        foundIndex = index;
        break;
      }
    }
    if(typeof foundIndex === 'undefined') return false;
    items.splice(foundIndex, 1);
    this.bottom -= item.height;
    this.height = this.bottom - this.top;
    if(!this.hasVacancy()) tooSmall(this.parent, this);
    return true;
  }


  /*
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   *
   * ListItem class
   * ==============
   *
   * An individual item in the ListView.
   *
   * Has cached top, bottom, width, and height properties, determined from 
   * jQuery. This positioning data will be determined when the ListItem is 
   * inserted into a ListView; it can't be determined ahead of time.
   *
   * All positioning data is relative to the containing ListView.
   */

  function ListItem($el) {
    this.$el = $el;

    this.parent = null;

    this.top = 0;
    this.bottom = 0;
    this.width = 0;
    this.height = 0;
  }

  ListItem.prototype.remove = function() {
    this.$el.remove();
    removeItemFromPage(this, this.parent);
    this.cleanup();
  };

  ListItem.prototype.cleanup = function() {
    this.parent = null;
  };

  function updateCoords(listItem, yOffset) {
    var $el = listItem.$el,
        offset = $el.offset();
    listItem.top = yOffset;
    listItem.height = $el.outerHeight(true);
    listItem.bottom = listItem.top + listItem.height;
    listItem.width = $el.width();
  }



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

}(window, Math, jQuery);
