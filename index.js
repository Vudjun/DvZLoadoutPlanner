"use strict";

var glyphSizes = null;
var basicGlyphSizes = [];
var ccmapping = {
  "0": 0x000000,
  "1": 0x0000AA,
  "2": 0x00AA00,
  "3": 0x00AAAA,
  "4": 0xAA0000,
  "5": 0xAA00AA,
  "6": 0xFFAA00,
  "7": 0xAAAAAA,
  "8": 0x555555,
  "9": 0x5555FF,
  "a": 0x55FF55,
  "b": 0x55FFFF,
  "c": 0xFF5555,
  "d": 0xFF55FF,
  "e": 0xFFFF55,
  "f": 0xFFFFFF,
  "_": 0x404040
};

var tex = {};
var defaultVersion = "V6";
var defaultName = "Click here to name kit";

var availableVersions = [
  ["V1", "Doom Update", false],
  ["V2", "Future Preview (from Doom Update)", false],
  ["V3", "Nismas Update", false],
  ["V4", "Future Preview", false],
  ["V5", "Cleric Update", false],
  ["V6", "Hero Update", true]
];

function toTex(texName, expectedHeight) {
  if (texName == "") texName = "placeholder";
  if (tex[texName] != null) return tex[texName];
  var t = PIXI.Texture.fromImage("resource/" + texName + ".png");
  tex[texName] = t;
  if (expectedHeight != null) {
    t.baseTexture.on("loaded", function() {
      if (expectedHeight < t.baseTexture.realHeight) {
        t.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      }
    });
  }
  return t;
}

function getBasicGlyphSizing(charCode) {
  return basicGlyphSizes[charCode];
}

function getGlyphSizing(charCode) {
  var byte = glyphSizes[charCode];
  var left = (byte & 0xf0) >> 4;
  var right = byte & 0x0f;
  return [left, right - left + 1];
}

function makeText(text, maxWidth, textScale) {
  var currentTint = 0x000000;
  var baseTex = toTex("ascii");
  var container = new PIXI.Container();
  container.scale.x = textScale;
  container.scale.y = textScale;
  var charPos = 0;
  var charPosY = 0;
  var switchingColor = false;
  var firstLetter = true;
  for (var charNum = 0; charNum < text.length; charNum++) {
    var charCode = text.charCodeAt(charNum);
    if (charCode == 10) {
      charPos = 0;
      charPosY += 10;
      firstLetter = false;
      continue;
    }
    if (charCode == 167) {
      switchingColor = true;
      continue;
    }
    var valid = (charCode >= 32 && charCode < 127);
    if (switchingColor) {
      switchingColor = false;
      var newTint = ccmapping[String.fromCharCode(charCode)];
      if (newTint != null) {
        currentTint = newTint;
        continue;
      }
    }
    if (!valid) {
      charCode = 95;
    }
    if (charCode == 32) {
      firstLetter = true;
    } else if (firstLetter) {
      var seekCharNum = charNum;
    }
    var letterTex = tex["ascii_" + charCode];
    var sizing = getBasicGlyphSizing(charCode);
    var width = sizing[1];
    var squareSize = 8;
    if (letterTex == null) {
      var xIndex = charCode % 16;
      var yIndex = Math.floor(charCode / 16);
      letterTex = new PIXI.Texture(baseTex, new PIXI.Rectangle(xIndex * squareSize + sizing[0], yIndex * squareSize, width, squareSize));
      tex["ascii_" + charCode] = letterTex;
    }
    var letterSprite = new PIXI.Sprite(letterTex);
    var nextCharPos = charPos + width;
    if (maxWidth != 0 && nextCharPos > maxWidth) {
      charPos = 0;
      charPosY += 10;
      nextCharPos = charPos + width;
    }
    letterSprite.x = charPos;
    letterSprite.y = charPosY;
    charPos = nextCharPos + 1;
    letterSprite.tint = currentTint;
    container.addChild(letterSprite);
  }
  return container;
}

function log(text) {
  console.log(text);
}

function fetchJson(path) {
  log("Fetching " + path)
  return fetch(path).then(
    function(response) {
      if (response.status !== 200) {
        throw new Error('Unacceptable status code: ' + response.status);
      }
      return response.json().then(function(data) {
        return data;
      });
    }
  )
}

