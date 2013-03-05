describe('Flipsnap', function() {
  var html;
  var $flipsnap;
  var f;
  beforeEach(function() {
    html = '<div class="flipsnap">' +
               '  <div style="width:100px">item1</div>' + 
               '  <div style="width:100px">item2</div>' + 
               '  <div style="width:100px">item3</div>' + 
               '</div>';
    $flipsnap = $(html).appendTo('#sandbox');
    f = Flipsnap($flipsnap.get(0));
  });
  afterEach(function() {
    $(f.element).remove();
  });

  describe('constructor', function() {
    context('when set dom element', function() {
      it('element should be set', function() {
        var div = document.createElement('div');
        var f = Flipsnap(div);
        expect(f.element).to.be(div);
      });
    });

    context('when set string(css seclector)', function() {
      context('when exist element', function() {
        it('element should be search by selector', function() {
          var $foo = $('<div id="foo">').appendTo('body');
          var f = Flipsnap('#foo');
          expect(f.element).to.be($foo.get(0));
          $foo.remove();
        });
      });

      context('when not exist element', function() {
        it('should throw error' ,function() {
          expect(function() {
            Flipsnap('#foo');
          }).to.throwError(/element not found/);
        });
      });
    });
  });

  describe('maxPoint', function() {
    context('when set maxPoint to 0', function() {
      it('should set _maxPoint to 0', function() {
        var f = Flipsnap($(html).get(0), { maxPoint: 0 });
        expect(f._maxPoint).to.be(0);
      });
    });

    context('when set maxPoint to 1', function() {
      it('should set _maxPoint to 1', function() {
        var f = Flipsnap($(html).get(0), { maxPoint: 1 });
        expect(f._maxPoint).to.be(1);
      });
    });

    context('when dont set maxPoint', function() {
      it('should set _maxPoint to element length - 1', function() {
        var f = Flipsnap($(html).get(0));
        expect(f._maxPoint).to.be(2);
      });
    });
  });

  describe('#hasNext', function() {
    context('when has next element', function() {
      it('should return true', function() {
        expect(f.hasNext()).to.be(true);
      });
    });

    context('when not has next element', function() {
      it('should return false', function() {
        f.moveToPoint(2);
        expect(f.hasNext()).to.be(false);
      });
    });
  });

  describe('#hasPrev', function() {
    context('when has prev element', function() {
      it('should return false', function() {
        f.moveToPoint(1);
        expect(f.hasPrev()).to.be(true);
      });
    });

    context('when not has prev element', function() {
      it('should return true', function() {
        expect(f.hasPrev()).to.be(false);
      });
    });
  });

  describe('#toNext', function() {
    context('when currentPoint is not maxPoint', function() {
      it('currentPoint should be increment', function() {
        expect(f.currentPoint).to.be(0);
        f.toNext();
        expect(f.currentPoint).to.be(1);
      });
    });

    context('when currentPoint is maxPoint', function() {
      it('currentPoint should be not increment', function() {
        f.moveToPoint(2);
        expect(f.currentPoint).to.be(2);
        f.toNext();
        expect(f.currentPoint).to.be(2);
      });
    });
  });

  describe('#toPrev', function() {
    context('when currentPoint is not 0', function() {
      it('currentPoint should be increment', function() {
        f.moveToPoint(1);
        expect(f.currentPoint).to.be(1);
        f.toPrev();
        expect(f.currentPoint).to.be(0);
      });
    });

    context('when currentPoint is 0', function() {
      it('currentPoint should be not increment', function() {
        expect(f.currentPoint).to.be(0);
        f.toPrev();
        expect(f.currentPoint).to.be(0);
      });
    });
  });

  describe('#moveToPoint', function() {
    context('when argument greater than maxPoint', function() {
      it('currentPoint should change to maxPoint', function() {
        f.moveToPoint(5);
        expect(f.currentPoint).to.be(2);
      });
    });

    context('when argument less than 0', function() {
      it('currentPoint should change to 0', function() {
        f.moveToPoint(1);
        f.moveToPoint(-1);
        expect(f.currentPoint).to.be(0);
      });
    });

    context('when argument betoween 0 and maxPoint', function() {
      it('should change currentPoint', function() {
        f.moveToPoint(1);
        expect(f.currentPoint).to.be(1);
      });
    });
  });

  describe('Flip Events', function() {
    function trigger(element, eventType, params) {
      var ev = document.createEvent('Event');
      ev.initEvent(eventType, true, false);
      $.extend(ev, params || {});
      element.dispatchEvent(ev);
    }

    function moveEventTest(start, move, end) {
      it('should move to next', function() {
        trigger(f.element, start, { pageX: 50, pageY: 0 });
        expect(f.currentPoint).to.be(0);

        trigger(f.element, move, { pageX: 40, pageY: 0 });
        trigger(f.element, move, { pageX: 30, pageY: 0 });
        expect(f.currentPoint).to.be(0);

        trigger(document, end);
        expect(f.currentPoint).to.be(1);
      });

      it('should move to prev', function() {
        trigger(f.element, start, { pageX: 50, pageY: 0 });
        trigger(f.element, move, { pageX: 40, pageY: 0 });
        trigger(f.element, move, { pageX: 30, pageY: 0 });
        trigger(document, end);
        expect(f.currentPoint).to.be(1);

        trigger(f.element, start, { pageX: 50, pageY: 0 });
        expect(f.currentPoint).to.be(1);

        trigger(f.element, move, { pageX: 60, pageY: 0 });
        trigger(f.element, move, { pageX: 70, pageY: 0 });
        expect(f.currentPoint).to.be(1);

        trigger(document, end);
        expect(f.currentPoint).to.be(0);
      });
    }

    context('when fired touch event', function() {
      moveEventTest('touchstart', 'touchmove', 'touchend');
    });

    context('when fired mouse event', function() {
      moveEventTest('mousedown', 'mousemove', 'mouseup');
    });

    context('when fired MSPointer event', function() {
      moveEventTest('MSPointerDown', 'MSPointerMove', 'MSPointerUp');
    });

    context('when fired touchstart and mousedown event', function() {
      beforeEach(function() {
        this.spy = sinon.spy(f.element, 'addEventListener');
        trigger(f.element, 'touchstart', { pageX: 0, pageY: 0 });
        trigger(f.element, 'mousedown', { pageX: 0, pageY: 0 });
      });
      afterEach(function() {
        this.spy.restore();
      });

      it('_eventType should be first fired event type', function() {
        expect(f._eventType).to.be('touch');
      });

      it('move event should bind only first fired event type', function() {
        expect(this.spy.callCount).to.be(1);
        expect(this.spy.args[0][0]).to.be('touchmove');
      });
    });
  });
});
