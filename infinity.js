//     (c) 2012 Airbnb, Inc.
//     
//     infinity.js may be freely distributed under the terms of the BSD
//     license. For all licensing information, details, and documention:
//     http://airbnb.github.com/infinity

!function(window, Math, $) {
  'use strict';


  // Welcome To Infinity
  // ===================
  //
  // infinity.js is a UITableView for the web. Use it to speed up scroll
  // performance of long- or infinitely-scrolling lists of items.
  //
  // infinity.js has several caveats:
  //
  // 1. All DOM elements must either be visible or in the current layout.
  // infinity.js does not support elements that will at some point affect the
  // layout, but are currently hidden using `display:none`.
  //
  // 2. ListViews can't be nested.
  //
  // 3. Non-ListItem elements can't be the immediate children of ListView
  // elements. Only ListItems can be immediate children of ListViews.
  //
  // 4. ListView elements can't have heights set directly on them. In most
  // cases it is also likely that `min-height`s and `max-height`s will break.
  // However, setting heights on ListItems is ok.
  //
  // If you're reading this, we probably want to hear from you. If the feeling
  // is mutual: [get in touch.](http://www.airbnb.com/jobs)


  // Initial Setup
  // =============

  // Packaging:
  var oldInfinity = window.infinity,
      infinity = window.infinity = {},
      config = infinity.config = {};

  // Constants:
  var PAGE_ID_ATTRIBUTE = 'data-infinity-pageid',
      NUM_BUFFER_PAGES = 1,
      PAGES_ONSCREEN = NUM_BUFFER_PAGES * 2 + 1;

  // Config:
  config.PAGE_TO_SCREEN_RATIO = 3;
  config.SCROLL_THROTTLE = 350;



  // ListView Class
  // ==============


  // ### Constructor
  //
  // Creates a new instance of a ListView.
  //
  // Takes:
  //
  // - `$el`: a jQuery element.
  // - `options`: an optional hash of options

  function ListView($el, options) {
    var that = this;

    options = options || {};

    that.$el = blankDiv();
    that.$shadow = blankDiv();
    $el.append(that.$el);
    // don't append the shadow element -- it's meant to only be used for
    // finding elements outside of the DOM

    that.lazy = !!options.lazy;
    that.lazyFn = options.lazy || null;

    initBuffer(that);

    that.top = that.$el.offset().top;
    that.width = 0;
    that.height = 0;

    that.pages = [];
    that.startIndex = 0;

    DOMEvent.attach(that);
  }

  // ### initBuffer
  //
  // Private ListView method. Initializes the buffer element.

  function initBuffer(listView) {
    listView._$buffer = blankDiv()
                        .prependTo(listView.$el);
  }


  // ### updateBuffer
  //
  // Private ListView method. Updates the buffer to correctly push forward the
  // first page.

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

  // ListView manipulation
  // ---------------------


  // ### append
  //
  // Appends a jQuery element or a ListItem to the ListView.
  //
  // Takes:
  //
  // - `obj`: a jQuery element, a string of valid HTML, or a ListItem.
  //
  // TODO: optimized batch appends

  ListView.prototype.append = function(obj) {
    if(!obj || !obj.length) return null;

    var that = this,
        lastPage,
        item = convertToItem(that, obj),
        pages = that.pages,
        pageChange = false;

    that.height += item.height;
    that.$el.height(that.height);

    lastPage = pages[pages.length - 1];

    if(!lastPage || !lastPage.hasVacancy()) {
      lastPage = new Page(that);
      pages.push(lastPage);
      pageChange = true;
    }

    lastPage.append(item);
    insertPagesInView(that);

    return item;
  };


  // ### cacheCoordsFor
  //
  // Caches the coordinates for a given ListItem within the given ListView.
  //
  // Takes:
  //
  // - `listView`: a ListView.
  // - `listItem`: the ListItem whose coordinates you want to cache.

  function cacheCoordsFor(listView, listItem) {
    listItem.$el.remove();

    // WARNING: this will always break for prepends. Once support gets added for
    // prepends, change this.
    listView.$el.append(listItem.$el);
    updateCoords(listItem, listView.height);
    listItem.$el.remove();
  }


  // ### insertPagesInView
  //
  // Inserts any uninserted pages the given ListView owns.
  //
  // Takes:
  //
  // - `listView`: the ListView whose onscreen pages you'd like to insert.

  function insertPagesInView(listView) {
    var index, length, curr,
        pages = listView.pages,
        inserted = false,
        inOrder = true;
    index = listView.startIndex;
    length = Math.min(index + PAGES_ONSCREEN, pages.length);

    for(index; index < length; index++) {
      curr = pages[index];
      if(listView.lazy) curr.lazyload(listView.lazyFn);
      if(inserted && curr.onscreen) inOrder = false;

      if(!inOrder) {
        curr.stash(listView.$shadow);
        curr.appendTo(listView.$el);
      } else if(!curr.onscreen) {
        inserted = true;
        curr.appendTo(listView.$el);
      }
    }
  }


  // ### updateStartIndex
  //
  // Updates a given ListView when the throttled scroll event fires. Attempts
  // to do as little work as possible: if the `startIndex` doesn't change,
  // it'll exit early. If the `startIndex` does change, it finds all pages
  // that have been scrolled out of view and removes them, then inserts only
  // pages that have been now been scrolled into view.
  //
  // Takes:
  //
  // - `listView`: the ListView needing to be updated.

  function updateStartIndex(listView) {
    var index, length, curr, pages, indexInView,
        lastIndex, nextLastIndex,
        startIndex = listView.startIndex,
        viewTop = $(window).scrollTop() - listView.top,
        viewHeight = $(window).height(),
        viewBottom = viewTop + viewHeight,
        nextIndex = startIndexWithinRange(listView, viewTop, viewBottom);

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
      if(!indexInView[index]) pages[index].stash(listView.$shadow);
    }

    listView.startIndex = nextIndex;

    insertPagesInView(listView);
    updateBuffer(listView);
    return nextIndex;
  }


  // ### remove
  // 
  // Removes the ListView from the DOM and cleans up after it.

  ListView.prototype.remove = function() {
    this.$el.remove();
    this.cleanup();
  };


  // ### convertToItem
  // 
  // Given an object that is either a ListItem instance, a jQuery element, or a
  // string of valid HTML, makes sure to return either the ListItem itself or 
  // a new ListItem that wraps the element.
  //
  // Takes:
  //
  // - `listView`: the ListView instance that wants the item.
  // - `possibleItem`: an object that is either a ListItem, a jQuery element,
  // or a string of valid HTML.

  function convertToItem(listView, possibleItem) {
    var item;
    if(possibleItem instanceof ListItem) return possibleItem;
    if(typeof possibleItem === 'string') possibleItem = $(possibleItem);
    item = new ListItem(possibleItem);
    cacheCoordsFor(listView, item);
    return item;
  }


  // ### tooSmall
  //
  // Alerts the given ListView that the given Page is too small. May result
  // in modifications to the `pages` array.

  function tooSmall(listView, page) {
    // Naive solution:
    // repartition(listView);
  }


  // ### repartition
  //
  // Repartitions the pages array. This can be used for either defragmenting
  // the array, or recalculating everything on screen resize.

  function repartition(listView) {
    var currPage, newPage, index, length, itemIndex, pageLength, currItem,
        nextItem,
        pages = listView.pages,
        newPages = [];

    newPage = new Page(listView);
    newPages.push(newPage);

    for(index = 0, length = pages.length; index < length; index++) {
      currPage = pages[index];
      for(itemIndex = 0, pageLength = currPage.items.length; itemIndex < pageLength; itemIndex++) {
        currItem = currPage.items[itemIndex];
        nextItem = currItem.clone();
        if(newPage.hasVacancy()) {
          newPage.append(nextItem);
        } else {
          newPage = new Page(listView);
          newPages.push(newPage);
          newPage.append(nextItem);
        }
      }
      currPage.remove();
    }

    listView.pages = newPages;
    insertPagesInView(listView);
  }


  // ListView querying
  // -----------------

  // ### find
  //
  // Given a selector string or jQuery element, return the items that hold the
  // given or matching elements.
  //
  // Note: this is slower than an ordinary jQuery find. However, using jQuery
  // to find elements will be bug-prone, since most of the elements won't be in
  // the DOM tree. Caching elements is usually important, but it's even more
  // important to do here.
  //
  // Arguments:
  //
  // - `findObj`: A selector string, or a jQuery element.
  //
  // Returns a ListItem.

  ListView.prototype.find = function(findObj) {
    var that = this,
        items, $onscreen, $offscreen;

    // If given a selector string, find everything matching onscreen and
    // offscreen, and return both.
    if(typeof findObj === 'string') {
      $onscreen = that.$el.find(findObj);
      $offscreen = that.$shadow.find(findObj);
      return that.find($onscreen).concat(that.find($offscreen));
    }

    // Silly option, but might as well.
    if(findObj instanceof ListItem) return [findObj];

    // jQuery element
    items = [];
    findObj.each(function() {
      var pageId, page, pageItems, index, length, currItem,
          $itemEl = $(this),
          $pageEl = $itemEl.parent();

      while(!$pageEl.attr(PAGE_ID_ATTRIBUTE) && $pageEl.length > 0) {
        $itemEl = $pageEl;
        $pageEl = $pageEl.parent();
      }

      pageId = parseInt($pageEl.attr(PAGE_ID_ATTRIBUTE), 10);
      page = PageRegistry.lookup(pageId);
      if(page) {
        pageItems = page.items;
        for(index = 0, length = pageItems.length; index < length; index++) {
          currItem = pageItems[index];
          if(currItem.$el.is($itemEl)) {
            items.push(currItem);
            break;
          }
        }
      }
    });

    return items;
  };

  // ### startIndexWithinRange
  //
  // Finds the starting index for a listView, given a range. Wraps
  // indexWithinRange. 
  //
  // Takes:
  //
  // - `listView`: the ListView whose startIndex you're calculating.
  // - `top`: the top of the range.
  // - `bottom`: the bottom of the range.

  function startIndexWithinRange(listView, top, bottom) {
    var index = indexWithinRange(listView, top, bottom);
    index = Math.max(index - NUM_BUFFER_PAGES, 0);
    index = Math.min(index, listView.pages.length);
    return index;
  }


  // ### indexWithinRange
  //
  // Finds the index of the page closest to being within a given range. It's
  // less useful than its wrapper function startIndexWithinRange, and you
  // probably won't need to call this unwrapped version.
  //
  // Takes:
  //
  // - `listView`: the ListView instance whose pages you're looking at.
  // - `top`: the top of the range.
  // - `bottom`: the bottom of the range.

  function indexWithinRange(listView, top, bottom) {
    var index, length, curr, startIndex, midpoint, diff, prevDiff,
        pages = listView.pages,
        rangeMidpoint = top + (bottom - top)/2;

    // Start looking at the index of the page last contained by the screen --
    // not the first page in the onscreen pages
    startIndex = Math.min(listView.startIndex + NUM_BUFFER_PAGES,
                          pages.length - 1);

    if(pages.length <= 0) return -1;

    curr = pages[startIndex];
    midpoint = curr.top + curr.height/2;
    prevDiff = rangeMidpoint - midpoint;
    if(prevDiff < 0) {
      // Search above
      for(index = startIndex - 1; index >= 0; index--) {
        curr = pages[index];
        midpoint = curr.top + curr.height/2;
        diff = rangeMidpoint - midpoint;
        if(diff > 0) {
          if(diff < -prevDiff) return index;
          return index + 1;
        }
        prevDiff = diff;
      }
      return 0;
    } else if (prevDiff > 0) {
      // Search below
      for(index = startIndex + 1, length = pages.length; index < length; index++) {
        curr = pages[index];
        midpoint = curr.top + curr.height/2;
        diff = rangeMidpoint - midpoint;
        if(diff < 0) {
          if(-diff < prevDiff) return index;
          return index - 1;
        }
        prevDiff = diff;
      }
      return pages.length - 1;
    }

    // Perfect hit! Return it.
    return startIndex;
  }


  // ListView cleanup
  // ----------------

  ListView.prototype.cleanup = function() {
    var pages = this.pages;
    DOMEvent.detach(this);
    while(pages.length > 0) {
      pages.pop().cleanup();
    }
  };


  // ListView event binding
  // ----------------------
  //
  // Internal scroll and resize  binding and throttling. Allows ListViews to
  // bind to a throttled scroll event (and debounced resize event), and updates
  // them as it fires.

  var DOMEvent = (function(window, $) {
    var eventIsBound = false,
        scrollScheduled = false,
        resizeTimeout = null,
        boundViews = [];


    // ### scrollHandler
    //
    // Callback called on scroll. Schedules a `scrollAll` callback if needed,
    // and disallows future scheduling.

    function scrollHandler() {
      if(!scrollScheduled) {
        setTimeout(scrollAll, config.SCROLL_THROTTLE);
        scrollScheduled = true;
      }
    }


    // ### scrollAll
    //
    // Callback passed to the setTimeout throttle. Calls `scrollListView` on
    // every bound ListView, and then allows new scroll events to be
    // scheduled.

    function scrollAll() {
      var index, length;
      for(index = 0, length = boundViews.length; index < length; index++) {
        updateStartIndex(boundViews[index]);
      }
      scrollScheduled = false;
    }


    // ### resizeHandler
    //
    // Callback called on resize. Debounces a `resizeAll` callback.

    function resizeHandler() {
      if(resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resizeAll, 200);
    }


    // ### resizeAll
    //
    // Handles resizing all ListViews. Just calls `repartition` on them for
    // now.

    function resizeAll() {
      var index, curr;
      for(index = 0; curr = boundViews[index]; index++) {
        repartition(curr);
      }
    }

    return {

      // ### attach
      //
      // Binds a given ListView to a throttled scroll event. Does not create
      // multiple event handlers if called by multiple ListViews.
      //
      // Takes:
      //
      // - `listView`: a ListView that is not currently bound to the scroll
      //   event.

      attach: function(listView) {
        if(!eventIsBound) {
          $(window).on('scroll', scrollHandler);
          $(window).on('resize', resizeHandler);
          eventIsBound = true;
        }
        boundViews.push(listView);
      },


      // ### detach
      //
      // Detaches a bound ListView from the throttled scroll event. If no
      // ListViews remain bound to the throttled scroll, unbinds the scroll
      // handler from the window's scroll event.
      //
      // Returns true if the listView was successfully detached, and false
      // otherwise.
      //
      // Takes:
      //
      // - `listView`: a ListView that is currently bound to the scroll event.

      detach: function(listView) {
        var index, length;
        for(index = 0, length = boundViews.length; index < length; index++) {
          if(boundViews[index] === listView) {
            boundViews.splice(index, 1);
            if(boundViews.length === 0) {
              $(window).off('scroll', scrollHandler);
              $(window).off('resize', resizeHandler);
              eventIsBound = false;
            }
            return true;
          }
        }
        return false;
      }
    };
  }(window, $));


  // Page class
  // ==========
  //
  // An internal class used for ordering items into roughly screen-sized pages.
  // Pages are removed and added to the DOM wholesale as they come in and out
  // of view.

  function Page(parent) {
    var that = this;

    that.parent = parent;

    that.items = [];
    that.$el = blankDiv();

    that.id = PageRegistry.generatePageId(that);
    that.$el.attr(PAGE_ID_ATTRIBUTE, that.id);

    that.top = 0;
    that.bottom = 0;
    that.width = 0;
    that.height = 0;

    that.lazyloaded = false;

    that.onscreen = false;
  }


  // ### append
  //
  // Appends a ListItem to the Page.
  //
  // Takes:
  //
  // - `item`: a ListItem.

  Page.prototype.append = function(item) {
    var that = this,
        items = that.items;

    // Recompute coords, sizing.
    if(items.length === 0) that.top = item.top;
    that.bottom = item.bottom;
    that.width = that.width > item.width ? that.width : item.width;
    that.height = that.bottom - that.top;

    items.push(item);
    item.parent = that;
    that.$el.append(item.$el);

    that.lazyloaded = false;
  };


  // ### prepend
  //
  // Prepends a ListItem to the Page.
  //
  // Takes:
  //
  // - `item`: a ListItem.

  Page.prototype.prepend = function(item) {
    var that = this,
        items = that.items;

    // Recompute coords, sizing.
    that.bottom += item.height;
    that.width = that.width > item.width ? that.width : item.width;
    that.height = that.bottom - that.top;

    items.push(item);
    item.parent = that;
    that.$el.prepend(item.$el);

    that.lazyloaded = false;
  };


  // ### hasVacancy
  //
  // Returns false if the Page is at max capacity; false otherwise.

  Page.prototype.hasVacancy = function() {
    return this.height < $(window).height() * config.PAGE_TO_SCREEN_RATIO;
  };


  // ### appendTo
  // 
  // Proxies to jQuery to append the Page to the given jQuery element.

  Page.prototype.appendTo = function($el) {
    var that = this;

    if(!that.onscreen) {
      that.$el.remove();
      that.$el.appendTo($el);
      that.onscreen = true;
    }
  };


  // ### prependTo
  //
  // Proxies to jQuery to prepend the Page to the given jQuery element.

  Page.prototype.prependTo = function($el) {
    var that = this;

    if(!that.onscreen) {
      that.$el.prependTo($el);
      that.onscreen = true;
    }
  };

  // ### stash
  //
  // Temporarily stash the onscreen page under a different element.

  Page.prototype.stash = function($el) {
    var that = this;

    if(that.onscreen) {
      that.$el.remove();
      that.onscreen = false;
      $el.append(that.$el);
    }
  };


  // ### remove
  //
  // Removes the Page from the DOM and cleans up after it.

  Page.prototype.remove = function() {
    var that = this;

    if(that.onscreen) {
      that.$el.remove();
      that.onscreen = false;
    }
    that.cleanup();
  };


  // ### cleanup
  //
  // Cleans up the Page without removing it.

  Page.prototype.cleanup = function() {
    var that = this;

    var items = that.items;
    that.parent = null;
    PageRegistry.remove(that);
    while(items.length > 0) {
      items.pop().cleanup();
    }
  };


  // ### lazyload
  //
  // Runs the given lazy-loading callback on all unloaded page content.
  //
  // Takes:
  //
  // - `callback`: a function of the form `function([$el]){}`. Will run on
  // each unloaded element, and will use the element as its calling context.

  Page.prototype.lazyload = function(callback) {
    var that = this,
        index, length;
    if(!that.lazyloaded) {
      for(index = 0, length = that.$el.length; index < length; index++) {
        callback.call(that.$el[index], that.$el[index]);
      }
      that.lazyloaded = true;
    }
  };


  // Page Registry
  // ------------

  var PageRegistry = (function() {
    var pages = [];
    return {
      generatePageId: function(page) {
        return pages.push(page) - 1;
      },
      lookup: function(id) {
        if(id >= pages.length) return null;
        return pages[id];
      },
      remove: function(page) {
        var id = page.id;
        if(id >= pages.length) return false;
        if(!pages[id]) return false;
        pages[id] = null;
        return true;
      }
    };
  }());


  // ### removeItemFromPage
  //
  // Removes a given ListItem from the given Page.

  function removeItemFromPage(item, page) {
    var index, length, foundIndex,
        items = page.items;
    for(index = 0, length = items.length; index < length; index++) {
      if(items[index] === item) {
        foundIndex = index;
        break;
      }
    }

    if(foundIndex == null) return false;

    items.splice(foundIndex, 1);
    page.bottom -= item.height;
    page.height = page.bottom - page.top;
    if(!page.hasVacancy()) tooSmall(page.parent, page);

    return true;
  }


  // ListItem class
  // ==============
  //
  // An individual item in the ListView.
  //
  // Has cached top, bottom, width, and height properties, determined from 
  // jQuery. This positioning data will be determined when the ListItem is 
  // inserted into a ListView; it can't be determined ahead of time.
  //
  // All positioning data is relative to the containing ListView.

  function ListItem($el) {
    var that = this;

    that.$el = $el;

    that.parent = null;

    that.top = 0;
    that.bottom = 0;
    that.width = 0;
    that.height = 0;
  }

  // ### clone
  //
  // Clones the ListItem.
  ListItem.prototype.clone = function() {
    var that = this,
        item = new ListItem(that.$el);
    item.top = that.top;
    item.bottom = that.bottom;
    item.width = that.width;
    item.height = that.height;
    return item;
  };

  // ### remove
  //
  // Removes the ListItem and its elements from the page, and cleans up after
  // them.

  ListItem.prototype.remove = function() {
    var that = this;

    that.$el.remove();
    removeItemFromPage(that, that.parent);
    that.cleanup();
  };


  // ### cleanup
  //
  // Cleans up after the ListItem without removing it from the page.

  ListItem.prototype.cleanup = function() {
    this.parent = null;
  };


  // ### updateCoords
  //
  // Updates the coordinates of the given ListItem, assuming a given y-offset
  // from the parent ListView.
  //
  // Takes:
  //
  //  - `listItem`: the ListItem whose cached coordinates you want to update.
  //  - `yOffset`: the y-offset of the ListItem from its ListView parent.

  function updateCoords(listItem, yOffset) {
    var $el = listItem.$el,
        offset = $el.offset();
    listItem.top = yOffset;
    listItem.height = $el.outerHeight(true);
    listItem.bottom = listItem.top + listItem.height;
    listItem.width = $el.width();
  }



  // Helper functions
  // ================


  // ### div
  //
  // Returns a new, empty `<div>` jQuery element.

  function div() {
    return $('<div>');
  }


  // ### blankDiv
  // 
  // Returns a new, empty `<div>` jQuery element. The `<div>` will have its 
  // border, margin, and padding set to zero or none, as appropriate.

  function blankDiv() {
    return div().css({
      margin: 0,
      padding: 0,
      border: 'none'
    });
  }


  // ### pxToInt
  //
  // Converts pixel values returned by jQuery to base-10 ints.
  //
  // Takes:
  //
  // - `px`: a string value, which starts with a number and is
  //   postfixed with the string `'px'`.

  //function pxToInt(px) {
  //  return parseInt(px, 10);
  //}


  // Export
  // ======

  // Classes:
  infinity.ListView = ListView;
  infinity.Page = Page;
  infinity.ListItem = ListItem;

  // Destroy own packaging:
  infinity.noConflict = function() {
    window.infinity = oldInfinity;
    return infinity;
  };

}(window, Math, jQuery);