function fetchBin(path) {
  log("Fetching " + path)
  return fetch(path).then(
    function(response) {
      if (response.status !== 200) {
        throw new Error('Unacceptable status code: ' + response.status);
      }
      return response.arrayBuffer().then(function(data) {
        return new Uint8Array(data);
      });
    }
  )
}

function formatGold(number) {
  if (number == -1) {
    return "(unknown)";
  }
  var s = Math.floor(number).toString();
  s = s.replace(/./g, function(c, i, a) {
    return i && c !== "." && ((a.length - i) % 3 === 0) ? ',' + c : c;
  });

  return s;
}

function Kit(planner) {
  this.planner = planner;
  this.loadout = [];
  this.name = "Unnamed Kit";
  this.slotcost = 0;
}

Kit.prototype.setName = function(newName) {
  this.name = newName;
}

Kit.prototype.getPointCost = function() {
  var cost = 0;
  for (var i = 0; i < this.slotcost; i++) {
    var itemname = this.loadout[i];
    cost += this.planner.items[itemname].pointcost;
  }
  return cost;
}

Kit.prototype.getGoldCost = function() {
  var cost = 0;
  for (var i = 0; i < this.slotcost; i++) {
    var itemname = this.loadout[i];
    var gc = this.planner.items[itemname].goldcost;
    if (gc == -1) return -1;
    cost += gc;
  }
  return cost;
}

Kit.prototype.addItem = function(itemName) {
  if (this.slotcost == 9 && this.planner.strictMode) {
    return false;
  }
  var itemDetails = this.planner.items[itemName];
  var insertPoint = -1;
  var order = itemDetails.order;
  for (var i = 0; i < this.slotcost; i++) {
    var cDetails = this.planner.items[this.loadout[i]];
    if (cDetails.order > order) {
      insertPoint = i;
      break;
    }
  }
  if (insertPoint != -1) {
    this.loadout.splice(insertPoint, 0, itemName);
    this.slotcost += 1;
  } else {
    this.loadout[this.slotcost++] = itemName;
  }
}

Kit.prototype.clear = function() {
  this.loadout = [];
  this.slotcost = 0;
}

Kit.prototype.removeItem = function(slotNumber) {
  var itemName = this.loadout[slotNumber]
  if (itemName == null) return;
  var itemDetails = this.planner.items[itemName];
  this.loadout.splice(slotNumber, 1);
  this.slotcost--;
}

Kit.prototype.contains = function(itemName) {
  return this.loadout.indexOf(itemName) != -1;
}

function Planner() {
  var w = 176,
    h = 222;
  var self = this;
  this.version = "";
  this.versionText = "";
  this.items = {};
  this.exclusives = [];
  this.width = 1;
  this.height = 1;
  this.animRequested = false;
  this.renderer = new PIXI.CanvasRenderer(w, h);
  this.renderer.backgroundColor = 0xffffff;
  this.element = null;
  this.stage = new PIXI.Container();
  this.invStage = new PIXI.Container();
  this.kitNameContainer = null;
  this.enteringKitName = false;
  this.lastOver = -1;
  this.strictMode = true;
  this.bg = new PIXI.Sprite(toTex("inventory"));
  this.invStage.addChild(this.bg);
  this.halt = true;
  this.kit = new Kit(this);
  this.slots = new Array(90);
  this.hoverText = "";
  this.hoverTextContainer = null;
  this.isTouchInput = false;
  this.uiscale = 1;
  this.rescaleCooldown = false;
  this.needsRescale = false;
  this.touchDownTime = -1;
  this.stage.addChild(this.invStage);
  this.setSlotItem(48, "left", "§bPrevious Page", function() {
    self.pageNo--;
    self.updatePage();
  });
  this.setSlotItem(50, "right", "§bNext Page", function() {
    self.pageNo++;
    self.updatePage();
  });
  this.pageNo = 0;
  this.pages = [];
  this.shopSlots = new Array()
  var mouseMoveCont = new PIXI.Container();
  mouseMoveCont.interactive = true;
  mouseMoveCont.on("mousemove", function(e) {
    self.mouseMove(e.data.global.x, e.data.global.y, false);
  });
  this.invStage.addChild(mouseMoveCont);
  window.addEventListener("keypress", function(key) {
    if (!self.enteringKitName) return;
    var code = key.keyCode;
    if (code == 13) {
      self.enteringKitName = false;
      self.redrawKitName();
      self.updateAddressBar();
      key.preventDefault();
      return;
    }
    if (code < 32 || code >= 127) return false;
    self.kit.name += String.fromCharCode(code);
    self.redrawKitName();
    key.preventDefault();
    return;
  }, false);
  window.addEventListener("keydown", function(key) {
    if (self.enteringKitName && key.keyCode == 8) {
      self.kit.name = self.kit.name.substring(0, self.kit.name.length - 1)
      self.redrawKitName();
      key.preventDefault();
    }
  }, false);
  this.rescale();
  window.addEventListener('resize', function(){
    self.rescale();
  }, true);
}

