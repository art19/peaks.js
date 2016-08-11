/**
 * WAVEFORM.POINTS.JS
 *
 * This module handles all functionality related to the adding,
 * removing and manipulation of points. A point in a segment of zero length
 */
define([
  "peaks/waveform/waveform.mixins",
  "konva"
], function (mixins, Konva) {

  return function (peaks) {
    var self = this;
    var waveformView = peaks.waveform;

    self.points = [];

    self.views = [waveformView.waveformZoomView, waveformView.waveformOverview].map(function(view){
      if (!view.pointLayer) {
        view.pointLayer = new Konva.Layer();
        view.stage.add(view.pointLayer);
        view.pointLayer.moveToTop();
      }

      return view;
    });

    function constructPoint(point) {
      var pointZoomGroup = new Konva.Group();
      var pointOverviewGroup = new Konva.Group();
      var pointGroups = [ { group: pointZoomGroup, view: 'zoomview' }, { group: pointOverviewGroup, view: 'overview' }];

      point.editable = Boolean(point.editable);

      pointGroups.forEach(function(item, i){
        var view = self.views[i];
        var pointGroup = item.group;

        if (point.editable) {
          pointGroup.marker = new peaks.options.pointMarker(true, pointGroup, point, pointHandleDrag, peaks.options.pointDblClickHandler, peaks.options.pointDragEndHandler);
          pointGroup.add(pointGroup.marker);

        } else if (peaks.options.showMarkerLinesWhenUneditable.indexOf(item.view) > -1) {
          pointGroup.marker = new peaks.options.pointMarker(false, pointGroup, point);
          pointGroup.add(pointGroup.marker);
        }

        view.pointLayer.add(pointGroup);
      });

      point.zoom = pointZoomGroup;
      point.zoom.view = waveformView.waveformZoomView;
      point.overview = pointOverviewGroup;
      point.overview.view = waveformView.waveformOverview;

      return point;
    }

    function updatePoint(point) {
      // Binding with data
      waveformView.waveformOverview.data.set_point(waveformView.waveformOverview.data.at_time(point.timestamp), point.id);
      waveformView.waveformZoomView.data.set_point(waveformView.waveformZoomView.data.at_time(point.timestamp), point.id);

      // Overview
      var overviewtimestampOffset = waveformView.waveformOverview.data.at_time(point.timestamp);

      if (point.overview.marker) {
        // Show Pre-/Post-Roll markers one pixel right or left, so they are not cut off and you can
        // actually see them
        if (overviewtimestampOffset < 1) {
          overviewtimestampOffset = 1;
        } else if (overviewtimestampOffset >= point.overview.view.width - 2) {
          overviewtimestampOffset -= 1;
        }

        point.overview.marker.show().setX(overviewtimestampOffset - point.overview.marker.getWidth());
        // Change Text
        point.overview.marker.label.setText(mixins.niceTime(point.timestamp, false));
      }

      // Zoom
      var zoomtimestampOffset = waveformView.waveformZoomView.data.at_time(point.timestamp);
      var frameStartOffset = waveformView.waveformZoomView.frameOffset;

      if (zoomtimestampOffset < frameStartOffset) {
        zoomStartOffset = frameStartOffset;
      }

      if (waveformView.waveformZoomView.data.points[point.id].visible) {
        var startPixel = zoomtimestampOffset - frameStartOffset;

        point.zoom.show();

        if (point.zoom.marker) {
          // Show Pre-/Post-Roll markers one pixel right or left, so they are not cut off and you can
          // actually see them
          if (startPixel < 1) {
            startPixel = 1;
          } else if (startPixel >= point.zoom.view.width - 2) {
            startPixel -= 1;
          }
          point.zoom.marker.show().setX(startPixel - point.zoom.marker.getWidth());
          // Change Text
          point.zoom.marker.label.setText(mixins.niceTime(point.timestamp, false));
        }
      }
      else {
        point.zoom.hide();
      }
    }

    function pointHandleDrag(thisPoint, point) {
      // Allow a drag-end on position 0 as well, otherwise you can never drag to pre-roll
      if (thisPoint.marker.getX() >= 0) {
        var inOffset = thisPoint.view.frameOffset + thisPoint.marker.getX() + thisPoint.marker.getWidth();
        point.timestamp = thisPoint.view.data.time(inOffset);
      }

      updatePoint(point);
      self.render();
    }

    this.init = function () {
      peaks.on("waveform_zoom_displaying", self.updatePoints.bind(self));
      peaks.emit("points.ready");
    };

    this.updatePoints = function () {
      self.points.forEach(updatePoint);
      self.render();
    };

    this.createPoint = function (point) {

      if ((point.timestamp >= 0) === false) {
        throw new RangeError("[waveform.points.createPoint] timestamp should be a >=0 value");
      }

      point.id = "point" + self.points.length;

      point = constructPoint(point);
      updatePoint(point);
      self.points.push(point);
    };

    this.remove = function removePoint(point) {
      var index = null;

      this.points.some(function(p, i){
        if (p === point){
          index = i;
          return true;
        }
      });

      if (typeof index === 'number'){
        point.overview.destroy();
        point.zoom.destroy();
      }

      return index;
    };

    this.removeAll = function removeAllPoints(){
      this.views.forEach(function(view){
        view.pointLayer.removeChildren();
      });

      this.points = [];

      this.render();
    };

    /**
     * Performs the rendering of the segments on screen
     *
     * @api
     * @since 0.3.0
     */
    this.render = function renderPoints(){
      self.views.forEach(function(view){
        view.pointLayer.draw();
      });
    };
  };
});
