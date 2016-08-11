/**
 * WAVEFORM.SEGMENTS.JS
 *
 * This module handles all functionality related to the adding,
 * removing and manipulation of segments
 */
define([
  "konva",
  "peaks/waveform/waveform.mixins",
  "peaks/markers/shapes/wave"
], function (Konva, mixins, SegmentShape) {
  'use strict';

  return function (peaks) {
    var self = this;

    self.segments = [];
    self.views = [peaks.waveform.waveformZoomView, peaks.waveform.waveformOverview].map(function(view){
      if (!view.segmentLayer) {
        view.segmentLayer = new Konva.Layer();
        view.stage.add(view.segmentLayer);
        view.segmentLayer.moveToTop();
      }

      return view;
    });

    var createSegmentWaveform = function (segment) {
      var segmentZoomGroup = new Konva.Group();
      var segmentOverviewGroup = new Konva.Group();

      var segmentGroups = [{ group: segmentZoomGroup, view: 'zoomview' }, { group: segmentOverviewGroup, view: 'overview' }];

      var menter = function (event) {
        if (this.parent && this.parent.label) {
          this.parent.label.show();
        }
        if (this.parent && this.parent.view && this.parent.view.segmentLayer) {
          this.parent.view.segmentLayer.draw();
        }
      };

      var mleave = function (event) {
        if (this.parent && this.parent.label) {
          this.parent.label.hide();
        }
        if (this.parent && this.parent.view && this.parent.view.segmentLayer) {
          this.parent.view.segmentLayer.draw();
        }
      };

      segmentGroups.forEach(function(item, i){
        var view = self.views[i];
        var segmentGroup = item.group;

        segmentGroup.waveformShape = SegmentShape.createShape(segment, view);

        segmentGroup.waveformShape.on("mouseenter", menter);
        segmentGroup.waveformShape.on("mouseleave", mleave);

        segmentGroup.add(segmentGroup.waveformShape);

        segmentGroup.label = new peaks.options.segmentLabelDraw(segmentGroup, segment);
        segmentGroup.add(segmentGroup.label.hide());

        if (segment.editable) {
          segmentGroup.inMarker = new peaks.options.segmentInMarker(true, segmentGroup, segment, segmentHandleDrag, peaks.options.segmentDblClickHandler, peaks.options.segmentDragEndHandler);
          segmentGroup.outMarker = new peaks.options.segmentOutMarker(true, segmentGroup, segment, segmentHandleDrag, peaks.options.segmentDblClickHandler, peaks.options.segmentDragEndHandler);

          segmentGroup.add(segmentGroup.inMarker);
          segmentGroup.add(segmentGroup.outMarker);

        } else if (peaks.options.showMarkerLinesWhenUneditable.indexOf(item.view) > -1) {
          segmentGroup.inMarker = new peaks.options.segmentInMarker(false, segmentGroup, segment);
          segmentGroup.outMarker = new peaks.options.segmentOutMarker(false, segmentGroup, segment);

          segmentGroup.add(segmentGroup.inMarker);
          segmentGroup.add(segmentGroup.outMarker);
        }

        view.segmentLayer.add(segmentGroup);
      });

      segment.zoom = segmentZoomGroup;
      segment.zoom.view = peaks.waveform.waveformZoomView;
      segment.overview = segmentOverviewGroup;
      segment.overview.view = peaks.waveform.waveformOverview;

      return segment;
    };

    var updateSegmentWaveform = function (segment) {
      // Binding with data
      peaks.waveform.waveformOverview.data.set_segment(peaks.waveform.waveformOverview.data.at_time(segment.startTime), peaks.waveform.waveformOverview.data.at_time(segment.endTime), segment.id);
      peaks.waveform.waveformZoomView.data.set_segment(peaks.waveform.waveformZoomView.data.at_time(segment.startTime), peaks.waveform.waveformZoomView.data.at_time(segment.endTime), segment.id);

      // Overview
      var overviewStartOffset = peaks.waveform.waveformOverview.data.at_time(segment.startTime);
      var overviewEndOffset = peaks.waveform.waveformOverview.data.at_time(segment.endTime);

      segment.overview.setWidth(overviewEndOffset - overviewStartOffset);

      if (segment.overview.inMarker) {
        segment.overview.inMarker.show().setX(overviewStartOffset - segment.overview.inMarker.getWidth());
        // Change Text
        segment.overview.inMarker.label.setText(mixins.niceTime(segment.startTime, false));
      }

      if (segment.overview.outMarker) {
        segment.overview.outMarker.show().setX(overviewEndOffset);
        // Change Text
        segment.overview.outMarker.label.setText(mixins.niceTime(segment.endTime, false));
      }

      // Label
      // segment.overview.label.setX(overviewStartOffset);

      SegmentShape.update.call(segment.overview.waveformShape, peaks.waveform.waveformOverview, segment.id);

      // Zoom
      var zoomStartOffset = peaks.waveform.waveformZoomView.data.at_time(segment.startTime);
      var zoomEndOffset = peaks.waveform.waveformZoomView.data.at_time(segment.endTime);

      var frameStartOffset = peaks.waveform.waveformZoomView.frameOffset;
      var frameEndOffset = peaks.waveform.waveformZoomView.frameOffset + peaks.waveform.waveformZoomView.width;

      if (zoomStartOffset < frameStartOffset) zoomStartOffset = frameStartOffset;
      if (zoomEndOffset > frameEndOffset) zoomEndOffset = frameEndOffset;

      if (peaks.waveform.waveformZoomView.data.segments[segment.id].visible) {
        var startPixel = zoomStartOffset - frameStartOffset;
        var endPixel = zoomEndOffset - frameStartOffset;

        segment.zoom.show();

        if (segment.zoom.inMarker) {
          segment.zoom.inMarker.show().setX(startPixel - segment.zoom.inMarker.getWidth());
          // Change Text
          segment.zoom.inMarker.label.setText(mixins.niceTime(segment.startTime, false));
        }

        if (segment.zoom.outMarker) {
          segment.zoom.outMarker.show().setX(endPixel);
          // Change Text
          segment.zoom.outMarker.label.setText(mixins.niceTime(segment.endTime, false));
        }

        SegmentShape.update.call(segment.zoom.waveformShape, peaks.waveform.waveformZoomView, segment.id);
      } else {
        segment.zoom.hide();
      }
    };

    var segmentHandleDrag = function (thisSeg, segment) {
      var newInTime, newOutTime, inOffset, outOffset;

      // Allow to end a drag on position 0 and enable a pre-roll drop
      if (thisSeg.inMarker.getX() >= 0) {
        inOffset = thisSeg.view.frameOffset + thisSeg.inMarker.getX() + thisSeg.inMarker.getWidth();
        newInTime = thisSeg.view.data.time(inOffset);
        if (segment.leftBound && !isNaN(segment.leftBound)) {
          newInTime = Math.max(segment.leftBound, newInTime);
        }
        segment.startTime = newInTime;
      }

      // Allow a segment to include the very last position as well
      if (thisSeg.outMarker.getX() <= thisSeg.view.width) {
        outOffset = thisSeg.view.frameOffset + thisSeg.outMarker.getX();
        newOutTime = thisSeg.view.data.time(outOffset);
        if (segment.rightBound && !isNaN(segment.rightBound)) {
          newOutTime = Math.min(segment.rightBound, newOutTime);
        }
        segment.endTime = newOutTime;
      }

      updateSegmentWaveform(segment);
      this.render();
    }.bind(this);

    var getSegmentColor = function () {
      var c;
      if (peaks.options.randomizeSegmentColor) {
        var g = function () { return Math.floor(Math.random()*255); };
        c = 'rgba('+g()+', '+g()+', '+g()+', 1)';
      } else {
        c = peaks.options.segmentColor;
      }
      return c;
    };

    this.init = function () {
      peaks.on("waveform_zoom_displaying", this.updateSegments.bind(this));

      peaks.emit("segments.ready");
    };

    /**
     * Update the segment positioning accordingly to each view zoom level and so on.
     *
     * Also performs the rendering.
     *
     * @api
     */
    this.updateSegments = function () {
      this.segments.forEach(updateSegmentWaveform);
      this.render();
    };

    /**
     * Manages a new segment and propagates it into the different views
     *
     * @api
     * @param {Object}  segment
     * @param {Number}  segment.startTime
     * @param {Number}  segment.endTime
     * @param {Boolean} segment.editable
     * @param {String}  segment.color
     * @param {String}  segment.labelText
     * @param {String}  segment.id. Will be generated if undefined
     * @return {Object}
     */
    this.createSegment = function (segment) {
      if (segment.id === undefined) {
        segment.id = "segment" + self.segments.length;
      }

      if ((segment.startTime >= 0) === false){
        throw new TypeError("[waveform.segments.createSegment] startTime should be a positive value");
      }

      if ((segment.endTime > 0) === false){
        throw new TypeError("[waveform.segments.createSegment] endTime should be a positive value");
      }

      if ((segment.endTime > segment.startTime) === false){
        throw new RangeError("[waveform.segments.createSegment] endTime should be higher than startTime");
      }

      if (self.segments.some(function(item, index, arr) {
        return (item.id === segment.segmentId);
      })) {
        throw new TypeError("[waveform.segments.createSegment] segmentId is already in use");
      }

      if (segment.color === undefined) {
        segment.color = getSegmentColor();
      }
      if (segment.labelText === undefined) {
        segment.labelText = '';
      }

      var newSegment = createSegmentWaveform(segment);

      updateSegmentWaveform(newSegment);
      self.segments.push(newSegment);

      return newSegment;
    };

    this.remove = function removeSegment(segment){
      var index = null;

      this.segments.some(function(s, i){
        if (s === segment){
          index = i;
          return true;
        }
      });

      if (typeof index === 'number'){
        segment = this.segments[index];

        segment.overview.destroy();
        segment.zoom.destroy();
      }

      return index;
    };

    this.removeAll = function removeAllSegments(){
      this.views.forEach(function(view){
        view.segmentLayer.removeChildren();
      });

      this.segments = [];

      this.render();
    };

    /**
     * Performs the rendering of the segments on screen
     *
     * @api
     * @see https://github.com/bbcrd/peaks.js/pull/5
     * @since 0.0.2
     */
    this.render = function renderSegments(){
      this.views.forEach(function(view){
        view.segmentLayer.draw();
      });
    };
  };
});
