!function($, require, provide) {
  'use strict';

  // TODO: (reissbaker):
  // ==================
  // 1. get rid of that godawful
  // `page.shouldBeInView` variable. that's
  // just asking for bugs.

  /*
   * LIST VIEW
   * =========
   *
   * adds support for long, high-performance
   * lists of DOM nodes. for example,
   * infinitely scrolling rows in a grid
   * would benefit from being inside of a 
   * list view.
   *
   * similar in concept to iOS's UITableView
   * or Android's ListView.
   *
   * any list-views extant on the page at
   * load time will automatically be
   * optimized. if you add new list-views
   * after pageload, you must call
   * `listView.update()` to alert the
   * view manager of page changes.
   *
   * please note that list-views keep
   * references to their DOM nodes. if
   * you're writing a pushState-enabled
   * app, you MUST call listView.cleanup()
   * to remove the cached node references
   * when changing pages. otherwise
   * list-views will leak memory.
   *
   * there are several caveats to using
   * list-views:
   *
   * 1. all list-items inside the list-view 
   * must be visible. list-views do not 
   * support hidden list-items. additionally,
   * any elements that affect the height of
   * the list-items must also be at least
   * in the layout, although it's alright if
   * their visibility is set to hidden. they 
   * must not have their display set to none.
   * 
   * 2. list-views can't be nested.
   * 
   * 3. list-items must be the immediate child
   * of their list-view parent.
   *
   * 4. list-views can't have a height set on
   * the list-view elements themselves (i.e., set 
   * directly on the elements via jQuery).
   * however, setting the heights in a stylesheet 
   * is ok. setting the heights of list-items,
   * whether manually on the items or in a
   * stylesheet, is likewise ok.
   */

  var NUM_BUFFER_PAGES = 1,
      PAGES_ONSCREEN = NUM_BUFFER_PAGES * 2 + 1,
      SCROLL_THROTTLE = 150,
      LIST_VIEW_CLASS = 'list-view',
      LIST_ITEM_CLASS = 'list-item';

  var pageContainers = [];

  /*
   * PageContainer
   * -------------
   *
   * groups multiple pages together, and
   * removes them from or places them on
   * the screen as necessary.
   */

  function PageContainer($el, options) {
    var index, length, q, start,
        top = $(window).scrollTop(),
        bottom = top + $(window).height(),
        $els = $el.children('.' + LIST_ITEM_CLASS);

    this.$el = $el;
    initBuffer(this);
    resetHeight(this);
    if(options.lazy) {
      this.lazy = true;
      this.lazyLoadFn = options.lazy;
    } else {
      this.lazy = false;
      this.lazyLoadFn = function() {};
    }
    this.top = $el.offset().top;
    this._moveScheduled = false;
    this.viewportHeight = $(window).height();

    this.queue = q = splitIntoPages(this, $els, this.viewportHeight);
    initPages(this);

    var ref = this;
    this._boundMove = function() { ref.move(); };
    $(window).on('scroll', this._boundMove);
  }
  
  /*
   * attempts to schedule a move event.
   */

  PageContainer.prototype.move = function() {
    var ref = this;
    if(!ref._moveScheduled) {
      ref._moveScheduled = true;
      setTimeout(function() {
        ref.forceMove();
        ref._moveScheduled = false;
      }, SCROLL_THROTTLE);
    }
  };

  /*
   * forces a move event.
   */

  PageContainer.prototype.forceMove = function() {
    var scrollTop = $(window).scrollTop();
    var scrollBottom = scrollTop + this.viewportHeight;
    var nextIndex = this.indexWithinRange(scrollTop, scrollBottom);
    var startIndex = this.startIndex;
    var $buffer = this._$buffer;
    var order = [];

    if(nextIndex < 0) return;
    nextIndex = Math.max(nextIndex - NUM_BUFFER_PAGES, 0);
    nextIndex = Math.min(nextIndex, this.queue.length - 1);

    if(nextIndex !== startIndex) {
      this.map(startIndex, startIndex + PAGES_ONSCREEN, function(curr) {
        curr.shouldBeInView = false;
      });
      this.map(nextIndex, nextIndex + PAGES_ONSCREEN, function(curr) {
        curr.shouldBeInView = true;
        order.push(curr);
      });
      this.map(startIndex, startIndex + PAGES_ONSCREEN, function(curr) {
        if(!curr.shouldBeInView) curr.remove();
      });

      orderedInsert(order);

      this.startIndex = nextIndex;
      updateBuffer(this);
      this.lazyLoad();
    }
  };
  
  /*
   * iterates through the queue.
   */

  PageContainer.prototype.map = function(start, length, cbk) {
    var index = start;
        length = length > this.queue.length ? this.queue.length : length;
    for(index; index < length; index++) {
      cbk(this.queue[index]);
    }
  };


  /*
   * finds the index of the page that starts within the given
   * range of coordinates.
   */

  PageContainer.prototype.indexWithinRange = function(top, bottom) {
    var index, length, curr;
    if(this.queue.length <= 0) return -1;

    curr = this.queue[this.startIndex];
    if(curr.top > bottom) {
      // search above
      for(index = this.startIndex - 1; index >= 0; index--) {
        curr = this.queue[index];
        if(curr.bottom < top) {
          if(index === this.queue.length - 1) return this.queue.length - 1;
          return index + 1;
        }
        if(curr.top <= bottom && curr.bottom >= top) return index;
      }
      return 0;
    } else if (curr.bottom < top) {
      // search below
      for(index = this.startIndex + 1, length = this.queue.length; index < length; index++) {
        curr = this.queue[index];
        if(curr.top > bottom) {
          if(index === 0) return 0;
          return index - 1;
        }
        if(curr.top <= bottom && curr.bottom >= top) return index;
      }
      return this.queue.length - 1;
    }

    // found it
    return this.startIndex;
  };


  /*
   * does an in-place update in response to new list-items
   * being appended to the list-view.
   *
   * this is an optimization over dumping and reparsing
   * the entire list-view.
   *
   * please note that this optimization assumes you only ever
   * append to the list-view. if you prepend, or insert inline,
   * or anything else: you must (currently) dump and reparse.
   */

  PageContainer.prototype.update = function() {
    var last, newChildren, newPages, index, length,
        curr, $el, bufHeight, lastTop,
        loadFn = this.lazyLoadFn,
        hadPages = false;

    if(this.queue.length > 0) {
      hadPages = true;
      this.map(this.startIndex, this.startIndex + PAGES_ONSCREEN, function(page) {
        page.remove();
      });
      bufHeight = this._$buffer.height();
      last = this.queue.pop();
      last.dumpBefore();
      $el = $(last.$els[0]);
      lastTop = $el.offset().top;
      if(lastTop !== last.top) this._$buffer.height(bufHeight + last.top - lastTop);
    }

    resetHeight(this);
    newChildren = this.$el.find('.' + LIST_ITEM_CLASS);
    newPages = splitIntoPages(this, newChildren, this.viewportHeight);
    this.queue = this.queue.concat(newPages);

    if(hadPages) {
      this._$buffer.height(bufHeight);
      for(index = 0, length = newPages.length; index < length; index++) {
        curr = newPages[index];
        curr.remove();
      }
      this.map(this.startIndex, this.startIndex + PAGES_ONSCREEN, function(page) {
        page.shouldBeInView = true; // there may be new pages onscreen
        page.append();
        page.lazyLoad(loadFn);
      });
    } else {
      initPages(this);
    }

  };


  /*
   * cleans up the list-view.
   *
   * doesn't remove all elements, but ensures no memory leaks
   * will occur as a result of the list-view.
   *
   * if you pass `{recycle:true}` to the method, it will
   * dump all list-items back into the DOM in the order they
   * originally appeared.
   */

  PageContainer.prototype.cleanup = function(options) {
    var index, page;
    $(window).off('scroll', this._boundMove);

    if(options.recycle) {
      // stick all pages back in the order they were originally
      for(index = this.queue.length - 1; index >= 0; index--) {
        page = this.queue[index];
        page.dumpBefore();
      }
    }
    this._$buffer.remove();
  };


  /*
   * attempts to lazy-load the images.
   *
   * will do nothing if the instance is not supposed to
   * do lazy loading (aka, if the flag `lazy` wasn't set
   * to true on instantiation).
   */

  PageContainer.prototype.lazyLoad = function() {
    if(this.lazy) {
      var loadFn = this.lazyLoadFn;
      this.map(this.startIndex, this.startIndex + PAGES_ONSCREEN, function(page) {
        page.lazyLoad(loadFn);
      });
    }
  };


  /*
   * Private PageContainer methods
   * -----------------------------
   */

  function initBuffer(p) {
    p._$buffer = blankDiv();
    p.$el.prepend(p._$buffer);
  }

  function resetHeight(p) {
    p.$el.height('');
    p.$el.height(p.$el.height());
  }

  function initPages(p) {
    var start, index, length, 
        q = p.queue;
    p.startIndex = start = 0;

    for(index = start + PAGES_ONSCREEN, length = q.length; index < length; index++) {
      q[index].remove();
    }
    for(index = start, length = Math.min(start + PAGES_ONSCREEN, q.length); index < length; index++) {
      q[index].shouldBeInView = true;
    }
    p.forceMove(); // TODO: make this better (will not work on page boundaries)

    updateBuffer(p);
    p.lazyLoad();
  }

  function updateBuffer(p) {
    if(p.queue.length > 0) {
      var firstPage = p.queue[p.startIndex];
      p._$buffer.height(firstPage.top - p.top);
    } else {
      p._$buffer.height(0);
    }
  }

  function splitIntoPages(parent, $items, viewportHeight) {
    if($items.length <= 0) return [];
    var index, length, curr, currHeight,
        PAGE_HEIGHT = viewportHeight * 1.5,
        height = $($items[0]).position().top,
        pageEls = [],
        pages = [];

    for(index = 0, length = $items.length; index < length; index++) {
      curr = $items[index];
      currHeight = $(curr).position().top - height;
      if(currHeight > PAGE_HEIGHT) {
        height += currHeight;
        pages.push(new Page(parent, pageEls));
        pageEls = [];
      }
      pageEls.push(curr);
    }

    if(pageEls.length !== 0) pages.push(new Page(parent, pageEls));
    
    return pages;
  }

  function orderedInsert(order) {
    var index, curr,
        disordered = false;

    for(index = order.length - 1; index >= 0; index--) {
      curr = order[index];
      if(disordered) {
        curr.remove();
        curr.prepend();
      } else if(!curr.onscreen) {
        if(index === order.length - 1) curr.append();
        else {
          disordered = true;
          curr.prepend();
        }
      }
    }
  }


  /*
   * Page
   * ----
   *
   * group of list items.
   *
   * should take up approx. one screen's
   * worth of space.
   */

  function Page(parent, els) {
    var $first = $(els[0]),
        $last = $(els[els.length - 1]);
    this.parent = parent;
    this.$parent = parent.$el;
    this.$els = $(els);
    this.$els.wrapAll(blankDiv());
    this.$elWrapper = this.$els.parent();
    this.onscreen = true;
    this.lazy = parent.lazy;
    this.top = $first.offset().top - pxToInt($first.css('margin-top'));
    this.bottom = $last.height() + $last.offset().top;
    this.height = this.bottom - this.top;
    this.shouldBeInView = false;
  }

  Page.prototype.append = function() {
    if(!this.onscreen) {
      this.onscreen = true;
      this.$parent.append(this.$elWrapper);
      this.$parent.trigger('list-view-page-in');
    }
  };

  Page.prototype.prepend = function() {
    if(!this.onscreen) {
      this.onscreen = true;
      this.$elWrapper.insertAfter(this.parent._$buffer);
      this.$parent.trigger('list-view-page-in');
    }
  };

  Page.prototype.dumpBefore = function() {
    if(this.onscreen) this.remove();
    this.$els.insertAfter(this.parent._$buffer);
  };

  Page.prototype.dumpAfter = function() {
    if(this.onscreen) this.remove();
    this.$parent.append(this.$els);
  };

  Page.prototype.remove = function() {
    var index, length;
    if(this.onscreen) {
      this.onscreen = false;
      this.$elWrapper.remove();
      this.$parent.trigger('list-view-page-out');
    }
  };

  Page.prototype.lazyLoad = function(cbk) {
    if(this.lazy) {
      cbk.call(this.$elWrapper[0]);
      this.lazy = false;
    }
  };


  /*
   * helpers
   */
  function blankDiv() {
    return $('<div></div>').css({
      margin: 0,
      padding: 0,
      border: 'none'
    });
  }

  function pxToInt(px) {
    return parseInt(px.replace('px', ''), 10);
  }

  /*
   * setup/update/teardown
   * ---------------------
   */

  // save the most recent options here, for automated init calls via resize
  var mostRecentOptions;

  // initialize page
  function init(options) {
    mostRecentOptions = options;
    cleanup(options); // ensure that pageContainers is clean
    $(window).on('resize', resize);

    $('.' + LIST_VIEW_CLASS).each(function() {
      pageContainers.push(new PageContainer($(this), options || {}));
    });
  }

  // update page after content has been dynamically added.
  // (an optimization over calling init() a second time with 
  // recycle set to true.)
  function update() {
    $('.' + LIST_VIEW_CLASS).each(function() {
      var index, length, curr,
          container = null,
          $el = $(this);
      for(index = 0, length = pageContainers.length; index < length; index++) {
        curr = pageContainers[index];
        if(curr.$el.is($el)) {
          container = curr;
          break;
        }
      }

      if(container) container.update();
      else pageContainers.push(new PageContainer($el, mostRecentOptions || {}));
    });
  }

  function resize() {
    var options = {},
        oldOptions = mostRecentOptions;
    for(var prop in mostRecentOptions) {
      options[prop] = mostRecentOptions[prop];
    }
    options.recycle = true;
    init(options);
    if(oldOptions) mostRecentOptions = oldOptions;
  }

  function cleanup(options) {
    var index, length;
    while(pageContainers.length > 0) {
      pageContainers.pop().cleanup(options || {});
    }
    $(window).off('resize', resize);
  }


  // by default, call init at startup.
  init();
  
  /*
   * Export
   * ------
   */

  provide('o2-list-view', {
    init: init,
    update: update,
    cleanup: cleanup,
    _debug: function() { return pageContainers; }
  });
}(jQuery, require, provide);