Planner.prototype.rescale = function() {
    var w = 176,
      h = 222;

    if (this.rescaleCooldown) {
      this.needsRescale = true;
      return;
    }
    this.rescaleCooldown = true;
    var planner = this;
    setTimeout(function() {
      planner.rescaleCooldown = false;
      if (planner.needsRescale) {
        planner.needsRescale = false;
        planner.rescale();
      }
    }, 500);

    var newScale = Math.floor(Math.min((window.innerHeight - 22) / h, (window.innerWidth - 22) / w));
    if (newScale < 1) newScale = 1;
    this.uiscale = newScale;
    this.width = w * newScale;
    this.height = h * newScale;

    this.renderer.resize(this.width, this.height);
    this.invStage.scale.x = newScale;
    this.invStage.scale.y = newScale;
}

Planner.prototype.getSlotFromXY = function(x, y) {
  var slot;
  var topLeftX = 8 * this.uiscale;
  var topLeftY = 18 * this.uiscale;
  var sqSize = 18 * this.uiscale;
  var posXOnGrid = x - topLeftX;
  var posYOnGrid = y - topLeftY;
  if (posYOnGrid > topLeftY+(sqSize*6)) {
    posYOnGrid -= (14 * this.uiscale);
  }
  if (posXOnGrid < 0 || posYOnGrid < 0) {
    slot = -1;
  } else {
    var slotX = Math.floor(posXOnGrid / sqSize);
    var slotY = Math.floor(posYOnGrid / sqSize);
    if (slotX >= 9 || slotY >= 10) {
      slot = -1;
    } else {
      var posXOnSlot = Math.floor((posXOnGrid % sqSize) / this.uiscale);
      var posYOnSlot = Math.floor((posYOnGrid % sqSize) / this.uiscale);
      if (posXOnSlot > 15 || posYOnSlot > 15) {
        slot = -1;
      } else {
        slot = slotX + (slotY * 9);
      }
    }
  }
  return slot;
}

Planner.prototype.mouseMove = function(x, y, isTouchInput) {
  this.mouseX = x;
  this.mouseY = y;
  var over = this.getSlotFromXY(x, y);
  if (over == -1) {
    if (this.hoverTextContainer != null) {
      this.stage.removeChild(this.hoverTextContainer);
      this.hoverTextContainer = null;
      this.lastOver = -1;
    }
  } else {
    if (this.lastOver != over) {
      if (this.hoverTextContainer != null) {
        this.stage.removeChild(this.hoverTextContainer);
      }
      this.hoverTextContainer = new PIXI.Container();
      var slot = this.slots[over];
      if (slot == null) {
        this.lastOver = -1;
        return;
      }
      var hoverText = slot.hoverText;
      if (hoverText == null) {
        this.lastOver = -1;
        return;
      }
      var textScale = Math.floor((2 * this.uiscale) / 3);
      if (textScale < 1) { textScale = 1; }
      if (isTouchInput) {
        textScale = this.uiscale;
      }
      var text = makeText(slot.hoverText, 160, textScale);
      var textBounds = text.getBounds();
      var bg = new PIXI.Graphics();
      bg.beginFill(0x190A19, 0.98);
      bg.drawRect(0, 0, text.width + (8 * textScale), text.height + (8 * textScale));
      bg.endFill();
      text.position.x = 4 * textScale;
      text.position.y = 4 * textScale;
      this.hoverTextContainer.addChild(bg);
      this.hoverTextContainer.addChild(text);
      this.stage.addChild(this.hoverTextContainer);
    }
    if (isTouchInput) {
      x = 999999;
      y = 999999;
    }
    x = (x + 7);
    y = (y - 15);
    if (x + this.hoverTextContainer.width >= this.width) {
      x = this.width - this.hoverTextContainer.width;
    }
    if (y + this.hoverTextContainer.height >= this.height) {
      y = this.height - this.hoverTextContainer.height;
    }
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    this.hoverTextContainer.position.x = x;
    this.hoverTextContainer.position.y = y;
    this.lastOver = over;
  }
}

