/**
 * ZOOMS.STATIC.JS
 *
 * This module is a zoom view adapter with no animations.
 */
define([], function () {
  'use strict';

  return {
    init: function (currentSampleRate, previousSampleRate, view) {
      return {
        start: function() {
          var newRightBound, newLeftBound, targetFrame, lastFrame, lastVisible;

          view.segmentLayer.draw();
          view.pointLayer.draw();

          lastFrame = view.data.adapter.length;
          targetFrame = view.data.at_time(view.peaks.time.getCurrentTime());

          // If the targetFrame would be in the center of the view
          newLeftBound  = targetFrame - view.width / 2;
          newRightBound = targetFrame + view.width / 2;

          // If we can set the frameOffset to the left bound without exceeding the last frame, we're good
          if ((newLeftBound >= 0) && (newRightBound <= lastFrame)) {
            view.frameOffset = Math.trunc(newLeftBound);

          // If the right bound exceeds the last frame, move the frameOffset to the left. NB: frameOffset is zero-based
          } else if (newRightBound > lastFrame) {
            view.frameOffset = lastFrame - 1 - view.width;

          // Start at the waveform the beginning
          } else {
            view.frameOffset = 0;
          }

          view.seekFrame(targetFrame);
        }
      };
    },
  };
});
