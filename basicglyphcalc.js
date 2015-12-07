"use strict"

// Calculates basic glyph sizes from ascii.png

function setBasicGlyphSizes(texture) {
  var width = 128;
  var height = 128;
  var maxCharWidth = width / 16;
  var maxCharHeight = height / 16;
  var renderer = new PIXI.CanvasRenderer(width, height);
  var stage = new PIXI.Container();
  var sprite = new PIXI.Sprite(texture);
  stage.addChild(sprite);
  document.body.appendChild(renderer.view);
  renderer.render(stage);
  var rgba = renderer.view.getContext("2d").getImageData(0, 0, width, height).data;
  window.rgba = rgba;
  for (var character = 0; character < 128; character++) {
    if (character == 32) {
      basicGlyphSizes[32] = [0, 2];
    } else {
      var colIx = character % 16;
      var rowIx = Math.floor(character / 16);
      var colPixel = colIx * maxCharWidth;
      var chStart = 0;
      for (var c = 0; c < maxCharWidth; c++) {
        chStart = c;
        if (!isColEmpty(rgba, rowIx, colPixel+c, width, maxCharWidth, maxCharHeight)) {
          break;
        }
      }

      var chEnd = maxCharWidth - 1;
      for (var c = maxCharWidth - 1; c >= chStart; c--) {
        chEnd = c;
        if (!isColEmpty(rgba, rowIx, colPixel+c, width, maxCharWidth, maxCharHeight)) {
          break;
        }
      }
      var chWidth = chEnd - chStart + 1;
      if (character == 65) {
        console.log("A rowIx:" + rowIx);
        console.log("A ")
      }
      basicGlyphSizes[character] = [chStart, chWidth];
    }
  }
}

function isColEmpty(imgData, rowIx, col, imageWidth, maxCharWidth, maxCharHeight) {
  var rowBytes = 4 * imageWidth;
  var topLeftPixel = (col * 4) + (rowIx * rowBytes * maxCharHeight);
  for (var row = 0; row < maxCharHeight; row++) {
    var pixel = imgData[topLeftPixel + (rowBytes * row)]
    if (pixel == 255) {
      return false;
    }
  }
  return true;
}