Planner.prototype.redrawKitName = function() {
  var name = this.kit.name;
  var prefix = "§_";
  if (this.enteringKitName) {
    prefix = "§a"
  }
  var cont = makeText(prefix + name, 0, 1);
  if (this.kitNameContainer != null) {
    this.invStage.removeChild(this.kitNameContainer);
  }
  this.kitNameContainer = cont;
  cont.x = 8;
  cont.y = 6;
  cont.interactive = true;
  var self = this;
  cont.on("click", function() {
    self.enteringKitName = !self.enteringKitName;
    self.kit.name = "";
    self.redrawKitName();
  })
  this.invStage.addChild(cont);
}

Planner.prototype.validateKit = function() {
  if (this.kit.getPointCost() > 64) return false;
  if (this.kit.slotcost > 9) return false;
  var loadout = this.kit.loadout;
  // check for dupes
  for (var i = 0; i < loadout.length; i++) {
    for (var j = 0; j < i; j++) {
      if (loadout[i] == loadout[j]) {
        return false;
      }
    }
  }
  // Check for exclusive items
  for (var i = 0; i < this.exclusives.length; i++) {
    var containsAtLeastOne = false;
    var excList = this.exclusives[i];
    for (var j = 0; j < excList.length; j++) {
      if (this.kit.contains(excList[j])) {
        if (containsAtLeastOne) {
          return false;
        } else {
          containsAtLeastOne = true;
        }
      }
    }
  }
  return true;
}

Planner.prototype.getCannotAddReasons = function(itemName) {
  var reasons = [];
  if (this.kit.contains(itemName)) {
    reasons.push("Already in kit");
    return reasons;
  }
  var pointsLeft = 64 - this.kit.getPointCost();
  var itemPointCost = this.items[itemName].pointcost;
  if (itemPointCost > pointsLeft) {
    reasons.push("Not enough points (uses " + itemPointCost + ")");
  }
  for (var i = 0; i < this.exclusives.length; i++) {
    var excList = this.exclusives[i];
    if (excList.indexOf(itemName) != -1) {
      var conflicts = [];
      for (var j = 0; j < excList.length; j++) {
        var conflictingItem = excList[j];
        if (conflictingItem == itemName) continue;
        if (this.kit.contains(conflictingItem)) {
          conflicts.push(conflictingItem);
        }
      }
      if (conflicts.length > 0) {
        for (var c = 0; c < conflicts.length; c++) {
          reasons.push("Incompatible with " + conflicts[c]);
        }
      }
    }
  }
  if (reasons.length > 0) {
    return reasons;
  } else {
    return null;
  }
}

Planner.prototype.addItemToKit = function(itemName) {
  if (this.getCannotAddReasons(itemName) != null && this.strictMode) return;
  this.kit.addItem(itemName);
  this.updatePage();
}

Planner.prototype.clearUnknownItems = function() {
  for (var i = this.kit.loadout.length - 1; i >= 0; i--) {
    var itemName = this.kit.loadout[i];
    if (this.items[itemName] == null) {
      this.kit.removeItem(i);
    }
  }
}

