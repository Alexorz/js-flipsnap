
/**
 * flipsnap.js
 *
 * @version  0.6.2
 * @url http://pxgrid.github.com/js-flipsnap/
 *
 * Copyright 2011 PixelGrid, Inc.
 * Licensed under the MIT License:
 * http://www.opensource.org/licenses/mit-license.php
 */

(function(window, document, undefined) {

var div = document.createElement('div');
var prefix = ['webkit', 'moz', 'o', 'ms'];
var saveProp = {};
var support = Flipsnap.support = {};
var gestureStart = false;

var DISTANCE_THRESHOLD = 5;
var ANGLE_THREHOLD = 55;

support.transform3d = hasProp([
  'perspectiveProperty',
  'WebkitPerspective',
  'MozPerspective',
  'OPerspective',
  'msPerspective'
]);

support.transform = hasProp([
  'transformProperty',
  'WebkitTransform',
  'MozTransform',
  'OTransform',
  'msTransform'
]);

support.transition = hasProp([
  'transitionProperty',
  'WebkitTransitionProperty',
  'MozTransitionProperty',
  'OTransitionProperty',
  'msTransitionProperty'
]);


support.srcset = typeof new Image().srcset != 'undefined';
support.addEventListener = 'addEventListener' in window;
support.mspointer = window.navigator.msPointerEnabled;

support.cssAnimation = support.transform3d && support.transition; // find touch unusable bug through transform


var doWhenActive = window.requestAnimationFrame;
for(var x = 0; x < prefix.length && !doWhenActive; ++x) {
  doWhenActive = window[prefix[x]+'RequestAnimationFrame'];
}
if ( !doWhenActive ) {
  doWhenActive = function( func ){ func(); };
}

var eventTypes = ['touch', 'mouse'];
var events = {
  start: {
    touch: 'touchstart',
    mouse: 'mousedown'
  },
  move: {
    touch: 'touchmove',
    mouse: 'mousemove'
  },
  end: {
    touch: 'touchend',
    mouse: 'mouseup'
  }
};

if (support.addEventListener) {
  document.addEventListener('gesturestart', function() {
    gestureStart = true;
  });

  document.addEventListener('gestureend', function() {
    gestureStart = false;
  });
}

function Flipsnap(element, opts) {
  return (this instanceof Flipsnap)
    ? this.init(element, opts)
    : new Flipsnap(element, opts);
}

Flipsnap.prototype.init = function(element, opts) {
  var self = this;

  // set element
  self.element = element;
  if (typeof element === 'string') {
    self.element = document.querySelector(element);
  }

  if (!self.element) {
    throw new Error('element not found');
  }

  if (support.mspointer) {
    self.element.style.msTouchAction = 'pan-y';
  }

  // set opts
  opts = self.opts = opts || {};

  self.distance = undefined;
  self.disableTouch = (opts.disableTouch === undefined) ? false : opts.disableTouch;
  self.disableCssTransition = (opts.disableCssTransition === undefined) ? false : opts.disableCssTransition;
  self.disable3d = (opts.disable3d === undefined) ? false : opts.disable3d;
  self.transitionDuration = (opts.transitionDuration === undefined) ? 350 : opts.transitionDuration;
  self.loop = !!opts.loop;
  self.autoPlayDuration = isNaN(opts.autoPlayDuration) ? 4000 : Number(opts.autoPlayDuration);
  self.enableAutoPlay = (opts.enableAutoPlay === undefined) ? false : opts.enableAutoPlay;
  self.itemWidth = isNaN(opts.itemWidth) ? null : Number(opts.itemWidth);

  // set property
  self.currentPoint = 0;
  self._currentPoint = 0; // _currentPoint & currentPoint will be diffrent in loop mode, currentPoint is for user.
  self.maxPoint = undefined;
  self._maxPoint = undefined; // _maxPoint & maxPoint will be diffrent in loop mode, maxPoint is for user.
  self.currentX = 0;
  self.animation = false;
  self.use3d = support.transform3d;
  if (self.disable3d === true) {
      self.use3d = false;
  }

  // set default style
  if (support.cssAnimation) {
    self._setStyle({
      transitionProperty: getCSSVal('transform'),
      transitionTimingFunction: 'cubic-bezier(0,0,0.5,1)',
      transitionDuration: '0ms',
      transform: self._getTranslate(0)
    });
  }
  else {
    self._setStyle({
      position: 'relative',
      left: '0px'
    });
  }

  // initilize
  self.refresh();

  eventTypes.forEach(function(type) {
    self.element.addEventListener(events.start[type], self, false);
  });

  return self;
};

Flipsnap.prototype.handleEvent = function(event) {
  var self = this;

  switch (event.type) {
    // start
    case events.start.touch: self._touchStart(event, 'touch'); break;
    case events.start.mouse: self._touchStart(event, 'mouse'); break;

    // move
    case events.move.touch: self._touchMove(event, 'touch'); break;
    case events.move.mouse: self._touchMove(event, 'mouse'); break;

    // end
    case events.end.touch: self._touchEnd(event, 'touch'); break;
    case events.end.mouse: self._touchEnd(event, 'mouse'); break;

    // click
    case 'click': self._click(event); break;
  }
};

Flipsnap.prototype.refresh = function() {
  var self = this;

  // pause auto-play
  self.pauseAutoPlay();

  // Remove loop fakers
  if ( self.firstLoopFaker ) {
    self.element.removeChild( self.firstLoopFaker );
    self.firstLoopFaker = null;
  }
  if ( self.lastLoopFaker ) {
    self.element.removeChild( self.lastLoopFaker );
    self.lastLoopFaker = null;
  }

  // cache item count
  var items = self.items = (function() {
    var childNodes = self.element.childNodes,
      i = 0,
      len = childNodes.length,
      node,
      nodes = [];
    for(; i < len; i++) {
      node = childNodes[i];
      if (node.nodeType === 1) {
        nodes.push(node);
      }
    }
    return nodes;
  })();
  self.itemLength = self._itemLength = items.length;

  // setting max point
  self.maxPoint = self._maxPoint = (self.opts.maxPoint === undefined) ? self._itemLength - 1 : self.opts.maxPoint;

  // set loop changes
  if(self.loop){
    var first = self.element.firstElementChild;
    var last = self.element.lastElementChild;
    self.firstLoopFaker = first.cloneNode(true);
    self.lastLoopFaker = last.cloneNode(true);
    self.element.appendChild(self.firstLoopFaker);
    self.element.insertBefore(self.lastLoopFaker, self.element.firstElementChild);
    self._itemLength = self._itemLength === 0 ? 0 : ( self._itemLength + 2 );
    self._maxPoint = self._maxPoint < 0 ? self._maxPoint : ( self._maxPoint + 2 );
    items.push(self.firstLoopFaker);
    items.unshift(self.lastLoopFaker);
  }

  // set scroller width
  self.scrollWidth = items.length < 1 ? 0 : self._itemLength * ( self.itemWidth || getOuterWidth(items[0]) );
  self.element.style.width = self.scrollWidth + 'px';

  // setting distance
  self.updateDistance();

  // cache images
  var itemImgs = self.itemImgs = [];
  for(var i=0, l=items.length; i<l; i++) {
    var imgs = items[i].getElementsByTagName('img');
    itemImgs[i] = findLazyImgs(imgs);
  }

  // setting maxX
  self._maxX = -self._distance * self._maxPoint;

  self.moveToPoint( self.currentPoint || 0,0);

  // resume if enable auto-play
  if ( self.isAutoPlayEnable() ) {
    self.resumeAutoPlay();
  }
};

Flipsnap.prototype.updateDistance = function() {
  var self = this;

  if (self.opts.distance === undefined) {
    if (self._maxPoint < 0) {
      self._distance = 0;
    }
    else {
      self._distance = self.scrollWidth / (self._maxPoint + 1);
    }
  }
  else {
    self._distance = self.opts.distance;
  }
};

Flipsnap.prototype.hasNext = function() {

  return this.loop ? true : this.currentPoint < this.maxPoint;
};

Flipsnap.prototype.hasPrev = function() {

  return this.loop ? true : this.currentPoint > 0;
};

Flipsnap.prototype.toNext = function(transitionDuration) {
  var self = this;

  if ( !self.hasNext()) {
    return;
  }

  if ( self.loop && self.currentPoint >= self.maxPoint ) {
    self.animation = false;
    self._setStyle({ transitionDuration: '0ms' });
    // Timeout for IE 11
    setTimeout(function(){
      self._setX(0, 0);
      setTimeout(function(){
        self.moveToPoint(0, transitionDuration);
      }, 10);
    }, 10);
  }
  else {
    self.moveToPoint(self.currentPoint + 1, transitionDuration);
  }
};

Flipsnap.prototype.toPrev = function(transitionDuration) {
  var self = this;

  if (!self.hasPrev()) {
    return;
  }

  if ( self.loop && self.currentPoint === 0 ) {
    self.animation = false;
    self._setStyle({ transitionDuration: '0ms' });
    // Timeout for IE 11
    setTimeout(function(){
      self._setX(self._maxX, 0);
      setTimeout(function(){
        self.moveToPoint(self.maxPoint, transitionDuration);
      }, 10);
    }, 10);
  }
  else {
    self.moveToPoint(self.currentPoint - 1, transitionDuration);
  }
};

Flipsnap.prototype._realPointToUserPoint = function( _point ){

  return this.loop ? ( _point < 1 ? self.maxPoint : (_point - 1) ) : _point;
};

Flipsnap.prototype._userPointToRealPoint = function( point ){

  return this.loop ? point + 1 : point;
};

Flipsnap.prototype.moveToPoint = function(point, transitionDuration, fromTouch) {
  var self = this;
  var _point;

  if ( point === undefined ) {
    point = self.currentPoint;
  }
  else {
    if (point < 0 || isNaN( point ) ) {
      point = 0;
    }
    else if (point > self.maxPoint) {
      point = self.maxPoint;
    }
  }
  self._moveToPoint( self.loop ? point + 1 : point, transitionDuration, fromTouch );
};

Flipsnap.prototype._moveToPoint = function(_point, transitionDuration, fromTouch ) {
  var self = this;

  clearTimeout(self._moveendTimeout);
  clearTimeout(self._autoPlayTimeout);

  // point show for user.
  var point = self._realPointToUserPoint( _point );
  var beforePoint = self.currentPoint;
  var _beforePoint = self._currentPoint;

  // When not manually touch.
  if ( !fromTouch ) {
    self._triggerEvent('fsmovestart', true, false);

    // Set lazy img before non-manually point move.
    self.showItemLazyImgs( point );
  }

  transitionDuration = transitionDuration === undefined
    ? self.transitionDuration : transitionDuration;

  self.currentPoint = point;
  self._currentPoint = _point;

  var evData = {
    moved: beforePoint !== self.currentPoint, // is point moved?
    originalPoint: beforePoint,
    newPoint: self.currentPoint
  };
  var moveEndCallback = function(){
    self._triggerEvent('fsmoveend', true, false, evData);
    // Resume auto-play after moveend.
    if ( self.isAutoPlayEnable() ) {
      self.resumeAutoPlay();
    }

    // Show lazy image after animation when manually touching.
    if ( fromTouch ) {
      self.showItemLazyImgs( point );
    }

    // Load next lazy image.
    var nextIndex = (point + 1) % self.itemLength;
    setTimeout(function(){
      self.nextImgLazyDfd = self.loadItemLazyImgs( nextIndex, function(){
        self.showItemLazyImgs( nextIndex );
      });
    }, 100 / 6);

  };

  // Use js animation when disable css transition.
  if ( support.cssAnimation && !self.disableCssTransition ) {
    self._setStyle({ transitionDuration: transitionDuration + 'ms' });
    self._moveendTimeout = setTimeout( moveEndCallback , transitionDuration );
  }
  else if ( transitionDuration !== 0 ) {
    self.animation = true;
  }

  self._setX(- self._currentPoint * self._distance, transitionDuration, moveEndCallback);

  if ( evData.moved ) {
    self._triggerEvent('fspointmove', true, false, evData);
  }
};

Flipsnap.prototype._setX = function(x, transitionDuration, moveEndCallback) {
  var self = this;

  // Animation
  if ( self.animation ) {
    if (support.cssAnimation && !self.disableCssTransition ) {
      self.element.style[ saveProp.transform ] = self._getTranslate(x);
      self.currentX = x;
    }
    else {
      self._animate(x, transitionDuration || self.transitionDuration, moveEndCallback);
    }
  }
  // Single frame
  else {
    if ( support.cssAnimation ) {
      self.element.style[ saveProp.transform ] = self._getTranslate(x);
    }
    else {
      self.element.style.left = x + 'px';
    }
    self.currentX = x;
  }
};

Flipsnap.prototype._touchStart = function(event, type) {
  var self = this;

  if (self.disableTouch || self.scrolling || gestureStart) {
    return;
  }

  clearInterval(self._animateTimer);
  clearTimeout(self._moveendTimeout);

  // Pause auto-play.
  self.pauseAutoPlay();

  // Pause image lazy load.
  if ( self.nextImgLazyDfd ) {
    self.nextImgLazyDfd.reject();
  }

  self.element.addEventListener(events.move[type], self, false);
  document.addEventListener(events.end[type], self, false);

  var tagName = event.target.tagName;
  if (type === 'mouse' && tagName !== 'SELECT' && tagName !== 'INPUT' && tagName !== 'TEXTAREA' && tagName !== 'BUTTON') {
    event.preventDefault();
  }

  if (support.cssAnimation) {
    self._setStyle({ transitionDuration: '0ms' });
  }
  self.animation = false;
  self.scrolling = true;
  self.moveReady = false;
  self.startPageX = getPage(event, 'pageX');
  self.startPageY = getPage(event, 'pageY');
  self.basePageX = self.startPageX;
  self.directionX = 0;
  self.startTime = event.timeStamp;
  self._triggerEvent('fstouchstart', true, false);

  // Show next lazy image when manually touch start.
  self.showItemLazyImgs( ( self.currentPoint + 1 ) % self.itemLength );
  // When loop mode, user maybe snap left and left.
  if ( self.loop ) {
    self.showItemLazyImgs( ( self.itemLength + self.currentPoint - 1 ) % self.itemLength );
  }
};

Flipsnap.prototype._touchMove = function(event, type) {
  var self = this;

  if (!self.scrolling || gestureStart) {
    return;
  }

  var pageX = getPage(event, 'pageX');
  var pageY = getPage(event, 'pageY');
  var distX;
  var newX;
  var directionX;

  if (self.moveReady) {
    event.preventDefault();

    distX = pageX - self.basePageX;
    newX = self.currentX + distX;
    if (newX >= 0 || newX < self._maxX) {
      newX = Math.round(self.currentX + distX / 3);
    }

    // When distX is 0, use one previous value.
    // For android firefox. When touchend fired, touchmove also
    // fired and distX is certainly set to 0.
    directionX = self.directionX =
      distX === 0 ? self.directionX :
      distX > 0 ? -1 : 1;

    // Loop newX
    if ( self.loop ) {
      var leftRealSide = -1 * self._distance;
      var rightRealSide = -1 * self._distance * ( self._itemLength - 2 );
      if ( directionX == -1 ) {
        if ( self.currentX <= leftRealSide && newX > leftRealSide ) {
          newX = self._maxX + newX - leftRealSide;
        }
        else if ( self.currentX > leftRealSide && newX >= 0 ) {
          newX = rightRealSide + newX;
        }
      }
      else if ( directionX == 1 ) {
        if ( self.currentX >= rightRealSide  && newX < rightRealSide ) {
          newX = 0 + newX - rightRealSide ;
        }
        else if ( self.currentX < rightRealSide && newX <= self._maxX ) {
          newX = leftRealSide + newX - self._maxX;
        }
      }
    }

    // if they prevent us then stop it
    var isPrevent = !self._triggerEvent('fstouchmove', true, true, {
      delta: distX,
      direction: self.directionX
    });

    self._triggerEvent('fsmove', true, true, {
      absoluteX: newX
    });

    if (isPrevent) {
      self._touchAfter({
        moved: false,
        originalPoint: self.currentPoint,
        newPoint: self.currentPoint,
        cancelled: true
      });
    } else {
      self._setX(newX);
    }
  }
  else {
    // https://github.com/pxgrid/js-flipsnap/pull/36
    var triangle = getTriangleSide(self.startPageX, self.startPageY, pageX, pageY);
    if (triangle.z > DISTANCE_THRESHOLD) {
      if (getAngle(triangle) > ANGLE_THREHOLD) {
        event.preventDefault();
        self.moveReady = true;
        self.element.addEventListener('click', self, true);
        self._triggerEvent('fsmovestart', true, false);
        // Load lazy images in next item.
        self.loadItemLazyImgs( (self.currentPoint + self.directionX) % self.itemLength );
      }
      else {
        self._touchAfter({
          moved: false,
          originalPoint: self.currentPoint,
          newPoint: self.currentPoint
        });

        if ( ( !support.cssAnimation || self.disableCssTransition ) && -1 * self.currentPoint * self._distance != self.currentX ) {
          self.moveToPoint( undefined, undefined, true );
        }

        if ( self.isAutoPlayEnable() ) {
          self.resumeAutoPlay();
        }
      }
    }
  }

  self.basePageX = pageX;
};

Flipsnap.prototype._touchEnd = function(event, type) {
  var self = this;

  self.element.removeEventListener(events.move[type], self, false);
  document.removeEventListener(events.end[type], self, false);

  if (!self.scrolling) {
    return;
  }

  var _newPoint = -self.currentX / self._distance;
  var newPoint;

  _newPoint =
    (self.directionX > 0) ? Math.ceil(_newPoint) :
    (self.directionX < 0) ? Math.floor(_newPoint) :
    Math.round(_newPoint);

  if (_newPoint < 0) {
    _newPoint = 0;
  }
  else if (_newPoint > self._maxPoint) {
    _newPoint = self._maxPoint;
  }

  newPoint = self._realPointToUserPoint( _newPoint );

  self._touchAfter({
    moved: newPoint !== self.currentPoint,
    originalPoint: self.currentPoint,
    newPoint: newPoint,
    cancelled: false
  });

  self._moveToPoint(_newPoint, undefined, true);
};

Flipsnap.prototype._click = function(event) {
  var self = this;

  event.stopPropagation();
  event.preventDefault();
};

Flipsnap.prototype._touchAfter = function(params) {
  var self = this;

  self.scrolling = false;
  self.moveReady = false;

  setTimeout(function() {
    self.element.removeEventListener('click', self, true);
  }, 200);

  self._triggerEvent('fstouchend', true, false, params);
};

// Auto-play interfaces: isAutoPlayEnable, autoPlay, cancleAutoPlay, pauseAutoPlay, resumeAutoPlay
Flipsnap.prototype.isAutoPlayEnable = function( ) {

  return this.enableAutoPlay && this.itemLength > 1;
};

Flipsnap.prototype.autoPlay = function( ) {

  this.enableAutoPlay = true;
  return this.resumeAutoPlay();
};

Flipsnap.prototype.cancleAutoPlay = function(){

  this.enableAutoPlay = false;
  return this.pauseAutoPlay();
};

Flipsnap.prototype.pauseAutoPlay = function(){

  clearTimeout( this._autoPlayTimeout );
  return this;
};

Flipsnap.prototype.resumeAutoPlay = function(){
  var self = this;

  if ( self.isAutoPlayEnable() ) {

    var nextIndex = (self.currentPoint + 1) % self.itemLength;
    var waitCount = 2;

    var checkAllDone = function(){
      if ( --waitCount === 0 ) {
        // Do after finish load image & auto-play timeout.

        // Next step
        doWhenActive(function(){
          self._autoPlayTimeout = setTimeout(function(){
            if ( self.hasNext() ) {
              self.toNext();
            }
            else {
              self.moveToPoint(0);
            }
          }, self.autoPlayDuration / 3);
        });
      }
    };

    if ( self.nextImgLazyDfd ) {
      self.nextImgLazyDfd.always( checkAllDone );
    }
    else {
      checkAllDone();
    }

    clearTimeout( self._autoPlayTimeout );
    self._autoPlayTimeout = setTimeout(checkAllDone, self.autoPlayDuration * 2  / 3);

  }
  return this;
};



Flipsnap.prototype._setStyle = function(styles) {
  var self = this;
  var style = self.element.style;

  for (var prop in styles) {
    setStyle(style, prop, styles[prop]);
  }
};

Flipsnap.prototype._animate = function(x, transitionDuration, callback) {
  var self = this;
  var elem = self.element;
  var begin = +new Date();
  var from = self.currentX;
  var to = x;
  var duration = transitionDuration;
  var easing = function(time, duration) {
    return -(time /= duration) * (time - 2);
  };
  self._animateTimer = setInterval(function() {
    var time = new Date() - begin;
    var pos, now;
    if (time > duration) {
      clearInterval(self._animateTimer);
      now = to;
      setTimeout(function(){
        if ( typeof callback == 'function' ) {
          callback();
        }
      }, 100/6 );
    }
    else {
      pos = easing(time, duration);
      now = pos * (to - from) + from;
    }

    if (support.cssAnimation) {
      setStyle( elem.style, 'transform', self._getTranslate(now) );
    }
    else {
      elem.style.left = now + "px";
    }
    self.currentX = now;
    self._triggerEvent('fsmove', true, true, {
      absoluteX: now
    });
  }, 100/6 );
};

Flipsnap.prototype.destroy = function() {
  var self = this;

  eventTypes.forEach(function(type) {
    self.element.removeEventListener(events.start[type], self, false);
  });
};

Flipsnap.prototype._getTranslate = function(x) {
  var self = this;

  return self.use3d
    ? 'translate3d(' + x + 'px, 0, 0)'
    : 'translate(' + x + 'px, 0)';
};

Flipsnap.prototype._triggerEvent = function(type, bubbles, cancelable, data) {
  var self = this;

  var ev = document.createEvent('Event');
  ev.initEvent(type, bubbles, cancelable);

  if (data) {
    for (var d in data) {
      if (data.hasOwnProperty(d)) {
        ev[d] = data[d];
      }
    }
  }

  return self.element.dispatchEvent(ev);
};

function getPage(event, page) {
  return event.changedTouches ? event.changedTouches[0][page] : event[page];
}

function hasProp(props) {
  return some(props, function(prop) {
    return div.style[ prop ] !== undefined;
  });
}

function setStyle(style, prop, val) {
  var _saveProp = saveProp[ prop ];
  if (_saveProp) {
    style[ _saveProp ] = val;
  }
  else if (style[ prop ] !== undefined) {
    saveProp[ prop ] = prop;
    style[ prop ] = val;
  }
  else {
    some(prefix, function(_prefix) {
      var _prop = ucFirst(_prefix) + ucFirst(prop);
      if (style[ _prop ] !== undefined) {
        saveProp[ prop ] = _prop;
        style[ _prop ] = val;
        return true;
      }
    });
  }
}

// Export as a util function.
Flipsnap.prototype.setStyle = setStyle;


// Functions for image lazy load.
function findLazyImgs(imgs){
  var res = [];
  for(var i=0, l=imgs.length; i<l; i++) {
    if ( isLazyImg(imgs[i]) ){
      res.push(imgs[i]);
    }
  }
  return res;
}

function isLazyImg(img){
  return !!img.getAttribute('lazy-src');
}

Flipsnap.prototype.showItemLazyImgs = function( index ){
  var self = this;

  var _index = self._userPointToRealPoint(index);
  var imgs = self.itemImgs[_index];

  if ( !imgs || !imgs.length ) {
    return ;
  }

  if ( self.loop ) {
    if ( index == 0 ) {
      imgs = imgs.concat( self.itemImgs[ self._itemLength - 1 ] );
    }
    if ( index == self.itemLength - 1 ) {
      imgs = imgs.concat( self.itemImgs[ 0 ] );
    }
  }

  for( var i=0, l= imgs.length; i<l; i++ ) {
    setLazyImg( imgs[i] );
  }
}

Flipsnap.prototype.loadItemLazyImgs = function( index, callback ){
  var self = this;

  var _index = self._userPointToRealPoint(index);
  var imgs = self.itemImgs[_index];

  if ( !imgs || !imgs.length ) {
    return ;
  }

  var waitCount = imgs.length;
  var dfd = {
    status: 'padding',
    callbacks: [],
    status: function (){ return status; },
    reject: function (){ this.status = 'fail'; },
    always: function( callback ){
      if ( typeof callback == 'function' ) {
        if ( this.status == 'success' || this.status == 'fail' ) {
          callback();
        }
        else {
          this.callbacks.push( callback );
        }
      }
    }
  };

  dfd.always( callback );

  for( var i=0, l= imgs.length; i<l; i++ ) {
    loadLazyImg( imgs[i], function(){
      if ( --waitCount == 0 && dfd.status != 'fail' ) {
        dfd.status = 'success';
        for( var i=0, l=dfd.callbacks.length; i<l; i++ ) {
          dfd.callbacks[i]();
        }
      }
    });
  }

  return dfd;
}

function setLazyImg(img){
  var lazySrc = img.getAttribute('lazy-src');
  var lazySrcset = img.getAttribute('lazy-srcset');
  var setedSrc = img.getAttribute('seted-lazy-src');
  var useSrcset = support.srcset && lazySrcset;
  var id = useSrcset ? lazySrcset : lazySrc;

  if ( id && setedSrc != id ) {
    img[ useSrcset ? 'srcset' : 'src' ] = useSrcset ? lazySrcset : lazySrc;
    img.setAttribute('seted-lazy-src', id);
  }
}

var imgLoadedMap = {};

function loadLazyImg(img, callback){
  var loader = new Image();
  var lazySrc = img.getAttribute('lazy-src');
  var lazySrcset = img.getAttribute('lazy-srcset');
  var useSrcset = support.srcset && lazySrcset;
  var id = useSrcset ? lazySrcset : lazySrc;

  if ( id && !imgLoadedMap[ id ] ) {
    loader.onload = loader.onerror = callback;
    loader[ useSrcset ? 'srcset' : 'src' ] = useSrcset ? lazySrcset : lazySrc;
    imgLoadedMap[ id ] = true;
  }
  else {
    callback();
  }
}

function getOuterWidth(el){
  // Code from https://github.com/jquery/jquery/blob/master/src/css/var/getStyles.js
  var style = el.ownerDocument.defaultView.opener ? el.ownerDocument.defaultView.getComputedStyle( el, null )
                                          : window.getComputedStyle( el, null );
  var marginLeft = Number((style['marginLeft'] || style['margin-left'] || '').slice(0,-2));
  var marginRight = Number((style['marginRight'] || style['margin-right'] || '').slice(0,-2));

  return el.offsetWidth + marginLeft + marginRight;
}

function getCSSVal(prop) {
  if (div.style[ prop ] !== undefined) {
    return prop;
  }
  else {
    var ret;
    some(prefix, function(_prefix) {
      var _prop = ucFirst(_prefix) + ucFirst(prop);
      if (div.style[ _prop ] !== undefined) {
        ret = '-' + _prefix + '-' + prop;
        return true;
      }
    });
    return ret;
  }
}

function ucFirst(str) {
  return str.charAt(0).toUpperCase() + str.substr(1);
}

function some(ary, callback) {
  for (var i = 0, len = ary.length; i < len; i++) {
    if (callback(ary[i], i)) {
      return true;
    }
  }
  return false;
}

function getTriangleSide(x1, y1, x2, y2) {
  var x = Math.abs(x1 - x2);
  var y = Math.abs(y1 - y2);
  var z = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));

  return {
    x: x,
    y: y,
    z: z
  };
}

function getAngle(triangle) {
  var cos = triangle.y / triangle.z;
  var radina = Math.acos(cos);

  return 180 / (Math.PI / radina);
}

if (typeof exports == 'object') {
  module.exports = Flipsnap;
}
else if (typeof define == 'function' && define.amd) {
  define(function() {
    return Flipsnap;
  });
}
else {
  window.Flipsnap = Flipsnap;
}

})(window, window.document);