Planner.prototype.updatePage = function() {
  if (this.pages.length == 0) return;
  if (this.pageNo < 0) {
    this.pageNo = this.pages.length - 1;
  }
  var self = this;
  this.pageNo = this.pageNo % this.pages.length
  var currentPage = this.pages[this.pageNo];
  this.clearShop();
  var pointsLeft = 64 - this.kit.getPointCost();
  for (var rowNum = 0; rowNum < currentPage.length; rowNum++) {
    var row = currentPage[rowNum];
    for (var colNum = 0; colNum < row.length; colNum++) {
      var itemname = row[colNum];
      var slotNum = 18 + (9 * rowNum) + colNum
      var itemData = this.items[itemname];
      var pointText = "§f" + itemData.pointcost;
      if (this.kit.contains(itemname) || this.getCannotAddReasons(itemname) != null) {
        pointText = "§c0"
      }
      var hoverText = "§b" + itemname + "§\n";
      if (this.kit.contains(itemname)) {
        hoverText += "§aIn loadout\n"
      } else {
        var reasons = this.getCannotAddReasons(itemname);
        if (reasons != null) {
          hoverText += "§c";
          for (var i = 0; i < reasons.length; i++) {
            hoverText += reasons[i] + "\n";
          }
        }
        hoverText += "§6" + formatGold(itemData.goldcost) + " §egold\n";
        if (itemData.extra != null) {
          hoverText += "§9" + itemData.extra + "\n";
        }
        var flavorText = itemData.flavor || "flavor text";
        hoverText += "§5" + flavorText;
      }

      (function() {
        var itemnameinner = itemname;
        self.setSlotItem(slotNum, itemData.texture, hoverText, function() {
          self.addItemToKit(itemnameinner);
          self.updatePage();
        }, pointText);
      })();
    }
  }
  this.setSlotItem(73, "wrench", "§bClick to copy a direct link to this kit", function() {
    clipboard.copy(location.href);
  }, null);
  var strictModeIcon = (this.strictMode?"limedye":"reddye");
  var strictModeOnOff = (this.strictMode?"§aON":"§cOFF");
  var canEnable = this.validateKit();
  var strictModeHoverText = "§bStrict Mode: " + strictModeOnOff + "\n";
  if (this.strictMode) {
    strictModeHoverText += "§bClick to disable strict mode, allowing you to make impossible kits.";
  } else {
    if (canEnable) {
      strictModeHoverText += "§bClick to enable strict mode, preventing you from making impossible kits.";
    } else {
      strictModeHoverText += "§bCannot enable strict mode as the current kit is impossible.";
    }
  }
  this.setSlotItem(49, strictModeIcon, strictModeHoverText, function() {
    if (self.strictMode) {
      self.strictMode = false;
    } else {
      if (self.validateKit()) {
        self.strictMode = true;
      }
    }
    self.updatePage();
  }, null);
  var pointText = (pointsLeft > 0 ? "§f" + pointsLeft.toString() : "§c" + pointsLeft.toString());
  var self = this;
  this.setSlotItem(45, "pinkdye", "§b" + this.kit.getPointCost() + "/64 points used\n§d(click to empty loadout)", function() {
    self.kit.clear();
    self.updatePage();
  }, pointText)
  this.setSlotItem(53, "goldbar", "§bTotal Kit Cost\n§6" + formatGold(this.kit.getGoldCost()) + " §egold", null, null)
  this.setSlotItem(72, "nether_star", "§bLoadout Version\n§a" + this.versionText + "\n§d(click to change)", function() {
    self.nextVersion();
  }, null);
  this.updateKitSprites();
  this.updateAddressBar();
  this.redrawKitName();
  this.invStage.interactive = true;
  this.invStage.on("touchstart", function(e) {
    self.touchDownTime = new Date().getTime();
    var x = e.data.global.x;
    var y = e.data.global.y;
    self.mouseMove(x, y, true);
  });
  this.invStage.on("touchmove", function(e) {
    if (self.touchDownTime == -1) return;
    var x = e.data.global.x;
    var y = e.data.global.y;
    self.mouseMove(x, y, true);
  });
  this.invStage.on("touchend", function(e) {
    if (self.touchDownTime == -1) return;
    var timeHeld = (new Date().getTime()) - self.touchDownTime;
    self.touchDownTime = -1;
    if (timeHeld < 500) {
      var x = e.data.global.x;
      var y = e.data.global.y;
      var slotNum = self.getSlotFromXY(x, y);
      var slot = self.slots[slotNum];
      if (slot != null && slot.onClick) {
        slot.onClick();
      }
    }
    self.mouseMove(0, 0, true);
  });
  this.lastOver = -1; // Triggers redraw of mouse over text
  this.mouseMove(this.mouseX, this.mouseY);
}

function escapeRegExp(str) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function replaceAll(str, find, replace) {
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

Planner.prototype.updateAddressBar = function() {
  var data;
  if (this.version == defaultVersion && this.kit.name == defaultName && this.kit.slotcost == 0) {
    data = "#";
  } else if (this.kit.name == defaultName && this.kit.slotcost == 0) {
    data = "#" + encodeURIComponent(this.version);
  } else {
    var nameToWrite = "";
    if (this.kit.name != defaultName) {
      nameToWrite = encodeURIComponent(replaceAll(this.kit.name, " ", "_"))
    }
    data = "#" + encodeURIComponent(this.version) + "/" + nameToWrite;
    for (var i = 0; i < this.kit.slotcost; i++) {
      var itemname = replaceAll(this.kit.loadout[i], " ", "_");
      data += "/" + encodeURIComponent(itemname);
    }
  }
  // location.hash = data; // Fucks up the browser back and forward buttons
  // history.pushState(null, document.title, data);
  history.replaceState(null, document.title, data);
}

Planner.prototype.updateKitSprites = function() {
  for (var i = 0; i < 9; i++) {
    this.setSlotItem(i, null);
  }
  for (var i = 9; i < 18; i++) {
    this.setSlotItem(i, "border", "§f---")
  }
  for (var i = 0; i < this.kit.slotcost; i++) {
    var itemName = this.kit.loadout[i]
    var itemData = this.items[itemName];
    var self = this;
    var hoverText = "§b" + itemName + "\n";
    hoverText += "§a" + itemData.pointcost + " points\n";
    hoverText += "§6" + formatGold(itemData.goldcost) + " §egold\n";
    hoverText += "§d(click to remove)\n";
    if (itemData.extra != null) {
      hoverText += "§9" + itemData.extra + "\n";
    }
    var flavorText = itemData.flavor || "flavor text";
    hoverText += "§5" + flavorText;
    var pointText = "§f" + itemData.pointcost;
    (function() {
      var slotNum = i;

      self.setSlotItem(slotNum, itemData.texture, hoverText, function() {
        self.kit.removeItem(slotNum);
        self.updatePage();
      }, pointText);
    })()
  }
}

Planner.prototype.setVersion = function(setTo) {
  var ix = -1;
  var newVersion = "";
  var verData;
  if (typeof(setTo) == "number") {
    ix = setTo;
    verData = availableVersions[ix];
    newVersion = verData[0];
  } else {
    newVersion = setTo;
    for (var i = 0; i < availableVersions.length; i++) {
      var v = availableVersions[i];
      if (v[0] == newVersion) {
        verData = v;
        ix = i;
        break;
      }
    }
  }
  if (ix == -1) {
    log("Invalid version " + newVersion);
    return;
  }
  var itemURL = "items/items_" + newVersion + ".json";
  if (this.version == newVersion) {
    return Promise.resolve(true);
  }
  this.version = newVersion;
  this.versionText = verData[1];
  var planner = this;
  return fetchJson(itemURL).then(function(data) {
    planner.loadItemJson(data);
    planner.clearUnknownItems();
    planner.updatePage();
  })
}

Planner.prototype.nextVersion = function() {
  var ix;
  for (var i = 0; i < availableVersions.length; i++) {
    var v = availableVersions[i];
    if (v[0] == this.version) {
      ix = i;
      break;
    }
  }
  for (var i = ix + 1; i < ix + availableVersions.length; i++) {
    var newIx = i % availableVersions.length;
    var newVer = availableVersions[newIx];
    if (newVer[2]) {
      ix = newIx;
      break;
    }
  }
  this.setVersion(ix);
}

Planner.prototype.loadItemJson = function(itemJson) {
  var info = itemJson.info;
  var extra = itemJson.extra;
  var extraO = {};
  for (var i = 0; i < extra.length; i++) {
    extraO[extra[i][0]] = extra[i][1];
  }
  this.items = {};
  for (var i = 0; i < info.length; i++) {
    var itemArr = info[i];
    var itemExtra = extraO[itemArr[0]] || null;
    this.items[itemArr[0]] = {
      "texture": itemArr[1],
      "goldcost": itemArr[2],
      "pointcost": itemArr[3],
      "flavor": itemArr[4],
      "extra": itemExtra,
      "order": i
    };
  }
  this.pages = itemJson.pages;
  this.exclusives = itemJson.exclusives;
}

Planner.prototype.insertBody = function() {
  if (this.element != null) {
    this.element.parentNode.removeChild(this.element);
  }
  this.element = document.body.appendChild(this.renderer.view);
}

Planner.prototype.requestAnimate = function() {
  if (this.animRequested) return false;
  this.animRequested = true;
  var self = this;
  var animFn = function() {
    self.renderer.render(self.stage);
    requestAnimationFrame(animFn);
  }
  requestAnimationFrame(animFn);
}

Planner.prototype.stopAnim = function() {
  this.halt = true;
}

Planner.prototype.setSlotImage = function(slotNumber, texname, text) {
  if (texname == null) {
    return;
  }
  var texture = toTex(texname);
  var xSlot = slotNumber % 9;
  var ySlot = Math.floor(slotNumber / 9);
  var xPixel = 8 + (xSlot * 18);
  var yPixel = 18 + (ySlot * 18);
  if (slotNumber >= 54) {
    yPixel += 14;
  }
  var sprite = new PIXI.Sprite(texture);
  var cont = new PIXI.Container();
  cont.addChild(sprite);
  cont.position.x = xPixel;
  cont.position.y = yPixel;
  sprite.height = 16;
  sprite.width = 16;
  if (text != null) {
    var textSprite = makeText(text, 0, 1);
    textSprite.position.x = (16 - (textSprite.width));
    textSprite.position.y = (16 - (textSprite.height));
    cont.addChild(textSprite);
  }
  this.invStage.addChild(cont);
  return cont;
}

Planner.prototype.setSlotItem = function(slotNumber, texname, hoverText, onClick, text) {
  var oldItem = this.slots[slotNumber];
  if (oldItem != null) {
    this.invStage.removeChild(oldItem.container);
    this.slots[slotNumber] = null;
  }
  if (texname == null) return;
  var container = this.setSlotImage(slotNumber, texname, text);
  container.interactive = true;
  if (onClick != null) {
    container.on("click", onClick);
  }
  var planner = this;
  var item = {
    "hoverText": hoverText,
    "onClick": onClick,
    "container": container
  };
  this.slots[slotNumber] = item;
}

Planner.prototype.clearShop = function() {
  for (var i = 18; i < 45; i++) {
    this.setSlotItem(i, null);
  }
}

function decodeHashData() {
  try {
    if (location.hash.length < 2) return null;
    var data = location.hash.substring(1).split("/");
    if (data.length == 0) return null;
    var hashData = {
      "ver": defaultVersion,
      "kitname": defaultName,
      "kitArray": []
    };
    hashData.ver = decodeURIComponent(data[0]);
    if (data.length > 1) {
      var kitName = replaceAll(decodeURIComponent(data[1]), "_", " ");
      if (kitName.length > 0) {
        hashData.kitname = kitName;
      }
      if (data.length > 2) {
        hashData.kitArray = new Array(data.length - 2);
        for (var i = 2; i < data.length; i++) {
          hashData.kitArray[i-2] = replaceAll(decodeURIComponent(data[i]), "_", " ");
        }
      }
    }
    return hashData;
  } catch (e) {
    return null;
  }
}

Planner.prototype.loadHashData = function(hashData) {
  if (hashData == null) return;
  var planner = this;
  var whenLoaded = function() {
    var wasStrict = planner.strictMode;
    planner.strictMode = false;
    planner.kit.setName(hashData.kitname);
    planner.kit.clear();
    for (var i = 0; i < hashData.kitArray.length; i++) {
      var itemName = hashData.kitArray[i];
      if (itemName != null && planner.items[itemName] != null) {
        planner.kit.addItem(hashData.kitArray[i]);
      }
    }
    if (planner.validateKit()) {
      planner.strictMode = wasStrict;
    }
    planner.updatePage();
  }
  if (hashData.ver != this.version) {
    this.setVersion(hashData.ver).then(whenLoaded);
  } else {
    whenLoaded();
  }
}

var loaded = false
window.addEventListener("load", function() {
  if (loaded) return;
  loaded = true;
  PIXI.SCALE_MODES.DEFAULT = PIXI.SCALE_MODES.NEAREST;
  fetchJson("resource/basicglyphsizes.json").then(
    function(bgs) {
      var hashData = decodeHashData();
      var ver = defaultVersion;
      var name = defaultName;
      if (hashData != null) {
        ver = hashData.ver;
        name = hashData.kitname;
      }
      basicGlyphSizes = bgs;
      var planner = new Planner();
      planner.kit.setName(name);
      planner.insertBody();
      planner.requestAnimate();
      planner.setVersion(ver).then(function() {
        if (hashData != null) {
          planner.loadHashData(hashData);
        }
      });
      window.onhashchange = function() {
        planner.loadHashData(decodeHashData());
      }
      window.g_Planner = planner;
    }
  )
}, false)
