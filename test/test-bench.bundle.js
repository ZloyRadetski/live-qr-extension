(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e2) {
      throw mod = 0, e2;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/qrcode/lib/can-promise.js
  var require_can_promise = __commonJS({
    "node_modules/qrcode/lib/can-promise.js"(exports, module) {
      module.exports = function() {
        return typeof Promise === "function" && Promise.prototype && Promise.prototype.then;
      };
    }
  });

  // node_modules/qrcode/lib/core/utils.js
  var require_utils = __commonJS({
    "node_modules/qrcode/lib/core/utils.js"(exports) {
      var toSJISFunction;
      var CODEWORDS_COUNT = [
        0,
        // Not used
        26,
        44,
        70,
        100,
        134,
        172,
        196,
        242,
        292,
        346,
        404,
        466,
        532,
        581,
        655,
        733,
        815,
        901,
        991,
        1085,
        1156,
        1258,
        1364,
        1474,
        1588,
        1706,
        1828,
        1921,
        2051,
        2185,
        2323,
        2465,
        2611,
        2761,
        2876,
        3034,
        3196,
        3362,
        3532,
        3706
      ];
      exports.getSymbolSize = function getSymbolSize(version) {
        if (!version) throw new Error('"version" cannot be null or undefined');
        if (version < 1 || version > 40) throw new Error('"version" should be in range from 1 to 40');
        return version * 4 + 17;
      };
      exports.getSymbolTotalCodewords = function getSymbolTotalCodewords(version) {
        return CODEWORDS_COUNT[version];
      };
      exports.getBCHDigit = function(data) {
        let digit = 0;
        while (data !== 0) {
          digit++;
          data >>>= 1;
        }
        return digit;
      };
      exports.setToSJISFunction = function setToSJISFunction(f2) {
        if (typeof f2 !== "function") {
          throw new Error('"toSJISFunc" is not a valid function.');
        }
        toSJISFunction = f2;
      };
      exports.isKanjiModeEnabled = function() {
        return typeof toSJISFunction !== "undefined";
      };
      exports.toSJIS = function toSJIS(kanji) {
        return toSJISFunction(kanji);
      };
    }
  });

  // node_modules/qrcode/lib/core/error-correction-level.js
  var require_error_correction_level = __commonJS({
    "node_modules/qrcode/lib/core/error-correction-level.js"(exports) {
      exports.L = { bit: 1 };
      exports.M = { bit: 0 };
      exports.Q = { bit: 3 };
      exports.H = { bit: 2 };
      function fromString(string) {
        if (typeof string !== "string") {
          throw new Error("Param is not a string");
        }
        const lcStr = string.toLowerCase();
        switch (lcStr) {
          case "l":
          case "low":
            return exports.L;
          case "m":
          case "medium":
            return exports.M;
          case "q":
          case "quartile":
            return exports.Q;
          case "h":
          case "high":
            return exports.H;
          default:
            throw new Error("Unknown EC Level: " + string);
        }
      }
      exports.isValid = function isValid(level) {
        return level && typeof level.bit !== "undefined" && level.bit >= 0 && level.bit < 4;
      };
      exports.from = function from(value, defaultValue) {
        if (exports.isValid(value)) {
          return value;
        }
        try {
          return fromString(value);
        } catch (e2) {
          return defaultValue;
        }
      };
    }
  });

  // node_modules/qrcode/lib/core/bit-buffer.js
  var require_bit_buffer = __commonJS({
    "node_modules/qrcode/lib/core/bit-buffer.js"(exports, module) {
      function BitBuffer() {
        this.buffer = [];
        this.length = 0;
      }
      BitBuffer.prototype = {
        get: function(index) {
          const bufIndex = Math.floor(index / 8);
          return (this.buffer[bufIndex] >>> 7 - index % 8 & 1) === 1;
        },
        put: function(num, length) {
          for (let i2 = 0; i2 < length; i2++) {
            this.putBit((num >>> length - i2 - 1 & 1) === 1);
          }
        },
        getLengthInBits: function() {
          return this.length;
        },
        putBit: function(bit) {
          const bufIndex = Math.floor(this.length / 8);
          if (this.buffer.length <= bufIndex) {
            this.buffer.push(0);
          }
          if (bit) {
            this.buffer[bufIndex] |= 128 >>> this.length % 8;
          }
          this.length++;
        }
      };
      module.exports = BitBuffer;
    }
  });

  // node_modules/qrcode/lib/core/bit-matrix.js
  var require_bit_matrix = __commonJS({
    "node_modules/qrcode/lib/core/bit-matrix.js"(exports, module) {
      function BitMatrix(size) {
        if (!size || size < 1) {
          throw new Error("BitMatrix size must be defined and greater than 0");
        }
        this.size = size;
        this.data = new Uint8Array(size * size);
        this.reservedBit = new Uint8Array(size * size);
      }
      BitMatrix.prototype.set = function(row, col, value, reserved) {
        const index = row * this.size + col;
        this.data[index] = value;
        if (reserved) this.reservedBit[index] = true;
      };
      BitMatrix.prototype.get = function(row, col) {
        return this.data[row * this.size + col];
      };
      BitMatrix.prototype.xor = function(row, col, value) {
        this.data[row * this.size + col] ^= value;
      };
      BitMatrix.prototype.isReserved = function(row, col) {
        return this.reservedBit[row * this.size + col];
      };
      module.exports = BitMatrix;
    }
  });

  // node_modules/qrcode/lib/core/alignment-pattern.js
  var require_alignment_pattern = __commonJS({
    "node_modules/qrcode/lib/core/alignment-pattern.js"(exports) {
      var getSymbolSize = require_utils().getSymbolSize;
      exports.getRowColCoords = function getRowColCoords(version) {
        if (version === 1) return [];
        const posCount = Math.floor(version / 7) + 2;
        const size = getSymbolSize(version);
        const intervals = size === 145 ? 26 : Math.ceil((size - 13) / (2 * posCount - 2)) * 2;
        const positions = [size - 7];
        for (let i2 = 1; i2 < posCount - 1; i2++) {
          positions[i2] = positions[i2 - 1] - intervals;
        }
        positions.push(6);
        return positions.reverse();
      };
      exports.getPositions = function getPositions(version) {
        const coords = [];
        const pos = exports.getRowColCoords(version);
        const posLength = pos.length;
        for (let i2 = 0; i2 < posLength; i2++) {
          for (let j2 = 0; j2 < posLength; j2++) {
            if (i2 === 0 && j2 === 0 || // top-left
            i2 === 0 && j2 === posLength - 1 || // bottom-left
            i2 === posLength - 1 && j2 === 0) {
              continue;
            }
            coords.push([pos[i2], pos[j2]]);
          }
        }
        return coords;
      };
    }
  });

  // node_modules/qrcode/lib/core/finder-pattern.js
  var require_finder_pattern = __commonJS({
    "node_modules/qrcode/lib/core/finder-pattern.js"(exports) {
      var getSymbolSize = require_utils().getSymbolSize;
      var FINDER_PATTERN_SIZE = 7;
      exports.getPositions = function getPositions(version) {
        const size = getSymbolSize(version);
        return [
          // top-left
          [0, 0],
          // top-right
          [size - FINDER_PATTERN_SIZE, 0],
          // bottom-left
          [0, size - FINDER_PATTERN_SIZE]
        ];
      };
    }
  });

  // node_modules/qrcode/lib/core/mask-pattern.js
  var require_mask_pattern = __commonJS({
    "node_modules/qrcode/lib/core/mask-pattern.js"(exports) {
      exports.Patterns = {
        PATTERN000: 0,
        PATTERN001: 1,
        PATTERN010: 2,
        PATTERN011: 3,
        PATTERN100: 4,
        PATTERN101: 5,
        PATTERN110: 6,
        PATTERN111: 7
      };
      var PenaltyScores = {
        N1: 3,
        N2: 3,
        N3: 40,
        N4: 10
      };
      exports.isValid = function isValid(mask) {
        return mask != null && mask !== "" && !isNaN(mask) && mask >= 0 && mask <= 7;
      };
      exports.from = function from(value) {
        return exports.isValid(value) ? parseInt(value, 10) : void 0;
      };
      exports.getPenaltyN1 = function getPenaltyN1(data) {
        const size = data.size;
        let points = 0;
        let sameCountCol = 0;
        let sameCountRow = 0;
        let lastCol = null;
        let lastRow = null;
        for (let row = 0; row < size; row++) {
          sameCountCol = sameCountRow = 0;
          lastCol = lastRow = null;
          for (let col = 0; col < size; col++) {
            let module2 = data.get(row, col);
            if (module2 === lastCol) {
              sameCountCol++;
            } else {
              if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
              lastCol = module2;
              sameCountCol = 1;
            }
            module2 = data.get(col, row);
            if (module2 === lastRow) {
              sameCountRow++;
            } else {
              if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
              lastRow = module2;
              sameCountRow = 1;
            }
          }
          if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
          if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
        }
        return points;
      };
      exports.getPenaltyN2 = function getPenaltyN2(data) {
        const size = data.size;
        let points = 0;
        for (let row = 0; row < size - 1; row++) {
          for (let col = 0; col < size - 1; col++) {
            const last = data.get(row, col) + data.get(row, col + 1) + data.get(row + 1, col) + data.get(row + 1, col + 1);
            if (last === 4 || last === 0) points++;
          }
        }
        return points * PenaltyScores.N2;
      };
      exports.getPenaltyN3 = function getPenaltyN3(data) {
        const size = data.size;
        let points = 0;
        let bitsCol = 0;
        let bitsRow = 0;
        for (let row = 0; row < size; row++) {
          bitsCol = bitsRow = 0;
          for (let col = 0; col < size; col++) {
            bitsCol = bitsCol << 1 & 2047 | data.get(row, col);
            if (col >= 10 && (bitsCol === 1488 || bitsCol === 93)) points++;
            bitsRow = bitsRow << 1 & 2047 | data.get(col, row);
            if (col >= 10 && (bitsRow === 1488 || bitsRow === 93)) points++;
          }
        }
        return points * PenaltyScores.N3;
      };
      exports.getPenaltyN4 = function getPenaltyN4(data) {
        let darkCount = 0;
        const modulesCount = data.data.length;
        for (let i2 = 0; i2 < modulesCount; i2++) darkCount += data.data[i2];
        const k2 = Math.abs(Math.ceil(darkCount * 100 / modulesCount / 5) - 10);
        return k2 * PenaltyScores.N4;
      };
      function getMaskAt(maskPattern, i2, j2) {
        switch (maskPattern) {
          case exports.Patterns.PATTERN000:
            return (i2 + j2) % 2 === 0;
          case exports.Patterns.PATTERN001:
            return i2 % 2 === 0;
          case exports.Patterns.PATTERN010:
            return j2 % 3 === 0;
          case exports.Patterns.PATTERN011:
            return (i2 + j2) % 3 === 0;
          case exports.Patterns.PATTERN100:
            return (Math.floor(i2 / 2) + Math.floor(j2 / 3)) % 2 === 0;
          case exports.Patterns.PATTERN101:
            return i2 * j2 % 2 + i2 * j2 % 3 === 0;
          case exports.Patterns.PATTERN110:
            return (i2 * j2 % 2 + i2 * j2 % 3) % 2 === 0;
          case exports.Patterns.PATTERN111:
            return (i2 * j2 % 3 + (i2 + j2) % 2) % 2 === 0;
          default:
            throw new Error("bad maskPattern:" + maskPattern);
        }
      }
      exports.applyMask = function applyMask(pattern, data) {
        const size = data.size;
        for (let col = 0; col < size; col++) {
          for (let row = 0; row < size; row++) {
            if (data.isReserved(row, col)) continue;
            data.xor(row, col, getMaskAt(pattern, row, col));
          }
        }
      };
      exports.getBestMask = function getBestMask(data, setupFormatFunc) {
        const numPatterns = Object.keys(exports.Patterns).length;
        let bestPattern = 0;
        let lowerPenalty = Infinity;
        for (let p2 = 0; p2 < numPatterns; p2++) {
          setupFormatFunc(p2);
          exports.applyMask(p2, data);
          const penalty = exports.getPenaltyN1(data) + exports.getPenaltyN2(data) + exports.getPenaltyN3(data) + exports.getPenaltyN4(data);
          exports.applyMask(p2, data);
          if (penalty < lowerPenalty) {
            lowerPenalty = penalty;
            bestPattern = p2;
          }
        }
        return bestPattern;
      };
    }
  });

  // node_modules/qrcode/lib/core/error-correction-code.js
  var require_error_correction_code = __commonJS({
    "node_modules/qrcode/lib/core/error-correction-code.js"(exports) {
      var ECLevel = require_error_correction_level();
      var EC_BLOCKS_TABLE = [
        // L  M  Q  H
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        2,
        2,
        1,
        2,
        2,
        4,
        1,
        2,
        4,
        4,
        2,
        4,
        4,
        4,
        2,
        4,
        6,
        5,
        2,
        4,
        6,
        6,
        2,
        5,
        8,
        8,
        4,
        5,
        8,
        8,
        4,
        5,
        8,
        11,
        4,
        8,
        10,
        11,
        4,
        9,
        12,
        16,
        4,
        9,
        16,
        16,
        6,
        10,
        12,
        18,
        6,
        10,
        17,
        16,
        6,
        11,
        16,
        19,
        6,
        13,
        18,
        21,
        7,
        14,
        21,
        25,
        8,
        16,
        20,
        25,
        8,
        17,
        23,
        25,
        9,
        17,
        23,
        34,
        9,
        18,
        25,
        30,
        10,
        20,
        27,
        32,
        12,
        21,
        29,
        35,
        12,
        23,
        34,
        37,
        12,
        25,
        34,
        40,
        13,
        26,
        35,
        42,
        14,
        28,
        38,
        45,
        15,
        29,
        40,
        48,
        16,
        31,
        43,
        51,
        17,
        33,
        45,
        54,
        18,
        35,
        48,
        57,
        19,
        37,
        51,
        60,
        19,
        38,
        53,
        63,
        20,
        40,
        56,
        66,
        21,
        43,
        59,
        70,
        22,
        45,
        62,
        74,
        24,
        47,
        65,
        77,
        25,
        49,
        68,
        81
      ];
      var EC_CODEWORDS_TABLE = [
        // L  M  Q  H
        7,
        10,
        13,
        17,
        10,
        16,
        22,
        28,
        15,
        26,
        36,
        44,
        20,
        36,
        52,
        64,
        26,
        48,
        72,
        88,
        36,
        64,
        96,
        112,
        40,
        72,
        108,
        130,
        48,
        88,
        132,
        156,
        60,
        110,
        160,
        192,
        72,
        130,
        192,
        224,
        80,
        150,
        224,
        264,
        96,
        176,
        260,
        308,
        104,
        198,
        288,
        352,
        120,
        216,
        320,
        384,
        132,
        240,
        360,
        432,
        144,
        280,
        408,
        480,
        168,
        308,
        448,
        532,
        180,
        338,
        504,
        588,
        196,
        364,
        546,
        650,
        224,
        416,
        600,
        700,
        224,
        442,
        644,
        750,
        252,
        476,
        690,
        816,
        270,
        504,
        750,
        900,
        300,
        560,
        810,
        960,
        312,
        588,
        870,
        1050,
        336,
        644,
        952,
        1110,
        360,
        700,
        1020,
        1200,
        390,
        728,
        1050,
        1260,
        420,
        784,
        1140,
        1350,
        450,
        812,
        1200,
        1440,
        480,
        868,
        1290,
        1530,
        510,
        924,
        1350,
        1620,
        540,
        980,
        1440,
        1710,
        570,
        1036,
        1530,
        1800,
        570,
        1064,
        1590,
        1890,
        600,
        1120,
        1680,
        1980,
        630,
        1204,
        1770,
        2100,
        660,
        1260,
        1860,
        2220,
        720,
        1316,
        1950,
        2310,
        750,
        1372,
        2040,
        2430
      ];
      exports.getBlocksCount = function getBlocksCount(version, errorCorrectionLevel) {
        switch (errorCorrectionLevel) {
          case ECLevel.L:
            return EC_BLOCKS_TABLE[(version - 1) * 4 + 0];
          case ECLevel.M:
            return EC_BLOCKS_TABLE[(version - 1) * 4 + 1];
          case ECLevel.Q:
            return EC_BLOCKS_TABLE[(version - 1) * 4 + 2];
          case ECLevel.H:
            return EC_BLOCKS_TABLE[(version - 1) * 4 + 3];
          default:
            return void 0;
        }
      };
      exports.getTotalCodewordsCount = function getTotalCodewordsCount(version, errorCorrectionLevel) {
        switch (errorCorrectionLevel) {
          case ECLevel.L:
            return EC_CODEWORDS_TABLE[(version - 1) * 4 + 0];
          case ECLevel.M:
            return EC_CODEWORDS_TABLE[(version - 1) * 4 + 1];
          case ECLevel.Q:
            return EC_CODEWORDS_TABLE[(version - 1) * 4 + 2];
          case ECLevel.H:
            return EC_CODEWORDS_TABLE[(version - 1) * 4 + 3];
          default:
            return void 0;
        }
      };
    }
  });

  // node_modules/qrcode/lib/core/galois-field.js
  var require_galois_field = __commonJS({
    "node_modules/qrcode/lib/core/galois-field.js"(exports) {
      var EXP_TABLE = new Uint8Array(512);
      var LOG_TABLE = new Uint8Array(256);
      (function initTables() {
        let x2 = 1;
        for (let i2 = 0; i2 < 255; i2++) {
          EXP_TABLE[i2] = x2;
          LOG_TABLE[x2] = i2;
          x2 <<= 1;
          if (x2 & 256) {
            x2 ^= 285;
          }
        }
        for (let i2 = 255; i2 < 512; i2++) {
          EXP_TABLE[i2] = EXP_TABLE[i2 - 255];
        }
      })();
      exports.log = function log(n2) {
        if (n2 < 1) throw new Error("log(" + n2 + ")");
        return LOG_TABLE[n2];
      };
      exports.exp = function exp(n2) {
        return EXP_TABLE[n2];
      };
      exports.mul = function mul(x2, y2) {
        if (x2 === 0 || y2 === 0) return 0;
        return EXP_TABLE[LOG_TABLE[x2] + LOG_TABLE[y2]];
      };
    }
  });

  // node_modules/qrcode/lib/core/polynomial.js
  var require_polynomial = __commonJS({
    "node_modules/qrcode/lib/core/polynomial.js"(exports) {
      var GF = require_galois_field();
      exports.mul = function mul(p1, p2) {
        const coeff = new Uint8Array(p1.length + p2.length - 1);
        for (let i2 = 0; i2 < p1.length; i2++) {
          for (let j2 = 0; j2 < p2.length; j2++) {
            coeff[i2 + j2] ^= GF.mul(p1[i2], p2[j2]);
          }
        }
        return coeff;
      };
      exports.mod = function mod(divident, divisor) {
        let result = new Uint8Array(divident);
        while (result.length - divisor.length >= 0) {
          const coeff = result[0];
          for (let i2 = 0; i2 < divisor.length; i2++) {
            result[i2] ^= GF.mul(divisor[i2], coeff);
          }
          let offset = 0;
          while (offset < result.length && result[offset] === 0) offset++;
          result = result.slice(offset);
        }
        return result;
      };
      exports.generateECPolynomial = function generateECPolynomial(degree) {
        let poly = new Uint8Array([1]);
        for (let i2 = 0; i2 < degree; i2++) {
          poly = exports.mul(poly, new Uint8Array([1, GF.exp(i2)]));
        }
        return poly;
      };
    }
  });

  // node_modules/qrcode/lib/core/reed-solomon-encoder.js
  var require_reed_solomon_encoder = __commonJS({
    "node_modules/qrcode/lib/core/reed-solomon-encoder.js"(exports, module) {
      var Polynomial = require_polynomial();
      function ReedSolomonEncoder(degree) {
        this.genPoly = void 0;
        this.degree = degree;
        if (this.degree) this.initialize(this.degree);
      }
      ReedSolomonEncoder.prototype.initialize = function initialize(degree) {
        this.degree = degree;
        this.genPoly = Polynomial.generateECPolynomial(this.degree);
      };
      ReedSolomonEncoder.prototype.encode = function encode(data) {
        if (!this.genPoly) {
          throw new Error("Encoder not initialized");
        }
        const paddedData = new Uint8Array(data.length + this.degree);
        paddedData.set(data);
        const remainder = Polynomial.mod(paddedData, this.genPoly);
        const start = this.degree - remainder.length;
        if (start > 0) {
          const buff = new Uint8Array(this.degree);
          buff.set(remainder, start);
          return buff;
        }
        return remainder;
      };
      module.exports = ReedSolomonEncoder;
    }
  });

  // node_modules/qrcode/lib/core/version-check.js
  var require_version_check = __commonJS({
    "node_modules/qrcode/lib/core/version-check.js"(exports) {
      exports.isValid = function isValid(version) {
        return !isNaN(version) && version >= 1 && version <= 40;
      };
    }
  });

  // node_modules/qrcode/lib/core/regex.js
  var require_regex = __commonJS({
    "node_modules/qrcode/lib/core/regex.js"(exports) {
      var numeric = "[0-9]+";
      var alphanumeric = "[A-Z $%*+\\-./:]+";
      var kanji = "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
      kanji = kanji.replace(/u/g, "\\u");
      var byte = "(?:(?![A-Z0-9 $%*+\\-./:]|" + kanji + ")(?:.|[\r\n]))+";
      exports.KANJI = new RegExp(kanji, "g");
      exports.BYTE_KANJI = new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g");
      exports.BYTE = new RegExp(byte, "g");
      exports.NUMERIC = new RegExp(numeric, "g");
      exports.ALPHANUMERIC = new RegExp(alphanumeric, "g");
      var TEST_KANJI = new RegExp("^" + kanji + "$");
      var TEST_NUMERIC = new RegExp("^" + numeric + "$");
      var TEST_ALPHANUMERIC = new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
      exports.testKanji = function testKanji(str) {
        return TEST_KANJI.test(str);
      };
      exports.testNumeric = function testNumeric(str) {
        return TEST_NUMERIC.test(str);
      };
      exports.testAlphanumeric = function testAlphanumeric(str) {
        return TEST_ALPHANUMERIC.test(str);
      };
    }
  });

  // node_modules/qrcode/lib/core/mode.js
  var require_mode = __commonJS({
    "node_modules/qrcode/lib/core/mode.js"(exports) {
      var VersionCheck = require_version_check();
      var Regex = require_regex();
      exports.NUMERIC = {
        id: "Numeric",
        bit: 1 << 0,
        ccBits: [10, 12, 14]
      };
      exports.ALPHANUMERIC = {
        id: "Alphanumeric",
        bit: 1 << 1,
        ccBits: [9, 11, 13]
      };
      exports.BYTE = {
        id: "Byte",
        bit: 1 << 2,
        ccBits: [8, 16, 16]
      };
      exports.KANJI = {
        id: "Kanji",
        bit: 1 << 3,
        ccBits: [8, 10, 12]
      };
      exports.MIXED = {
        bit: -1
      };
      exports.getCharCountIndicator = function getCharCountIndicator(mode, version) {
        if (!mode.ccBits) throw new Error("Invalid mode: " + mode);
        if (!VersionCheck.isValid(version)) {
          throw new Error("Invalid version: " + version);
        }
        if (version >= 1 && version < 10) return mode.ccBits[0];
        else if (version < 27) return mode.ccBits[1];
        return mode.ccBits[2];
      };
      exports.getBestModeForData = function getBestModeForData(dataStr) {
        if (Regex.testNumeric(dataStr)) return exports.NUMERIC;
        else if (Regex.testAlphanumeric(dataStr)) return exports.ALPHANUMERIC;
        else if (Regex.testKanji(dataStr)) return exports.KANJI;
        else return exports.BYTE;
      };
      exports.toString = function toString(mode) {
        if (mode && mode.id) return mode.id;
        throw new Error("Invalid mode");
      };
      exports.isValid = function isValid(mode) {
        return mode && mode.bit && mode.ccBits;
      };
      function fromString(string) {
        if (typeof string !== "string") {
          throw new Error("Param is not a string");
        }
        const lcStr = string.toLowerCase();
        switch (lcStr) {
          case "numeric":
            return exports.NUMERIC;
          case "alphanumeric":
            return exports.ALPHANUMERIC;
          case "kanji":
            return exports.KANJI;
          case "byte":
            return exports.BYTE;
          default:
            throw new Error("Unknown mode: " + string);
        }
      }
      exports.from = function from(value, defaultValue) {
        if (exports.isValid(value)) {
          return value;
        }
        try {
          return fromString(value);
        } catch (e2) {
          return defaultValue;
        }
      };
    }
  });

  // node_modules/qrcode/lib/core/version.js
  var require_version = __commonJS({
    "node_modules/qrcode/lib/core/version.js"(exports) {
      var Utils = require_utils();
      var ECCode = require_error_correction_code();
      var ECLevel = require_error_correction_level();
      var Mode = require_mode();
      var VersionCheck = require_version_check();
      var G18 = 1 << 12 | 1 << 11 | 1 << 10 | 1 << 9 | 1 << 8 | 1 << 5 | 1 << 2 | 1 << 0;
      var G18_BCH = Utils.getBCHDigit(G18);
      function getBestVersionForDataLength(mode, length, errorCorrectionLevel) {
        for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
          if (length <= exports.getCapacity(currentVersion, errorCorrectionLevel, mode)) {
            return currentVersion;
          }
        }
        return void 0;
      }
      function getReservedBitsCount(mode, version) {
        return Mode.getCharCountIndicator(mode, version) + 4;
      }
      function getTotalBitsFromDataArray(segments, version) {
        let totalBits = 0;
        segments.forEach(function(data) {
          const reservedBits = getReservedBitsCount(data.mode, version);
          totalBits += reservedBits + data.getBitsLength();
        });
        return totalBits;
      }
      function getBestVersionForMixedData(segments, errorCorrectionLevel) {
        for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
          const length = getTotalBitsFromDataArray(segments, currentVersion);
          if (length <= exports.getCapacity(currentVersion, errorCorrectionLevel, Mode.MIXED)) {
            return currentVersion;
          }
        }
        return void 0;
      }
      exports.from = function from(value, defaultValue) {
        if (VersionCheck.isValid(value)) {
          return parseInt(value, 10);
        }
        return defaultValue;
      };
      exports.getCapacity = function getCapacity(version, errorCorrectionLevel, mode) {
        if (!VersionCheck.isValid(version)) {
          throw new Error("Invalid QR Code version");
        }
        if (typeof mode === "undefined") mode = Mode.BYTE;
        const totalCodewords = Utils.getSymbolTotalCodewords(version);
        const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
        const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;
        if (mode === Mode.MIXED) return dataTotalCodewordsBits;
        const usableBits = dataTotalCodewordsBits - getReservedBitsCount(mode, version);
        switch (mode) {
          case Mode.NUMERIC:
            return Math.floor(usableBits / 10 * 3);
          case Mode.ALPHANUMERIC:
            return Math.floor(usableBits / 11 * 2);
          case Mode.KANJI:
            return Math.floor(usableBits / 13);
          case Mode.BYTE:
          default:
            return Math.floor(usableBits / 8);
        }
      };
      exports.getBestVersionForData = function getBestVersionForData(data, errorCorrectionLevel) {
        let seg;
        const ecl = ECLevel.from(errorCorrectionLevel, ECLevel.M);
        if (Array.isArray(data)) {
          if (data.length > 1) {
            return getBestVersionForMixedData(data, ecl);
          }
          if (data.length === 0) {
            return 1;
          }
          seg = data[0];
        } else {
          seg = data;
        }
        return getBestVersionForDataLength(seg.mode, seg.getLength(), ecl);
      };
      exports.getEncodedBits = function getEncodedBits(version) {
        if (!VersionCheck.isValid(version) || version < 7) {
          throw new Error("Invalid QR Code version");
        }
        let d2 = version << 12;
        while (Utils.getBCHDigit(d2) - G18_BCH >= 0) {
          d2 ^= G18 << Utils.getBCHDigit(d2) - G18_BCH;
        }
        return version << 12 | d2;
      };
    }
  });

  // node_modules/qrcode/lib/core/format-info.js
  var require_format_info = __commonJS({
    "node_modules/qrcode/lib/core/format-info.js"(exports) {
      var Utils = require_utils();
      var G15 = 1 << 10 | 1 << 8 | 1 << 5 | 1 << 4 | 1 << 2 | 1 << 1 | 1 << 0;
      var G15_MASK = 1 << 14 | 1 << 12 | 1 << 10 | 1 << 4 | 1 << 1;
      var G15_BCH = Utils.getBCHDigit(G15);
      exports.getEncodedBits = function getEncodedBits(errorCorrectionLevel, mask) {
        const data = errorCorrectionLevel.bit << 3 | mask;
        let d2 = data << 10;
        while (Utils.getBCHDigit(d2) - G15_BCH >= 0) {
          d2 ^= G15 << Utils.getBCHDigit(d2) - G15_BCH;
        }
        return (data << 10 | d2) ^ G15_MASK;
      };
    }
  });

  // node_modules/qrcode/lib/core/numeric-data.js
  var require_numeric_data = __commonJS({
    "node_modules/qrcode/lib/core/numeric-data.js"(exports, module) {
      var Mode = require_mode();
      function NumericData(data) {
        this.mode = Mode.NUMERIC;
        this.data = data.toString();
      }
      NumericData.getBitsLength = function getBitsLength(length) {
        return 10 * Math.floor(length / 3) + (length % 3 ? length % 3 * 3 + 1 : 0);
      };
      NumericData.prototype.getLength = function getLength() {
        return this.data.length;
      };
      NumericData.prototype.getBitsLength = function getBitsLength() {
        return NumericData.getBitsLength(this.data.length);
      };
      NumericData.prototype.write = function write(bitBuffer) {
        let i2, group, value;
        for (i2 = 0; i2 + 3 <= this.data.length; i2 += 3) {
          group = this.data.substr(i2, 3);
          value = parseInt(group, 10);
          bitBuffer.put(value, 10);
        }
        const remainingNum = this.data.length - i2;
        if (remainingNum > 0) {
          group = this.data.substr(i2);
          value = parseInt(group, 10);
          bitBuffer.put(value, remainingNum * 3 + 1);
        }
      };
      module.exports = NumericData;
    }
  });

  // node_modules/qrcode/lib/core/alphanumeric-data.js
  var require_alphanumeric_data = __commonJS({
    "node_modules/qrcode/lib/core/alphanumeric-data.js"(exports, module) {
      var Mode = require_mode();
      var ALPHA_NUM_CHARS = [
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "I",
        "J",
        "K",
        "L",
        "M",
        "N",
        "O",
        "P",
        "Q",
        "R",
        "S",
        "T",
        "U",
        "V",
        "W",
        "X",
        "Y",
        "Z",
        " ",
        "$",
        "%",
        "*",
        "+",
        "-",
        ".",
        "/",
        ":"
      ];
      function AlphanumericData(data) {
        this.mode = Mode.ALPHANUMERIC;
        this.data = data;
      }
      AlphanumericData.getBitsLength = function getBitsLength(length) {
        return 11 * Math.floor(length / 2) + 6 * (length % 2);
      };
      AlphanumericData.prototype.getLength = function getLength() {
        return this.data.length;
      };
      AlphanumericData.prototype.getBitsLength = function getBitsLength() {
        return AlphanumericData.getBitsLength(this.data.length);
      };
      AlphanumericData.prototype.write = function write(bitBuffer) {
        let i2;
        for (i2 = 0; i2 + 2 <= this.data.length; i2 += 2) {
          let value = ALPHA_NUM_CHARS.indexOf(this.data[i2]) * 45;
          value += ALPHA_NUM_CHARS.indexOf(this.data[i2 + 1]);
          bitBuffer.put(value, 11);
        }
        if (this.data.length % 2) {
          bitBuffer.put(ALPHA_NUM_CHARS.indexOf(this.data[i2]), 6);
        }
      };
      module.exports = AlphanumericData;
    }
  });

  // node_modules/qrcode/lib/core/byte-data.js
  var require_byte_data = __commonJS({
    "node_modules/qrcode/lib/core/byte-data.js"(exports, module) {
      var Mode = require_mode();
      function ByteData(data) {
        this.mode = Mode.BYTE;
        if (typeof data === "string") {
          this.data = new TextEncoder().encode(data);
        } else {
          this.data = new Uint8Array(data);
        }
      }
      ByteData.getBitsLength = function getBitsLength(length) {
        return length * 8;
      };
      ByteData.prototype.getLength = function getLength() {
        return this.data.length;
      };
      ByteData.prototype.getBitsLength = function getBitsLength() {
        return ByteData.getBitsLength(this.data.length);
      };
      ByteData.prototype.write = function(bitBuffer) {
        for (let i2 = 0, l2 = this.data.length; i2 < l2; i2++) {
          bitBuffer.put(this.data[i2], 8);
        }
      };
      module.exports = ByteData;
    }
  });

  // node_modules/qrcode/lib/core/kanji-data.js
  var require_kanji_data = __commonJS({
    "node_modules/qrcode/lib/core/kanji-data.js"(exports, module) {
      var Mode = require_mode();
      var Utils = require_utils();
      function KanjiData(data) {
        this.mode = Mode.KANJI;
        this.data = data;
      }
      KanjiData.getBitsLength = function getBitsLength(length) {
        return length * 13;
      };
      KanjiData.prototype.getLength = function getLength() {
        return this.data.length;
      };
      KanjiData.prototype.getBitsLength = function getBitsLength() {
        return KanjiData.getBitsLength(this.data.length);
      };
      KanjiData.prototype.write = function(bitBuffer) {
        let i2;
        for (i2 = 0; i2 < this.data.length; i2++) {
          let value = Utils.toSJIS(this.data[i2]);
          if (value >= 33088 && value <= 40956) {
            value -= 33088;
          } else if (value >= 57408 && value <= 60351) {
            value -= 49472;
          } else {
            throw new Error(
              "Invalid SJIS character: " + this.data[i2] + "\nMake sure your charset is UTF-8"
            );
          }
          value = (value >>> 8 & 255) * 192 + (value & 255);
          bitBuffer.put(value, 13);
        }
      };
      module.exports = KanjiData;
    }
  });

  // node_modules/dijkstrajs/dijkstra.js
  var require_dijkstra = __commonJS({
    "node_modules/dijkstrajs/dijkstra.js"(exports, module) {
      "use strict";
      var dijkstra = {
        single_source_shortest_paths: function(graph, s2, d2) {
          var predecessors = {};
          var costs = {};
          costs[s2] = 0;
          var open = dijkstra.PriorityQueue.make();
          open.push(s2, 0);
          var closest, u2, v2, cost_of_s_to_u, adjacent_nodes, cost_of_e, cost_of_s_to_u_plus_cost_of_e, cost_of_s_to_v, first_visit;
          while (!open.empty()) {
            closest = open.pop();
            u2 = closest.value;
            cost_of_s_to_u = closest.cost;
            adjacent_nodes = graph[u2] || {};
            for (v2 in adjacent_nodes) {
              if (adjacent_nodes.hasOwnProperty(v2)) {
                cost_of_e = adjacent_nodes[v2];
                cost_of_s_to_u_plus_cost_of_e = cost_of_s_to_u + cost_of_e;
                cost_of_s_to_v = costs[v2];
                first_visit = typeof costs[v2] === "undefined";
                if (first_visit || cost_of_s_to_v > cost_of_s_to_u_plus_cost_of_e) {
                  costs[v2] = cost_of_s_to_u_plus_cost_of_e;
                  open.push(v2, cost_of_s_to_u_plus_cost_of_e);
                  predecessors[v2] = u2;
                }
              }
            }
          }
          if (typeof d2 !== "undefined" && typeof costs[d2] === "undefined") {
            var msg = ["Could not find a path from ", s2, " to ", d2, "."].join("");
            throw new Error(msg);
          }
          return predecessors;
        },
        extract_shortest_path_from_predecessor_list: function(predecessors, d2) {
          var nodes = [];
          var u2 = d2;
          var predecessor;
          while (u2) {
            nodes.push(u2);
            predecessor = predecessors[u2];
            u2 = predecessors[u2];
          }
          nodes.reverse();
          return nodes;
        },
        find_path: function(graph, s2, d2) {
          var predecessors = dijkstra.single_source_shortest_paths(graph, s2, d2);
          return dijkstra.extract_shortest_path_from_predecessor_list(
            predecessors,
            d2
          );
        },
        /**
         * A very naive priority queue implementation.
         */
        PriorityQueue: {
          make: function(opts) {
            var T3 = dijkstra.PriorityQueue, t = {}, key;
            opts = opts || {};
            for (key in T3) {
              if (T3.hasOwnProperty(key)) {
                t[key] = T3[key];
              }
            }
            t.queue = [];
            t.sorter = opts.sorter || T3.default_sorter;
            return t;
          },
          default_sorter: function(a2, b2) {
            return a2.cost - b2.cost;
          },
          /**
           * Add a new item to the queue and ensure the highest priority element
           * is at the front of the queue.
           */
          push: function(value, cost) {
            var item = { value, cost };
            this.queue.push(item);
            this.queue.sort(this.sorter);
          },
          /**
           * Return the highest priority element in the queue.
           */
          pop: function() {
            return this.queue.shift();
          },
          empty: function() {
            return this.queue.length === 0;
          }
        }
      };
      if (typeof module !== "undefined") {
        module.exports = dijkstra;
      }
    }
  });

  // node_modules/qrcode/lib/core/segments.js
  var require_segments = __commonJS({
    "node_modules/qrcode/lib/core/segments.js"(exports) {
      var Mode = require_mode();
      var NumericData = require_numeric_data();
      var AlphanumericData = require_alphanumeric_data();
      var ByteData = require_byte_data();
      var KanjiData = require_kanji_data();
      var Regex = require_regex();
      var Utils = require_utils();
      var dijkstra = require_dijkstra();
      function getStringByteLength(str) {
        return unescape(encodeURIComponent(str)).length;
      }
      function getSegments(regex, mode, str) {
        const segments = [];
        let result;
        while ((result = regex.exec(str)) !== null) {
          segments.push({
            data: result[0],
            index: result.index,
            mode,
            length: result[0].length
          });
        }
        return segments;
      }
      function getSegmentsFromString(dataStr) {
        const numSegs = getSegments(Regex.NUMERIC, Mode.NUMERIC, dataStr);
        const alphaNumSegs = getSegments(Regex.ALPHANUMERIC, Mode.ALPHANUMERIC, dataStr);
        let byteSegs;
        let kanjiSegs;
        if (Utils.isKanjiModeEnabled()) {
          byteSegs = getSegments(Regex.BYTE, Mode.BYTE, dataStr);
          kanjiSegs = getSegments(Regex.KANJI, Mode.KANJI, dataStr);
        } else {
          byteSegs = getSegments(Regex.BYTE_KANJI, Mode.BYTE, dataStr);
          kanjiSegs = [];
        }
        const segs = numSegs.concat(alphaNumSegs, byteSegs, kanjiSegs);
        return segs.sort(function(s1, s2) {
          return s1.index - s2.index;
        }).map(function(obj) {
          return {
            data: obj.data,
            mode: obj.mode,
            length: obj.length
          };
        });
      }
      function getSegmentBitsLength(length, mode) {
        switch (mode) {
          case Mode.NUMERIC:
            return NumericData.getBitsLength(length);
          case Mode.ALPHANUMERIC:
            return AlphanumericData.getBitsLength(length);
          case Mode.KANJI:
            return KanjiData.getBitsLength(length);
          case Mode.BYTE:
            return ByteData.getBitsLength(length);
        }
      }
      function mergeSegments(segs) {
        return segs.reduce(function(acc, curr) {
          const prevSeg = acc.length - 1 >= 0 ? acc[acc.length - 1] : null;
          if (prevSeg && prevSeg.mode === curr.mode) {
            acc[acc.length - 1].data += curr.data;
            return acc;
          }
          acc.push(curr);
          return acc;
        }, []);
      }
      function buildNodes(segs) {
        const nodes = [];
        for (let i2 = 0; i2 < segs.length; i2++) {
          const seg = segs[i2];
          switch (seg.mode) {
            case Mode.NUMERIC:
              nodes.push([
                seg,
                { data: seg.data, mode: Mode.ALPHANUMERIC, length: seg.length },
                { data: seg.data, mode: Mode.BYTE, length: seg.length }
              ]);
              break;
            case Mode.ALPHANUMERIC:
              nodes.push([
                seg,
                { data: seg.data, mode: Mode.BYTE, length: seg.length }
              ]);
              break;
            case Mode.KANJI:
              nodes.push([
                seg,
                { data: seg.data, mode: Mode.BYTE, length: getStringByteLength(seg.data) }
              ]);
              break;
            case Mode.BYTE:
              nodes.push([
                { data: seg.data, mode: Mode.BYTE, length: getStringByteLength(seg.data) }
              ]);
          }
        }
        return nodes;
      }
      function buildGraph(nodes, version) {
        const table = {};
        const graph = { start: {} };
        let prevNodeIds = ["start"];
        for (let i2 = 0; i2 < nodes.length; i2++) {
          const nodeGroup = nodes[i2];
          const currentNodeIds = [];
          for (let j2 = 0; j2 < nodeGroup.length; j2++) {
            const node = nodeGroup[j2];
            const key = "" + i2 + j2;
            currentNodeIds.push(key);
            table[key] = { node, lastCount: 0 };
            graph[key] = {};
            for (let n2 = 0; n2 < prevNodeIds.length; n2++) {
              const prevNodeId = prevNodeIds[n2];
              if (table[prevNodeId] && table[prevNodeId].node.mode === node.mode) {
                graph[prevNodeId][key] = getSegmentBitsLength(table[prevNodeId].lastCount + node.length, node.mode) - getSegmentBitsLength(table[prevNodeId].lastCount, node.mode);
                table[prevNodeId].lastCount += node.length;
              } else {
                if (table[prevNodeId]) table[prevNodeId].lastCount = node.length;
                graph[prevNodeId][key] = getSegmentBitsLength(node.length, node.mode) + 4 + Mode.getCharCountIndicator(node.mode, version);
              }
            }
          }
          prevNodeIds = currentNodeIds;
        }
        for (let n2 = 0; n2 < prevNodeIds.length; n2++) {
          graph[prevNodeIds[n2]].end = 0;
        }
        return { map: graph, table };
      }
      function buildSingleSegment(data, modesHint) {
        let mode;
        const bestMode = Mode.getBestModeForData(data);
        mode = Mode.from(modesHint, bestMode);
        if (mode !== Mode.BYTE && mode.bit < bestMode.bit) {
          throw new Error('"' + data + '" cannot be encoded with mode ' + Mode.toString(mode) + ".\n Suggested mode is: " + Mode.toString(bestMode));
        }
        if (mode === Mode.KANJI && !Utils.isKanjiModeEnabled()) {
          mode = Mode.BYTE;
        }
        switch (mode) {
          case Mode.NUMERIC:
            return new NumericData(data);
          case Mode.ALPHANUMERIC:
            return new AlphanumericData(data);
          case Mode.KANJI:
            return new KanjiData(data);
          case Mode.BYTE:
            return new ByteData(data);
        }
      }
      exports.fromArray = function fromArray(array) {
        return array.reduce(function(acc, seg) {
          if (typeof seg === "string") {
            acc.push(buildSingleSegment(seg, null));
          } else if (seg.data) {
            acc.push(buildSingleSegment(seg.data, seg.mode));
          }
          return acc;
        }, []);
      };
      exports.fromString = function fromString(data, version) {
        const segs = getSegmentsFromString(data, Utils.isKanjiModeEnabled());
        const nodes = buildNodes(segs);
        const graph = buildGraph(nodes, version);
        const path = dijkstra.find_path(graph.map, "start", "end");
        const optimizedSegs = [];
        for (let i2 = 1; i2 < path.length - 1; i2++) {
          optimizedSegs.push(graph.table[path[i2]].node);
        }
        return exports.fromArray(mergeSegments(optimizedSegs));
      };
      exports.rawSplit = function rawSplit(data) {
        return exports.fromArray(
          getSegmentsFromString(data, Utils.isKanjiModeEnabled())
        );
      };
    }
  });

  // node_modules/qrcode/lib/core/qrcode.js
  var require_qrcode = __commonJS({
    "node_modules/qrcode/lib/core/qrcode.js"(exports) {
      var Utils = require_utils();
      var ECLevel = require_error_correction_level();
      var BitBuffer = require_bit_buffer();
      var BitMatrix = require_bit_matrix();
      var AlignmentPattern = require_alignment_pattern();
      var FinderPattern = require_finder_pattern();
      var MaskPattern = require_mask_pattern();
      var ECCode = require_error_correction_code();
      var ReedSolomonEncoder = require_reed_solomon_encoder();
      var Version = require_version();
      var FormatInfo = require_format_info();
      var Mode = require_mode();
      var Segments = require_segments();
      function setupFinderPattern(matrix, version) {
        const size = matrix.size;
        const pos = FinderPattern.getPositions(version);
        for (let i2 = 0; i2 < pos.length; i2++) {
          const row = pos[i2][0];
          const col = pos[i2][1];
          for (let r2 = -1; r2 <= 7; r2++) {
            if (row + r2 <= -1 || size <= row + r2) continue;
            for (let c2 = -1; c2 <= 7; c2++) {
              if (col + c2 <= -1 || size <= col + c2) continue;
              if (r2 >= 0 && r2 <= 6 && (c2 === 0 || c2 === 6) || c2 >= 0 && c2 <= 6 && (r2 === 0 || r2 === 6) || r2 >= 2 && r2 <= 4 && c2 >= 2 && c2 <= 4) {
                matrix.set(row + r2, col + c2, true, true);
              } else {
                matrix.set(row + r2, col + c2, false, true);
              }
            }
          }
        }
      }
      function setupTimingPattern(matrix) {
        const size = matrix.size;
        for (let r2 = 8; r2 < size - 8; r2++) {
          const value = r2 % 2 === 0;
          matrix.set(r2, 6, value, true);
          matrix.set(6, r2, value, true);
        }
      }
      function setupAlignmentPattern(matrix, version) {
        const pos = AlignmentPattern.getPositions(version);
        for (let i2 = 0; i2 < pos.length; i2++) {
          const row = pos[i2][0];
          const col = pos[i2][1];
          for (let r2 = -2; r2 <= 2; r2++) {
            for (let c2 = -2; c2 <= 2; c2++) {
              if (r2 === -2 || r2 === 2 || c2 === -2 || c2 === 2 || r2 === 0 && c2 === 0) {
                matrix.set(row + r2, col + c2, true, true);
              } else {
                matrix.set(row + r2, col + c2, false, true);
              }
            }
          }
        }
      }
      function setupVersionInfo(matrix, version) {
        const size = matrix.size;
        const bits = Version.getEncodedBits(version);
        let row, col, mod;
        for (let i2 = 0; i2 < 18; i2++) {
          row = Math.floor(i2 / 3);
          col = i2 % 3 + size - 8 - 3;
          mod = (bits >> i2 & 1) === 1;
          matrix.set(row, col, mod, true);
          matrix.set(col, row, mod, true);
        }
      }
      function setupFormatInfo(matrix, errorCorrectionLevel, maskPattern) {
        const size = matrix.size;
        const bits = FormatInfo.getEncodedBits(errorCorrectionLevel, maskPattern);
        let i2, mod;
        for (i2 = 0; i2 < 15; i2++) {
          mod = (bits >> i2 & 1) === 1;
          if (i2 < 6) {
            matrix.set(i2, 8, mod, true);
          } else if (i2 < 8) {
            matrix.set(i2 + 1, 8, mod, true);
          } else {
            matrix.set(size - 15 + i2, 8, mod, true);
          }
          if (i2 < 8) {
            matrix.set(8, size - i2 - 1, mod, true);
          } else if (i2 < 9) {
            matrix.set(8, 15 - i2 - 1 + 1, mod, true);
          } else {
            matrix.set(8, 15 - i2 - 1, mod, true);
          }
        }
        matrix.set(size - 8, 8, 1, true);
      }
      function setupData(matrix, data) {
        const size = matrix.size;
        let inc = -1;
        let row = size - 1;
        let bitIndex = 7;
        let byteIndex = 0;
        for (let col = size - 1; col > 0; col -= 2) {
          if (col === 6) col--;
          while (true) {
            for (let c2 = 0; c2 < 2; c2++) {
              if (!matrix.isReserved(row, col - c2)) {
                let dark = false;
                if (byteIndex < data.length) {
                  dark = (data[byteIndex] >>> bitIndex & 1) === 1;
                }
                matrix.set(row, col - c2, dark);
                bitIndex--;
                if (bitIndex === -1) {
                  byteIndex++;
                  bitIndex = 7;
                }
              }
            }
            row += inc;
            if (row < 0 || size <= row) {
              row -= inc;
              inc = -inc;
              break;
            }
          }
        }
      }
      function createData(version, errorCorrectionLevel, segments) {
        const buffer = new BitBuffer();
        segments.forEach(function(data) {
          buffer.put(data.mode.bit, 4);
          buffer.put(data.getLength(), Mode.getCharCountIndicator(data.mode, version));
          data.write(buffer);
        });
        const totalCodewords = Utils.getSymbolTotalCodewords(version);
        const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
        const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;
        if (buffer.getLengthInBits() + 4 <= dataTotalCodewordsBits) {
          buffer.put(0, 4);
        }
        while (buffer.getLengthInBits() % 8 !== 0) {
          buffer.putBit(0);
        }
        const remainingByte = (dataTotalCodewordsBits - buffer.getLengthInBits()) / 8;
        for (let i2 = 0; i2 < remainingByte; i2++) {
          buffer.put(i2 % 2 ? 17 : 236, 8);
        }
        return createCodewords(buffer, version, errorCorrectionLevel);
      }
      function createCodewords(bitBuffer, version, errorCorrectionLevel) {
        const totalCodewords = Utils.getSymbolTotalCodewords(version);
        const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
        const dataTotalCodewords = totalCodewords - ecTotalCodewords;
        const ecTotalBlocks = ECCode.getBlocksCount(version, errorCorrectionLevel);
        const blocksInGroup2 = totalCodewords % ecTotalBlocks;
        const blocksInGroup1 = ecTotalBlocks - blocksInGroup2;
        const totalCodewordsInGroup1 = Math.floor(totalCodewords / ecTotalBlocks);
        const dataCodewordsInGroup1 = Math.floor(dataTotalCodewords / ecTotalBlocks);
        const dataCodewordsInGroup2 = dataCodewordsInGroup1 + 1;
        const ecCount = totalCodewordsInGroup1 - dataCodewordsInGroup1;
        const rs = new ReedSolomonEncoder(ecCount);
        let offset = 0;
        const dcData = new Array(ecTotalBlocks);
        const ecData = new Array(ecTotalBlocks);
        let maxDataSize = 0;
        const buffer = new Uint8Array(bitBuffer.buffer);
        for (let b2 = 0; b2 < ecTotalBlocks; b2++) {
          const dataSize = b2 < blocksInGroup1 ? dataCodewordsInGroup1 : dataCodewordsInGroup2;
          dcData[b2] = buffer.slice(offset, offset + dataSize);
          ecData[b2] = rs.encode(dcData[b2]);
          offset += dataSize;
          maxDataSize = Math.max(maxDataSize, dataSize);
        }
        const data = new Uint8Array(totalCodewords);
        let index = 0;
        let i2, r2;
        for (i2 = 0; i2 < maxDataSize; i2++) {
          for (r2 = 0; r2 < ecTotalBlocks; r2++) {
            if (i2 < dcData[r2].length) {
              data[index++] = dcData[r2][i2];
            }
          }
        }
        for (i2 = 0; i2 < ecCount; i2++) {
          for (r2 = 0; r2 < ecTotalBlocks; r2++) {
            data[index++] = ecData[r2][i2];
          }
        }
        return data;
      }
      function createSymbol(data, version, errorCorrectionLevel, maskPattern) {
        let segments;
        if (Array.isArray(data)) {
          segments = Segments.fromArray(data);
        } else if (typeof data === "string") {
          let estimatedVersion = version;
          if (!estimatedVersion) {
            const rawSegments = Segments.rawSplit(data);
            estimatedVersion = Version.getBestVersionForData(rawSegments, errorCorrectionLevel);
          }
          segments = Segments.fromString(data, estimatedVersion || 40);
        } else {
          throw new Error("Invalid data");
        }
        const bestVersion = Version.getBestVersionForData(segments, errorCorrectionLevel);
        if (!bestVersion) {
          throw new Error("The amount of data is too big to be stored in a QR Code");
        }
        if (!version) {
          version = bestVersion;
        } else if (version < bestVersion) {
          throw new Error(
            "\nThe chosen QR Code version cannot contain this amount of data.\nMinimum version required to store current data is: " + bestVersion + ".\n"
          );
        }
        const dataBits = createData(version, errorCorrectionLevel, segments);
        const moduleCount = Utils.getSymbolSize(version);
        const modules = new BitMatrix(moduleCount);
        setupFinderPattern(modules, version);
        setupTimingPattern(modules);
        setupAlignmentPattern(modules, version);
        setupFormatInfo(modules, errorCorrectionLevel, 0);
        if (version >= 7) {
          setupVersionInfo(modules, version);
        }
        setupData(modules, dataBits);
        if (isNaN(maskPattern)) {
          maskPattern = MaskPattern.getBestMask(
            modules,
            setupFormatInfo.bind(null, modules, errorCorrectionLevel)
          );
        }
        MaskPattern.applyMask(maskPattern, modules);
        setupFormatInfo(modules, errorCorrectionLevel, maskPattern);
        return {
          modules,
          version,
          errorCorrectionLevel,
          maskPattern,
          segments
        };
      }
      exports.create = function create(data, options) {
        if (typeof data === "undefined" || data === "") {
          throw new Error("No input text");
        }
        let errorCorrectionLevel = ECLevel.M;
        let version;
        let mask;
        if (typeof options !== "undefined") {
          errorCorrectionLevel = ECLevel.from(options.errorCorrectionLevel, ECLevel.M);
          version = Version.from(options.version);
          mask = MaskPattern.from(options.maskPattern);
          if (options.toSJISFunc) {
            Utils.setToSJISFunction(options.toSJISFunc);
          }
        }
        return createSymbol(data, version, errorCorrectionLevel, mask);
      };
    }
  });

  // node_modules/qrcode/lib/renderer/utils.js
  var require_utils2 = __commonJS({
    "node_modules/qrcode/lib/renderer/utils.js"(exports) {
      function hex2rgba(hex) {
        if (typeof hex === "number") {
          hex = hex.toString();
        }
        if (typeof hex !== "string") {
          throw new Error("Color should be defined as hex string");
        }
        let hexCode = hex.slice().replace("#", "").split("");
        if (hexCode.length < 3 || hexCode.length === 5 || hexCode.length > 8) {
          throw new Error("Invalid hex color: " + hex);
        }
        if (hexCode.length === 3 || hexCode.length === 4) {
          hexCode = Array.prototype.concat.apply([], hexCode.map(function(c2) {
            return [c2, c2];
          }));
        }
        if (hexCode.length === 6) hexCode.push("F", "F");
        const hexValue = parseInt(hexCode.join(""), 16);
        return {
          r: hexValue >> 24 & 255,
          g: hexValue >> 16 & 255,
          b: hexValue >> 8 & 255,
          a: hexValue & 255,
          hex: "#" + hexCode.slice(0, 6).join("")
        };
      }
      exports.getOptions = function getOptions(options) {
        if (!options) options = {};
        if (!options.color) options.color = {};
        const margin = typeof options.margin === "undefined" || options.margin === null || options.margin < 0 ? 4 : options.margin;
        const width = options.width && options.width >= 21 ? options.width : void 0;
        const scale = options.scale || 4;
        return {
          width,
          scale: width ? 4 : scale,
          margin,
          color: {
            dark: hex2rgba(options.color.dark || "#000000ff"),
            light: hex2rgba(options.color.light || "#ffffffff")
          },
          type: options.type,
          rendererOpts: options.rendererOpts || {}
        };
      };
      exports.getScale = function getScale(qrSize, opts) {
        return opts.width && opts.width >= qrSize + opts.margin * 2 ? opts.width / (qrSize + opts.margin * 2) : opts.scale;
      };
      exports.getImageWidth = function getImageWidth(qrSize, opts) {
        const scale = exports.getScale(qrSize, opts);
        return Math.floor((qrSize + opts.margin * 2) * scale);
      };
      exports.qrToImageData = function qrToImageData(imgData, qr, opts) {
        const size = qr.modules.size;
        const data = qr.modules.data;
        const scale = exports.getScale(size, opts);
        const symbolSize = Math.floor((size + opts.margin * 2) * scale);
        const scaledMargin = opts.margin * scale;
        const palette = [opts.color.light, opts.color.dark];
        for (let i2 = 0; i2 < symbolSize; i2++) {
          for (let j2 = 0; j2 < symbolSize; j2++) {
            let posDst = (i2 * symbolSize + j2) * 4;
            let pxColor = opts.color.light;
            if (i2 >= scaledMargin && j2 >= scaledMargin && i2 < symbolSize - scaledMargin && j2 < symbolSize - scaledMargin) {
              const iSrc = Math.floor((i2 - scaledMargin) / scale);
              const jSrc = Math.floor((j2 - scaledMargin) / scale);
              pxColor = palette[data[iSrc * size + jSrc] ? 1 : 0];
            }
            imgData[posDst++] = pxColor.r;
            imgData[posDst++] = pxColor.g;
            imgData[posDst++] = pxColor.b;
            imgData[posDst] = pxColor.a;
          }
        }
      };
    }
  });

  // node_modules/qrcode/lib/renderer/canvas.js
  var require_canvas = __commonJS({
    "node_modules/qrcode/lib/renderer/canvas.js"(exports) {
      var Utils = require_utils2();
      function clearCanvas(ctx, canvas, size) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!canvas.style) canvas.style = {};
        canvas.height = size;
        canvas.width = size;
        canvas.style.height = size + "px";
        canvas.style.width = size + "px";
      }
      function getCanvasElement() {
        try {
          return document.createElement("canvas");
        } catch (e2) {
          throw new Error("You need to specify a canvas element");
        }
      }
      exports.render = function render(qrData, canvas, options) {
        let opts = options;
        let canvasEl = canvas;
        if (typeof opts === "undefined" && (!canvas || !canvas.getContext)) {
          opts = canvas;
          canvas = void 0;
        }
        if (!canvas) {
          canvasEl = getCanvasElement();
        }
        opts = Utils.getOptions(opts);
        const size = Utils.getImageWidth(qrData.modules.size, opts);
        const ctx = canvasEl.getContext("2d");
        const image = ctx.createImageData(size, size);
        Utils.qrToImageData(image.data, qrData, opts);
        clearCanvas(ctx, canvasEl, size);
        ctx.putImageData(image, 0, 0);
        return canvasEl;
      };
      exports.renderToDataURL = function renderToDataURL(qrData, canvas, options) {
        let opts = options;
        if (typeof opts === "undefined" && (!canvas || !canvas.getContext)) {
          opts = canvas;
          canvas = void 0;
        }
        if (!opts) opts = {};
        const canvasEl = exports.render(qrData, canvas, opts);
        const type = opts.type || "image/png";
        const rendererOpts = opts.rendererOpts || {};
        return canvasEl.toDataURL(type, rendererOpts.quality);
      };
    }
  });

  // node_modules/qrcode/lib/renderer/svg-tag.js
  var require_svg_tag = __commonJS({
    "node_modules/qrcode/lib/renderer/svg-tag.js"(exports) {
      var Utils = require_utils2();
      function getColorAttrib(color, attrib) {
        const alpha = color.a / 255;
        const str = attrib + '="' + color.hex + '"';
        return alpha < 1 ? str + " " + attrib + '-opacity="' + alpha.toFixed(2).slice(1) + '"' : str;
      }
      function svgCmd(cmd, x2, y2) {
        let str = cmd + x2;
        if (typeof y2 !== "undefined") str += " " + y2;
        return str;
      }
      function qrToPath(data, size, margin) {
        let path = "";
        let moveBy = 0;
        let newRow = false;
        let lineLength = 0;
        for (let i2 = 0; i2 < data.length; i2++) {
          const col = Math.floor(i2 % size);
          const row = Math.floor(i2 / size);
          if (!col && !newRow) newRow = true;
          if (data[i2]) {
            lineLength++;
            if (!(i2 > 0 && col > 0 && data[i2 - 1])) {
              path += newRow ? svgCmd("M", col + margin, 0.5 + row + margin) : svgCmd("m", moveBy, 0);
              moveBy = 0;
              newRow = false;
            }
            if (!(col + 1 < size && data[i2 + 1])) {
              path += svgCmd("h", lineLength);
              lineLength = 0;
            }
          } else {
            moveBy++;
          }
        }
        return path;
      }
      exports.render = function render(qrData, options, cb) {
        const opts = Utils.getOptions(options);
        const size = qrData.modules.size;
        const data = qrData.modules.data;
        const qrcodesize = size + opts.margin * 2;
        const bg = !opts.color.light.a ? "" : "<path " + getColorAttrib(opts.color.light, "fill") + ' d="M0 0h' + qrcodesize + "v" + qrcodesize + 'H0z"/>';
        const path = "<path " + getColorAttrib(opts.color.dark, "stroke") + ' d="' + qrToPath(data, size, opts.margin) + '"/>';
        const viewBox = 'viewBox="0 0 ' + qrcodesize + " " + qrcodesize + '"';
        const width = !opts.width ? "" : 'width="' + opts.width + '" height="' + opts.width + '" ';
        const svgTag = '<svg xmlns="http://www.w3.org/2000/svg" ' + width + viewBox + ' shape-rendering="crispEdges">' + bg + path + "</svg>\n";
        if (typeof cb === "function") {
          cb(null, svgTag);
        }
        return svgTag;
      };
    }
  });

  // node_modules/qrcode/lib/browser.js
  var require_browser = __commonJS({
    "node_modules/qrcode/lib/browser.js"(exports) {
      var canPromise = require_can_promise();
      var QRCode2 = require_qrcode();
      var CanvasRenderer = require_canvas();
      var SvgRenderer = require_svg_tag();
      function renderCanvas(renderFunc, canvas, text, opts, cb) {
        const args = [].slice.call(arguments, 1);
        const argsNum = args.length;
        const isLastArgCb = typeof args[argsNum - 1] === "function";
        if (!isLastArgCb && !canPromise()) {
          throw new Error("Callback required as last argument");
        }
        if (isLastArgCb) {
          if (argsNum < 2) {
            throw new Error("Too few arguments provided");
          }
          if (argsNum === 2) {
            cb = text;
            text = canvas;
            canvas = opts = void 0;
          } else if (argsNum === 3) {
            if (canvas.getContext && typeof cb === "undefined") {
              cb = opts;
              opts = void 0;
            } else {
              cb = opts;
              opts = text;
              text = canvas;
              canvas = void 0;
            }
          }
        } else {
          if (argsNum < 1) {
            throw new Error("Too few arguments provided");
          }
          if (argsNum === 1) {
            text = canvas;
            canvas = opts = void 0;
          } else if (argsNum === 2 && !canvas.getContext) {
            opts = text;
            text = canvas;
            canvas = void 0;
          }
          return new Promise(function(resolve, reject) {
            try {
              const data = QRCode2.create(text, opts);
              resolve(renderFunc(data, canvas, opts));
            } catch (e2) {
              reject(e2);
            }
          });
        }
        try {
          const data = QRCode2.create(text, opts);
          cb(null, renderFunc(data, canvas, opts));
        } catch (e2) {
          cb(e2);
        }
      }
      exports.create = QRCode2.create;
      exports.toCanvas = renderCanvas.bind(null, CanvasRenderer.render);
      exports.toDataURL = renderCanvas.bind(null, CanvasRenderer.renderToDataURL);
      exports.toString = renderCanvas.bind(null, function(data, _2, opts) {
        return SvgRenderer.render(data, opts);
      });
    }
  });

  // test/test-bench.js
  var import_qrcode = __toESM(require_browser(), 1);

  // src/utils/parser.js
  function classifyContent(raw) {
    if (typeof raw !== "string") {
      return {
        type: "text",
        raw: "",
        title: "Empty",
        summary: ""
      };
    }
    const trimmed = raw.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const url = new URL(trimmed);
        return {
          type: "url",
          raw: trimmed,
          title: url.hostname,
          summary: trimmed,
          actionUrl: trimmed
        };
      } catch {
      }
    }
    if (/^WIFI:/i.test(trimmed)) {
      const wifiData = parseWifiString(trimmed);
      return {
        type: "wifi",
        raw: trimmed,
        title: wifiData.ssid ? `WiFi: ${wifiData.ssid}` : "WiFi Network",
        summary: wifiData.ssid ? `SSID: ${wifiData.ssid} (${wifiData.type || "Open"})` : trimmed,
        metadata: wifiData
      };
    }
    if (/^mailto:/i.test(trimmed) || /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
      const email = trimmed.replace(/^mailto:/i, "").split("?")[0];
      return {
        type: "email",
        raw: trimmed,
        title: `Email: ${email}`,
        summary: email,
        actionUrl: trimmed.startsWith("mailto:") ? trimmed : `mailto:${email}`
      };
    }
    if (/^tel:/i.test(trimmed) || /^\+?[0-9\s\-()]{7,20}$/.test(trimmed)) {
      const phone = trimmed.replace(/^tel:/i, "").trim();
      return {
        type: "phone",
        raw: trimmed,
        title: `Call: ${phone}`,
        summary: phone,
        actionUrl: `tel:${phone.replace(/\s+/g, "")}`
      };
    }
    if (/^(smsto|sms):/i.test(trimmed)) {
      const parts = trimmed.replace(/^(smsto|sms):/i, "").split(":");
      const number = parts[0] || "";
      const body = parts.slice(1).join(":") || "";
      return {
        type: "sms",
        raw: trimmed,
        title: `SMS: ${number}`,
        summary: body ? `${number} \u2014 "${body}"` : number,
        metadata: { number, body },
        actionUrl: trimmed
      };
    }
    if (/^geo:/i.test(trimmed)) {
      const coords = trimmed.replace(/^geo:/i, "").split("?")[0].split(",");
      const lat = parseFloat(coords[0]);
      const lng = parseFloat(coords[1]);
      const isValid = !isNaN(lat) && !isNaN(lng);
      return {
        type: "geo",
        raw: trimmed,
        title: isValid ? `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}` : "Location",
        summary: trimmed,
        metadata: isValid ? { lat, lng } : {},
        actionUrl: isValid ? `https://www.google.com/maps?q=${lat},${lng}` : void 0
      };
    }
    return {
      type: "text",
      raw: trimmed,
      title: "Text Snippet",
      summary: truncateString(trimmed, 90)
    };
  }
  function parseWifiString(str) {
    const clean = str.replace(/^WIFI:/i, "");
    const result = {
      ssid: "",
      type: "WPA",
      password: "",
      hidden: false
    };
    const regex = /([STPH]):((?:\\;|[^;])*);/gi;
    let match;
    while ((match = regex.exec(clean)) !== null) {
      const key = match[1].toUpperCase();
      const value = match[2].replace(/\\;/g, ";").replace(/\\\\/g, "\\");
      if (key === "S") result.ssid = value;
      else if (key === "T") result.type = value;
      else if (key === "P") result.password = value;
      else if (key === "H") result.hidden = value.toLowerCase() === "true";
    }
    return result;
  }
  function truncateString(str, max = 80) {
    if (!str) return "";
    if (str.length <= max) return str;
    return str.slice(0, max - 1) + "\u2026";
  }

  // src/utils/coordinates.js
  function computeBounds(location) {
    const points = [
      location.topLeftCorner,
      location.topRightCorner,
      location.bottomRightCorner,
      location.bottomLeftCorner
    ];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p2 of points) {
      if (p2.x < minX) minX = p2.x;
      if (p2.y < minY) minY = p2.y;
      if (p2.x > maxX) maxX = p2.x;
      if (p2.y > maxY) maxY = p2.y;
    }
    const width = maxX - minX;
    const height = maxY - minY;
    return {
      minX,
      minY,
      maxX,
      maxY,
      width,
      height,
      centerX: minX + width / 2,
      centerY: minY + height / 2
    };
  }
  function lerp(start, end, factor = 0.35) {
    return start + (end - start) * factor;
  }
  function lerpPoint(current, target, factor = 0.35) {
    if (!current) return { ...target };
    return {
      x: lerp(current.x, target.x, factor),
      y: lerp(current.y, target.y, factor)
    };
  }
  function lerpLocation(current, target, factor = 0.35) {
    if (!current) {
      return {
        topLeftCorner: { ...target.topLeftCorner },
        topRightCorner: { ...target.topRightCorner },
        bottomRightCorner: { ...target.bottomRightCorner },
        bottomLeftCorner: { ...target.bottomLeftCorner }
      };
    }
    return {
      topLeftCorner: lerpPoint(current.topLeftCorner, target.topLeftCorner, factor),
      topRightCorner: lerpPoint(current.topRightCorner, target.topRightCorner, factor),
      bottomRightCorner: lerpPoint(current.bottomRightCorner, target.bottomRightCorner, factor),
      bottomLeftCorner: lerpPoint(current.bottomLeftCorner, target.bottomLeftCorner, factor)
    };
  }
  function areBoundsNear(b1, b2, maxDistance = 60) {
    if (!b1 || !b2) return false;
    const dx = b1.centerX - b2.centerX;
    const dy = b1.centerY - b2.centerY;
    return dx * dx + dy * dy <= maxDistance * maxDistance;
  }

  // src/utils/storage.js
  var STORAGE_KEYS = {
    SETTINGS: "qr_radar_settings",
    HISTORY: "qr_radar_history"
  };
  function hasExtensionStorage() {
    return typeof browser !== "undefined" && browser.storage && browser.storage.local;
  }
  async function getScanHistory() {
    try {
      if (hasExtensionStorage()) {
        const res = await browser.storage.local.get(STORAGE_KEYS.HISTORY);
        return res[STORAGE_KEYS.HISTORY] || [];
      } else if (typeof localStorage !== "undefined") {
        const item = localStorage.getItem(STORAGE_KEYS.HISTORY);
        return item ? JSON.parse(item) : [];
      }
    } catch (err) {
      console.warn("[QR-Radar] Failed to load history:", err);
    }
    return [];
  }
  async function addScanHistory(item) {
    const history = await getScanHistory();
    const now = Date.now();
    if (history.length > 0 && history[0].text === item.text && now - history[0].timestamp < 5e3) {
      return history;
    }
    const newEntry = {
      id: `scan_${now}_${Math.random().toString(36).slice(2, 7)}`,
      text: item.text,
      type: item.type || "text",
      title: item.title || item.text,
      timestamp: now
    };
    const updated = [newEntry, ...history.filter((h2) => h2.text !== item.text)].slice(0, 50);
    if (hasExtensionStorage()) {
      await browser.storage.local.set({ [STORAGE_KEYS.HISTORY]: updated });
    } else if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
    }
    return updated;
  }

  // src/utils/dom-anchor.js
  function findAnchorElement(centerX, centerY, ignoreRootId = "qr-radar-root") {
    if (typeof document === "undefined" || !document.elementsFromPoint) {
      return null;
    }
    const elements = document.elementsFromPoint(centerX, centerY) || [];
    const candidates = elements.filter((el) => {
      return el && el.id !== ignoreRootId && !el.closest(`#${ignoreRootId}`);
    });
    if (candidates.length === 0) return null;
    const mediaTags = ["IMG", "VIDEO", "CANVAS", "SVG", "PICTURE"];
    for (const el of candidates) {
      if (mediaTags.includes(el.tagName)) {
        return el;
      }
    }
    for (const el of candidates) {
      try {
        const bg = window.getComputedStyle(el).backgroundImage;
        if (bg && bg !== "none" && !bg.includes("initial")) {
          return el;
        }
      } catch {
      }
    }
    for (const el of candidates) {
      if (el.tagName !== "BODY" && el.tagName !== "HTML") {
        return el;
      }
    }
    return candidates[0] || null;
  }
  function computeAnchorOffset(anchorEl, bounds) {
    if (!anchorEl || !bounds) {
      return { offsetX: 0, offsetY: 0, width: bounds?.width || 0, height: bounds?.height || 0 };
    }
    const rect = anchorEl.getBoundingClientRect();
    const initialWidth = rect.width || 1;
    const initialHeight = rect.height || 1;
    return {
      offsetX: bounds.minX - rect.left,
      offsetY: bounds.minY - rect.top,
      width: bounds.width,
      height: bounds.height,
      relX: (bounds.minX - rect.left) / initialWidth,
      relY: (bounds.minY - rect.top) / initialHeight,
      relW: bounds.width / initialWidth,
      relH: bounds.height / initialHeight,
      initialWidth,
      initialHeight
    };
  }
  function isElementFixed(el) {
    if (!el || typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
      return false;
    }
    let curr = el;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      try {
        const pos = window.getComputedStyle(curr).position;
        if (pos === "fixed") return true;
      } catch {
        break;
      }
      curr = curr.parentElement;
    }
    return false;
  }
  function resolveAnchorPosition(anchorEl, offset, viewport) {
    if (!anchorEl || typeof anchorEl.isConnected === "boolean" && !anchorEl.isConnected) {
      return null;
    }
    const vw = viewport?.innerWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1920);
    const vh = viewport?.innerHeight ?? (typeof window !== "undefined" ? window.innerHeight : 1080);
    const scrollX = typeof window !== "undefined" ? window.pageXOffset || window.scrollX || 0 : 0;
    const scrollY = typeof window !== "undefined" ? window.pageYOffset || window.scrollY || 0 : 0;
    const rect = anchorEl.getBoundingClientRect();
    let x2, y2, width, height;
    if (offset.relX !== void 0 && offset.initialWidth > 0 && Math.abs(rect.width - offset.initialWidth) > 1.5) {
      width = rect.width * offset.relW;
      height = rect.height * offset.relH;
      x2 = rect.left + rect.width * offset.relX;
      y2 = rect.top + rect.height * offset.relY;
    } else {
      x2 = rect.left + offset.offsetX;
      y2 = rect.top + offset.offsetY;
      width = offset.width;
      height = offset.height;
    }
    const isVisible = y2 + height >= -10 && y2 <= vh + 10 && x2 + width >= -10 && x2 <= vw + 10;
    return {
      x: x2,
      y: y2,
      docX: x2 + scrollX,
      docY: y2 + scrollY,
      width,
      height,
      isVisible
    };
  }

  // node_modules/zxing-wasm/dist/es/share.js
  var e = [
    [
      "All",
      "*",
      "*",
      "     ",
      0,
      "All"
    ],
    [
      "AllReadable",
      "*",
      "r",
      "     ",
      0,
      "All Readable"
    ],
    [
      "AllCreatable",
      "*",
      "w",
      "     ",
      0,
      "All Creatable"
    ],
    [
      "AllLinear",
      "*",
      "l",
      "     ",
      0,
      "All Linear"
    ],
    [
      "AllMatrix",
      "*",
      "m",
      "     ",
      0,
      "All Matrix"
    ],
    [
      "AllGS1",
      "*",
      "G",
      "     ",
      0,
      "All GS1"
    ],
    [
      "AllRetail",
      "*",
      "R",
      "     ",
      0,
      "All Retail"
    ],
    [
      "AllIndustrial",
      "*",
      "I",
      "     ",
      0,
      "All Industrial"
    ],
    [
      "Codabar",
      "F",
      " ",
      "lrw  ",
      18,
      "Codabar"
    ],
    [
      "Code39",
      "A",
      " ",
      "lrw I",
      8,
      "Code 39"
    ],
    [
      "Code39Std",
      "A",
      "s",
      "lrw I",
      8,
      "Code 39 Standard"
    ],
    [
      "Code39Ext",
      "A",
      "e",
      "lr  I",
      9,
      "Code 39 Extended"
    ],
    [
      "Code32",
      "A",
      "2",
      "lr  I",
      129,
      "Code 32"
    ],
    [
      "PZN",
      "A",
      "p",
      "lr  I",
      52,
      "Pharmazentralnummer"
    ],
    [
      "Code93",
      "G",
      " ",
      "lrw I",
      25,
      "Code 93"
    ],
    [
      "Code128",
      "C",
      " ",
      "lrwGI",
      20,
      "Code 128"
    ],
    [
      "ITF",
      "I",
      " ",
      "lrw I",
      3,
      "ITF"
    ],
    [
      "ITF14",
      "I",
      "4",
      "lr  I",
      89,
      "ITF-14"
    ],
    [
      "DataBar",
      "e",
      " ",
      "lr GR",
      29,
      "DataBar"
    ],
    [
      "DataBarOmni",
      "e",
      "o",
      "lr GR",
      29,
      "DataBar Omni"
    ],
    [
      "DataBarStk",
      "e",
      "s",
      "lr GR",
      79,
      "DataBar Stacked"
    ],
    [
      "DataBarStkOmni",
      "e",
      "O",
      "lr GR",
      80,
      "DataBar Stacked Omni"
    ],
    [
      "DataBarLtd",
      "e",
      "l",
      "lr GR",
      30,
      "DataBar Limited"
    ],
    [
      "DataBarExp",
      "e",
      "e",
      "lr GR",
      31,
      "DataBar Expanded"
    ],
    [
      "DataBarExpStk",
      "e",
      "E",
      "lr GR",
      81,
      "DataBar Expanded Stacked"
    ],
    [
      "EANUPC",
      "E",
      " ",
      "lr  R",
      15,
      "EAN/UPC"
    ],
    [
      "EAN13",
      "E",
      "1",
      "lrw R",
      15,
      "EAN-13"
    ],
    [
      "EAN8",
      "E",
      "8",
      "lrw R",
      10,
      "EAN-8"
    ],
    [
      "EAN5",
      "E",
      "5",
      "l   R",
      12,
      "EAN-5"
    ],
    [
      "EAN2",
      "E",
      "2",
      "l   R",
      11,
      "EAN-2"
    ],
    [
      "ISBN",
      "E",
      "i",
      "lr  R",
      69,
      "ISBN"
    ],
    [
      "UPCA",
      "E",
      "a",
      "lrw R",
      34,
      "UPC-A"
    ],
    [
      "UPCE",
      "E",
      "e",
      "lrw R",
      37,
      "UPC-E"
    ],
    [
      "Telepen",
      "B",
      " ",
      "lr  I",
      32,
      "Telepen"
    ],
    [
      "TelepenAlpha",
      "B",
      "0",
      "lr  I",
      32,
      "Telepen Alpha"
    ],
    [
      "TelepenNumeric",
      "B",
      "1",
      "lr  I",
      87,
      "Telepen Numeric"
    ],
    [
      "OtherBarcode",
      "X",
      " ",
      " r   ",
      0,
      "Other barcode"
    ],
    [
      "DXFilmEdge",
      "X",
      "x",
      "lr   ",
      147,
      "DX Film Edge"
    ],
    [
      "PDF417",
      "L",
      " ",
      "mrw  ",
      55,
      "PDF417"
    ],
    [
      "CompactPDF417",
      "L",
      "c",
      "mr   ",
      56,
      "Compact PDF417"
    ],
    [
      "MicroPDF417",
      "L",
      "m",
      "mr   ",
      84,
      "MicroPDF417"
    ],
    [
      "Aztec",
      "z",
      " ",
      "mr G ",
      92,
      "Aztec"
    ],
    [
      "AztecCode",
      "z",
      "c",
      "mrwG ",
      92,
      "Aztec Code"
    ],
    [
      "AztecRune",
      "z",
      "r",
      "mr   ",
      128,
      "Aztec Rune"
    ],
    [
      "QRCode",
      "Q",
      " ",
      "mrwG ",
      58,
      "QR Code"
    ],
    [
      "QRCodeModel1",
      "Q",
      "1",
      "mr   ",
      0,
      "QR Code Model 1"
    ],
    [
      "QRCodeModel2",
      "Q",
      "2",
      "mr   ",
      58,
      "QR Code Model 2"
    ],
    [
      "MicroQRCode",
      "Q",
      "m",
      "mr   ",
      97,
      "Micro QR Code"
    ],
    [
      "RMQRCode",
      "Q",
      "r",
      "mr G ",
      145,
      "rMQR Code"
    ],
    [
      "DataMatrix",
      "d",
      " ",
      "mrwG ",
      71,
      "Data Matrix"
    ],
    [
      "MaxiCode",
      "U",
      " ",
      "mr   ",
      57,
      "MaxiCode"
    ]
  ];
  var n = e.map((e2) => e2[5]);
  var r = e.filter((e2) => e2[1] === "*").map((e2) => e2[0]);
  var i = e.filter((e2) => e2[1] !== "*").map((e2) => e2[0]);
  var o = e.filter((e2) => e2[2] === " ").map((e2) => e2[0]);
  var s = e.filter((e2) => e2[3][0] === "l").map((e2) => e2[0]);
  var l = e.filter((e2) => e2[3][0] === "m").map((e2) => e2[0]);
  var d = e.filter((e2) => e2[3][1] === "r").map((e2) => e2[0]);
  var f = e.filter((e2) => e2[3][2] === "w" || e2[4] !== 0).map((e2) => e2[0]);
  var p = e.filter((e2) => e2[3][3] === "G").map((e2) => e2[0]);
  var m = e.filter((e2) => e2[3][4] === "R").map((e2) => e2[0]);
  var h = e.filter((e2) => e2[3][4] === "I").map((e2) => e2[0]);
  var I = {
    formats: [],
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    tryDownscale: true,
    tryDenoise: false,
    binarizer: "LocalAverage",
    isPure: false,
    downscaleFactor: 3,
    downscaleThreshold: 500,
    minLineCount: 2,
    maxNumberOfSymbols: 255,
    validateOptionalChecksum: false,
    returnErrors: false,
    eanAddOnSymbol: "Ignore",
    textMode: "HRI",
    characterSet: "Unknown",
    tryCode39ExtendedMode: true
  };
  var B = {
    format: "QRCode",
    readerInit: false,
    forceSquareDataMatrix: false,
    ecLevel: "",
    scale: 1,
    sizeHint: 0,
    rotate: 0,
    invert: false,
    withHRT: false,
    withQuietZones: true,
    addHRT: false,
    addQuietZones: true,
    options: ""
  };
  var Q = {
    ...I,
    formats: [...I.formats]
  };
  var $ = { ...B };

  // src/utils/dom-scanner.js
  function isElementInViewport(el, margin = 50) {
    if (!el || typeof el.getBoundingClientRect !== "function") return false;
    if (el.hidden || el.style?.display === "none" || el.style?.visibility === "hidden" || el.style?.opacity === "0") {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width <= 12 || rect.height <= 12) return false;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
    const vh = typeof window !== "undefined" ? window.innerHeight : 1080;
    const inBounds = rect.bottom >= -margin && rect.top <= vh + margin && rect.right >= -margin && rect.left <= vw + margin;
    if (!inBounds) return false;
    if (typeof el.checkVisibility === "function") {
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
        return false;
      }
    } else if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
      try {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.opacity === "0") {
          return false;
        }
      } catch {
      }
    }
    return true;
  }

  // src/content/overlay.js
  var QRBoxTracker = class {
    constructor(id, root, options, callbacks = {}) {
      this.id = id;
      this.root = root;
      this.options = options;
      this.callbacks = callbacks;
      this.boxElement = null;
      this.hudCard = null;
      this.miniBadge = null;
      this.currentLocation = null;
      this.cachedBounds = null;
      this.lastDetectedText = null;
      this.anchorElement = null;
      this.anchorOffset = null;
      this.docBounds = null;
      this.isDomLocked = false;
      this.isFixed = false;
      this._isFixedForAnchor = null;
      this.missingFrames = 0;
      this.maxMissingFrames = 2;
      this.lastWidth = 0;
      this.lastHeight = 0;
      this.lastX = null;
      this.lastY = null;
      this.lastDocLeft = null;
      this.lastDocTop = null;
      this.lastDocWidth = null;
      this.lastDocHeight = null;
      this.createDom();
    }
    /**
     * Builds the DOM elements for this box.
     */
    createDom() {
      this.boxElement = document.createElement("div");
      this.boxElement.className = "qr-radar-box qr-hidden";
      this.boxElement.dataset.trackerId = this.id;
      this.boxElement.innerHTML = `
      <div class="qr-radar-box-frame">
        <div class="qr-radar-corner qr-radar-corner-tl"></div>
        <div class="qr-radar-corner qr-radar-corner-tr"></div>
        <div class="qr-radar-corner qr-radar-corner-bl"></div>
        <div class="qr-radar-corner qr-radar-corner-br"></div>
        <div class="qr-radar-mini-badge" title="Hover for details">
          <span class="qr-mini-dot"></span>
          <span class="qr-mini-type">QR</span>
        </div>
      </div>
    `;
      this.miniBadge = this.boxElement.querySelector(".qr-radar-mini-badge");
      this.hudCard = document.createElement("div");
      this.hudCard.className = "qr-radar-hud-card";
      this.boxElement.appendChild(this.hudCard);
      this.root.appendChild(this.boxElement);
    }
    /**
     * Updates tracker position and content.
     * @param {any} targetLoc
     * @param {string} text
     * @param {HTMLElement} [anchorEl=null]
     * @param {boolean} [isDom=false]
     */
    update(targetLoc, text, anchorEl = null, isDom = false) {
      if (!this.boxElement) return;
      this.missingFrames = 0;
      this.boxElement.classList.remove("qr-hidden");
      if (isDom) {
        this.isDomLocked = true;
        if (anchorEl) this.anchorElement = anchorEl;
      }
      this.currentLocation = isDom ? targetLoc : this.currentLocation ? lerpLocation(this.currentLocation, targetLoc, 0.45) : targetLoc;
      const bounds = computeBounds(this.currentLocation);
      this.cachedBounds = bounds;
      const prevAnchor = this.anchorElement;
      if (!this.anchorElement || !this.anchorElement.isConnected) {
        this.anchorElement = anchorEl || findAnchorElement(bounds.centerX, bounds.centerY);
      }
      const isStaticImg = this.anchorElement && this.anchorElement.tagName === "IMG";
      if (!this.anchorOffset || !isStaticImg || this.anchorElement !== prevAnchor) {
        this.anchorOffset = computeAnchorOffset(this.anchorElement, bounds);
      }
      if (this.anchorElement !== this._isFixedForAnchor) {
        this._isFixedForAnchor = this.anchorElement;
        this.isFixed = isElementFixed(this.anchorElement);
        if (this.isFixed) {
          this.boxElement.classList.add("qr-fixed-anchor");
        } else {
          this.boxElement.classList.remove("qr-fixed-anchor");
        }
      }
      const scrollX = typeof window !== "undefined" ? window.pageXOffset || window.scrollX || 0 : 0;
      const scrollY = typeof window !== "undefined" ? window.pageYOffset || window.scrollY || 0 : 0;
      this.docBounds = {
        docX: bounds.minX + scrollX,
        docY: bounds.minY + scrollY,
        width: bounds.width,
        height: bounds.height
      };
      const targetX = this.isFixed ? bounds.minX : this.docBounds.docX;
      const targetY = this.isFixed ? bounds.minY : this.docBounds.docY;
      this.applyPosition(targetX, targetY, bounds.width, bounds.height, true, this.isFixed);
      if (text !== this.lastDetectedText) {
        const isInitial = this.lastDetectedText === null;
        this.lastDetectedText = text;
        this.renderCardContent(text);
        if (isInitial && this.callbacks.onNew) {
          this.callbacks.onNew(text);
        }
      }
    }
    /**
     * Applies position and card orientation using GPU compositor.
     */
    applyPosition(x2, y2, width, height, isVisible, isFixed = false) {
      if (!this.boxElement) return;
      if (!isVisible) {
        this.boxElement.style.visibility = "hidden";
        return;
      }
      this.boxElement.style.visibility = "visible";
      const rx = Math.round(x2 * 10) / 10;
      const ry = Math.round(y2 * 10) / 10;
      if (this.lastX !== rx || this.lastY !== ry) {
        this.lastX = rx;
        this.lastY = ry;
        this.boxElement.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      }
      if (width > 0 && this.lastWidth !== width) {
        this.lastWidth = width;
        this.boxElement.style.width = `${Math.round(width)}px`;
      }
      if (height > 0 && this.lastHeight !== height) {
        this.lastHeight = height;
        this.boxElement.style.height = `${Math.round(height)}px`;
      }
      const effW = width || this.lastWidth || 0;
      const effH = height || this.lastHeight || 0;
      const minDim = Math.min(effW, effH);
      if (minDim > 0) {
        if (minDim < 60) {
          this.boxElement.classList.add("qr-tiny");
          this.boxElement.classList.remove("qr-small");
        } else if (minDim < 110) {
          this.boxElement.classList.add("qr-small");
          this.boxElement.classList.remove("qr-tiny");
        } else {
          this.boxElement.classList.remove("qr-small", "qr-tiny");
        }
      }
      const scrollY = typeof window !== "undefined" ? window.pageYOffset || window.scrollY || 0 : 0;
      const viewportY = isFixed ? y2 : y2 - scrollY;
      const spaceBelow = (typeof window !== "undefined" ? window.innerHeight : 1080) - (viewportY + (height || 0));
      if (this.hudCard) {
        const isFlipped = this.hudCard.classList.contains("qr-flipped");
        if (isFlipped) {
          if (spaceBelow > 220) {
            this.hudCard.classList.remove("qr-flipped");
          }
        } else {
          if (spaceBelow < 140) {
            this.hudCard.classList.add("qr-flipped");
          }
        }
      }
    }
    /**
     * High-frequency rAF position sync: tracks moving/animating anchor elements.
     * Compares previous rect coordinates to eliminate layout thrashing if still.
     */
    updateLivePosition() {
      if (!this.boxElement || this.boxElement.classList.contains("qr-hidden")) {
        return;
      }
      if (this.anchorElement) {
        if (!this.anchorElement.isConnected) {
          this.boxElement.classList.add("qr-hidden");
          return;
        }
        if (this.anchorElement.hidden || this.anchorElement.style?.display === "none" || this.anchorElement.style?.visibility === "hidden" || this.anchorElement.style?.opacity === "0") {
          this.boxElement.classList.add("qr-hidden");
          return;
        }
      }
      const isTrackedMedia = this.anchorElement && (this.anchorElement.tagName === "IMG" || this.anchorElement.tagName === "VIDEO");
      if (isTrackedMedia && this.anchorElement.isConnected && this.anchorOffset) {
        const rect = this.anchorElement.getBoundingClientRect();
        const scrollX = typeof window !== "undefined" ? window.pageXOffset || window.scrollX || 0 : 0;
        const scrollY = typeof window !== "undefined" ? window.pageYOffset || window.scrollY || 0 : 0;
        const docLeft = this.isFixed ? rect.left : rect.left + scrollX;
        const docTop = this.isFixed ? rect.top : rect.top + scrollY;
        if (docLeft === this.lastDocLeft && docTop === this.lastDocTop && rect.width === this.lastDocWidth && rect.height === this.lastDocHeight) {
          return;
        }
        this.lastDocLeft = docLeft;
        this.lastDocTop = docTop;
        this.lastDocWidth = rect.width;
        this.lastDocHeight = rect.height;
        const pos = resolveAnchorPosition(this.anchorElement, this.anchorOffset);
        if (pos) {
          const targetX = this.isFixed ? pos.x : pos.docX;
          const targetY = this.isFixed ? pos.y : pos.docY;
          this.applyPosition(targetX, targetY, pos.width, pos.height, pos.isVisible, this.isFixed);
        }
      }
    }
    /**
     * Scroll compensation for this box.
     */
    onScroll() {
      if (!this.boxElement || this.boxElement.classList.contains("qr-hidden")) {
        return;
      }
      if (this.hudCard && this.lastY !== null) {
        const scrollY = typeof window !== "undefined" ? window.pageYOffset || window.scrollY || 0 : 0;
        const viewportY = this.isFixed ? this.lastY : this.lastY - scrollY;
        const spaceBelow = (typeof window !== "undefined" ? window.innerHeight : 1080) - (viewportY + (this.lastHeight || 0));
        const isFlipped = this.hudCard.classList.contains("qr-flipped");
        if (isFlipped) {
          if (spaceBelow > 220) {
            this.hudCard.classList.remove("qr-flipped");
          }
        } else {
          if (spaceBelow < 140) {
            this.hudCard.classList.add("qr-flipped");
          }
        }
      }
    }
    /**
     * Renders the interactive contents of the HUD card.
     * @param {string} text
     */
    renderCardContent(text) {
      const parsed = classifyContent(text);
      let actionBtnHtml = "";
      if (parsed.type === "url" && parsed.actionUrl) {
        actionBtnHtml = `
        <a href="${escapeHtml(parsed.actionUrl)}" target="_blank" rel="noopener noreferrer" class="qr-btn qr-btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          Open Link
        </a>
      `;
      }
      this.hudCard.innerHTML = `
      <div class="qr-radar-hud-header">
        <span class="qr-radar-type-badge qr-badge-${parsed.type}">${parsed.type}</span>
        <span style="font-size: 11px; color: #8b949e;">${escapeHtml(parsed.title)}</span>
      </div>
      <div class="qr-radar-hud-body">
        ${escapeHtml(parsed.summary)}
      </div>
      <div class="qr-radar-hud-actions">
        <button class="qr-btn qr-btn-secondary qr-copy-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span class="qr-copy-label">Copy</span>
        </button>
        ${actionBtnHtml}
      </div>
    `;
      const copyBtn = this.hudCard.querySelector(".qr-copy-btn");
      if (copyBtn) {
        copyBtn.addEventListener("click", (e2) => {
          e2.stopPropagation();
          if (this.callbacks.copy) {
            this.callbacks.copy(text, copyBtn);
          }
        });
      }
      if (this.miniBadge) {
        const typeLabels = {
          url: "URL",
          wifi: "WiFi",
          email: "Mail",
          phone: "Tel",
          sms: "SMS",
          geo: "Geo",
          text: "Text"
        };
        const typeText = typeLabels[parsed.type] || "QR";
        const typeSpan = this.miniBadge.querySelector(".qr-mini-type");
        if (typeSpan) typeSpan.textContent = typeText;
        this.miniBadge.className = `qr-radar-mini-badge qr-mini-${parsed.type}`;
      }
    }
    /**
     * Destroys tracker DOM element.
     */
    destroy() {
      if (this.boxElement && this.boxElement.parentNode) {
        this.boxElement.parentNode.removeChild(this.boxElement);
      }
      this.boxElement = null;
      this.hudCard = null;
      this.miniBadge = null;
      this.anchorElement = null;
      this.anchorOffset = null;
    }
  };
  var QROverlayManager = class {
    constructor(options = {}) {
      this.options = {
        soundEnabled: false,
        autoCopy: false,
        themeColor: "gold",
        cardDisplayMode: "hover",
        glowAnimation: false,
        cornerBrackets: true,
        onStopRequested: () => {
        },
        ...options
      };
      this.root = null;
      this.trackers = /* @__PURE__ */ new Map();
      this.rafId = null;
      this.isScrolling = false;
      this.scrollTimer = null;
      this.audioCtx = null;
      this.lastChimeTime = 0;
      this.fullscreenHandler = null;
    }
    /**
     * Applies CSS classes for themes, display mode, and animations to root overlay.
     */
    applySettingsClasses() {
      if (!this.root) return;
      this.root.className = [
        `theme-${this.options.themeColor || "gold"}`,
        `mode-${this.options.cardDisplayMode || "hover"}`,
        this.options.glowAnimation === false ? "no-glow" : "",
        this.options.cornerBrackets === false ? "no-brackets" : ""
      ].filter(Boolean).join(" ");
    }
    /**
     * Updates customizable options dynamically.
     */
    updateSettings(newSettings) {
      this.options = { ...this.options, ...newSettings };
      this.applySettingsClasses();
      for (const tracker of this.trackers.values()) {
        tracker.options = { ...tracker.options, ...newSettings };
        if (tracker.lastDetectedText) {
          tracker.renderCardContent(tracker.lastDetectedText);
        }
      }
    }
    /**
     * Sets up fullscreen listeners to keep overlay visible inside video players in fullscreen mode (e.g. YouTube).
     */
    setupFullscreenListener() {
      if (this.fullscreenHandler || typeof document === "undefined") return;
      this.fullscreenHandler = () => {
        const target = document.fullscreenElement || document.documentElement || document.body;
        if (this.root && target && this.root.parentElement !== target) {
          target.appendChild(this.root);
        }
        for (const tracker of this.trackers.values()) {
          if (tracker.anchorElement) {
            tracker.lastDocLeft = null;
            tracker.lastDocTop = null;
          }
        }
      };
      document.addEventListener("fullscreenchange", this.fullscreenHandler);
      document.addEventListener("webkitfullscreenchange", this.fullscreenHandler);
    }
    /**
     * Initializes overlay DOM structure.
     */
    mount() {
      if (this.root && this.root.isConnected) return;
      if (!this.root) {
        this.root = document.createElement("div");
        this.root.id = "qr-radar-root";
        this.applySettingsClasses();
      }
      const mountTarget = document.fullscreenElement || document.documentElement || document.body;
      if (mountTarget && this.root.parentElement !== mountTarget) {
        mountTarget.appendChild(this.root);
      }
      this.setupFullscreenListener();
    }
    /**
     * Synchronizes detected items (from either DOM scanner or Screen capture).
     * Smart deduplication: keeps DOM anchor priority, prevents live & DOM fight.
     * @param {Array<{ data: string, location: any, element?: HTMLElement, isDom?: boolean }>} items
     * @param {'dom' | 'screen'} source
     */
    syncTrackers(items, source) {
      if (!this.root) this.mount();
      const matchedTrackerIds = /* @__PURE__ */ new Set();
      for (const item of items) {
        if (!item || !item.data || !item.location) continue;
        const itemBounds = computeBounds(item.location);
        let matchedTracker = null;
        for (const tracker of this.trackers.values()) {
          const isSameText = tracker.lastDetectedText === item.data;
          const isNear = tracker.cachedBounds && areBoundsNear(tracker.cachedBounds, itemBounds, 90);
          if (isSameText || isNear) {
            matchedTracker = tracker;
            break;
          }
        }
        if (matchedTracker) {
          matchedTrackerIds.add(matchedTracker.id);
          if (matchedTracker.isDomLocked && source === "screen") {
            matchedTracker.missingFrames = 0;
          } else {
            matchedTracker.update(item.location, item.data, item.element || null, source === "dom");
          }
        } else {
          const trackerId = `qr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const tracker = new QRBoxTracker(trackerId, this.root, this.options, {
            onNew: (text) => this.onNewQRAcquired(text),
            copy: (text, btn) => this.copyToClipboard(text, btn)
          });
          tracker.update(item.location, item.data, item.element || null, source === "dom");
          this.trackers.set(trackerId, tracker);
          matchedTrackerIds.add(trackerId);
        }
      }
      for (const [id, tracker] of this.trackers.entries()) {
        if (!matchedTrackerIds.has(id)) {
          if (source === "dom" && !tracker.isDomLocked) {
            continue;
          }
          if (source === "screen" && tracker.isDomLocked) {
            if (tracker.anchorElement && isElementInViewport(tracker.anchorElement)) {
              continue;
            }
          }
          tracker.missingFrames++;
          if (tracker.missingFrames >= 2 && tracker.boxElement) {
            tracker.boxElement.classList.add("qr-hidden");
          }
          if (tracker.missingFrames > 5) {
            tracker.destroy();
            this.trackers.delete(id);
          }
        }
      }
      if (this.trackers.size > 0) {
        this.startTrackingLoop();
      } else {
        this.stopTrackingLoop();
      }
    }
    /**
     * Updates from full screen screenshot capture.
     * @param {any[]} qrResults
     * @param {number} scanWidth
     * @param {number} scanHeight
     */
    updateFromScreen(qrResults, scanWidth, scanHeight) {
      if (this.isScrolling) {
        return;
      }
      if (!qrResults || !Array.isArray(qrResults) || qrResults.length === 0) {
        this.onScreenQrNotFound();
        return;
      }
      const scaleX = window.innerWidth / scanWidth;
      const scaleY = window.innerHeight / scanHeight;
      const items = qrResults.map((qr) => {
        const rawLoc = qr.location;
        const location = {
          topLeftCorner: { x: rawLoc.topLeftCorner.x * scaleX, y: rawLoc.topLeftCorner.y * scaleY },
          topRightCorner: { x: rawLoc.topRightCorner.x * scaleX, y: rawLoc.topRightCorner.y * scaleY },
          bottomRightCorner: { x: rawLoc.bottomRightCorner.x * scaleX, y: rawLoc.bottomRightCorner.y * scaleY },
          bottomLeftCorner: { x: rawLoc.bottomLeftCorner.x * scaleX, y: rawLoc.bottomLeftCorner.y * scaleY }
        };
        return {
          data: qr.data,
          location,
          isDom: false
        };
      });
      this.syncTrackers(items, "screen");
    }
    /**
     * Updates from in-page DOM image scanning.
     * @param {Array<{ data: string, location: any, element: HTMLElement }>} domResults
     */
    updateFromDom(domResults) {
      if (!domResults || !Array.isArray(domResults)) return;
      this.syncTrackers(domResults, "dom");
    }
    /**
     * Called when screen capture found 0 QR codes.
     * Does NOT wipe DOM-anchored images that are still visible!
     */
    onScreenQrNotFound() {
      for (const [id, tracker] of this.trackers.entries()) {
        if (tracker.isDomLocked) {
          continue;
        }
        tracker.missingFrames++;
        if (tracker.missingFrames >= 2 && tracker.boxElement) {
          tracker.boxElement.classList.add("qr-hidden");
        }
        if (tracker.missingFrames > 5) {
          tracker.destroy();
          this.trackers.delete(id);
        }
      }
    }
    /**
     * Legacy single-QR update bridge.
     * @param {any} qrResult
     * @param {number} [scaleX=1]
     * @param {number} [scaleY=1]
     * @param {HTMLElement} [knownAnchor=null]
     */
    update(qrResult, scaleX = 1, scaleY = 1, knownAnchor = null) {
      if (!qrResult) {
        this.onScreenQrNotFound();
        return;
      }
      if (knownAnchor) {
        this.updateFromDom([{
          data: qrResult.data,
          location: qrResult.location,
          element: knownAnchor,
          isDom: true
        }]);
      } else {
        const scanWidth = window.innerWidth / scaleX;
        const scanHeight = window.innerHeight / scaleY;
        this.updateFromScreen([qrResult], scanWidth, scanHeight);
      }
    }
    /**
     * 60/120 FPS Real-time scroll compensation across all active trackers.
     */
    onScroll() {
      this.isScrolling = true;
      if (this.scrollTimer) clearTimeout(this.scrollTimer);
      this.scrollTimer = setTimeout(() => {
        this.isScrolling = false;
      }, 130);
      for (const tracker of this.trackers.values()) {
        tracker.onScroll();
      }
    }
    /**
     * Triggered when a new QR code is acquired.
     * @param {string} text
     */
    onNewQRAcquired(text) {
      const parsed = classifyContent(text);
      addScanHistory({
        text,
        type: parsed.type,
        title: parsed.title
      }).catch(() => {
      });
      const now = Date.now();
      if (this.options.soundEnabled && now - this.lastChimeTime > 250) {
        this.lastChimeTime = now;
        this.playChime();
      }
      if (this.options.autoCopy) {
        navigator.clipboard.writeText(text).catch(() => {
        });
      }
    }
    /**
     * Copies text to clipboard and updates button state.
     */
    async copyToClipboard(text, btn) {
      try {
        await navigator.clipboard.writeText(text);
        const label = btn.querySelector(".qr-copy-label");
        btn.classList.add("qr-btn-copied");
        if (label) label.textContent = "Copied! \u2713";
        setTimeout(() => {
          btn.classList.remove("qr-btn-copied");
          if (label) label.textContent = "Copy";
        }, 2e3);
      } catch (err) {
        console.warn("[QR-Radar] Clipboard write failed:", err);
      }
    }
    /**
     * Plays a subtle high-tech synth beep using Web Audio API.
     */
    playChime() {
      try {
        if (!this.audioCtx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.audioCtx = new AudioCtx();
        }
        if (!this.audioCtx) return;
        if (this.audioCtx.state === "suspended") {
          this.audioCtx.resume();
        }
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, this.audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.06, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(1e-3, this.audioCtx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.15);
      } catch {
      }
    }
    /**
     * Monitor refresh rate (60/120/144 Hz) position tracking loop.
     * Only active while visible trackers exist on screen (0% idle CPU).
     */
    startTrackingLoop() {
      if (this.rafId || typeof requestAnimationFrame === "undefined") return;
      const tick = () => {
        if (!this.root || this.trackers.size === 0) {
          this.rafId = null;
          return;
        }
        let activeCount = 0;
        for (const tracker of this.trackers.values()) {
          if (!tracker.boxElement || tracker.boxElement.classList.contains("qr-hidden")) {
            continue;
          }
          activeCount++;
          tracker.updateLivePosition();
        }
        if (activeCount > 0) {
          this.rafId = requestAnimationFrame(tick);
        } else {
          this.rafId = null;
        }
      };
      this.rafId = requestAnimationFrame(tick);
    }
    stopTrackingLoop() {
      if (this.rafId && typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
    /**
     * Unmounts overlay and cleans up all trackers.
     */
    unmount() {
      this.stopTrackingLoop();
      if (this.scrollTimer) {
        clearTimeout(this.scrollTimer);
        this.scrollTimer = null;
      }
      for (const tracker of this.trackers.values()) {
        tracker.destroy();
      }
      this.trackers.clear();
      if (this.fullscreenHandler && typeof document !== "undefined") {
        document.removeEventListener("fullscreenchange", this.fullscreenHandler);
        document.removeEventListener("webkitfullscreenchange", this.fullscreenHandler);
        this.fullscreenHandler = null;
      }
      if (this.root && this.root.parentNode) {
        this.root.parentNode.removeChild(this.root);
      }
      this.root = null;
      this.isScrolling = false;
    }
  };
  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  // test/test-bench.js
  async function renderSampleQRs() {
    const urlCanvas = document.getElementById("qr-url");
    if (urlCanvas) {
      await import_qrcode.default.toCanvas(urlCanvas, "https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions", {
        width: 180,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" }
      });
    }
    const wifiCanvas = document.getElementById("qr-wifi");
    if (wifiCanvas) {
      await import_qrcode.default.toCanvas(wifiCanvas, "WIFI:S:Quantum_Lab;T:WPA;P:Hexa9918Secret;H:false;;", {
        width: 180,
        margin: 2,
        color: { dark: "#0a192f", light: "#ffffff" }
      });
    }
    const phoneCanvas = document.getElementById("qr-phone");
    if (phoneCanvas) {
      await import_qrcode.default.toCanvas(phoneCanvas, "tel:+18005550199", {
        width: 180,
        margin: 2,
        color: { dark: "#111827", light: "#ffffff" }
      });
    }
    const smallImg = document.getElementById("qr-small-img");
    if (smallImg) {
      const dataUrl = await import_qrcode.default.toDataURL("https://github.com/ZloyRadetski/live-qr-extension/tiny-dom-qr-test", {
        width: 220,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" }
      });
      smallImg.src = dataUrl;
    }
    const multi1 = document.getElementById("multi-qr-1");
    if (multi1) {
      multi1.src = await import_qrcode.default.toDataURL("https://github.com", {
        width: 200,
        margin: 2,
        color: { dark: "#1e293b", light: "#ffffff" }
      });
    }
    const multi2 = document.getElementById("multi-qr-2");
    if (multi2) {
      await import_qrcode.default.toCanvas(multi2, "mailto:test@radar.io", {
        width: 140,
        margin: 2,
        color: { dark: "#047857", light: "#ffffff" }
      });
    }
    const multi3 = document.getElementById("multi-qr-3");
    if (multi3) {
      multi3.src = await import_qrcode.default.toDataURL("smsto:+123456789", {
        width: 200,
        margin: 2,
        color: { dark: "#6b21a8", light: "#ffffff" }
      });
    }
  }
  async function setupCustomGenerator() {
    const input = document.getElementById("custom-text");
    const btn = document.getElementById("generate-btn");
    const canvas = document.getElementById("custom-qr-canvas");
    if (!input || !btn || !canvas) return;
    async function generate() {
      const text = input.value.trim() || "https://github.com/ZloyRadetski/live-qr-extension";
      await import_qrcode.default.toCanvas(canvas, text, {
        width: 200,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" }
      });
    }
    btn.addEventListener("click", generate);
    input.addEventListener("keydown", (e2) => {
      if (e2.key === "Enter") generate();
    });
    generate();
  }
  async function setupAnimatedCanvas() {
    const canvas = document.getElementById("moving-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const offscreenCanvas = document.createElement("canvas");
    await import_qrcode.default.toCanvas(offscreenCanvas, "https://github.com/ZloyRadetski/live-qr-extension/realtime-radar-moving", {
      width: 140,
      margin: 2
    });
    let angle = 0;
    let posX = 100;
    let direction = 1;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      for (let x2 = 0; x2 < canvas.width; x2 += 30) {
        ctx.beginPath();
        ctx.moveTo(x2, 0);
        ctx.lineTo(x2, canvas.height);
        ctx.stroke();
      }
      for (let y2 = 0; y2 < canvas.height; y2 += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y2);
        ctx.lineTo(canvas.width, y2);
        ctx.stroke();
      }
      posX += direction * 0.8;
      if (posX > canvas.width - 160 || posX < 40) {
        direction *= -1;
      }
      angle += 6e-3;
      ctx.save();
      ctx.translate(posX + 70, 130);
      ctx.rotate(angle);
      ctx.drawImage(offscreenCanvas, -70, -70);
      ctx.restore();
      requestAnimationFrame(animate);
    }
    animate();
  }
  function setupInPageSimulation() {
    const simBtn = document.getElementById("simulate-hud-btn");
    if (!simBtn) return;
    simBtn.addEventListener("click", () => {
      const existing = document.getElementById("qr-radar-root");
      if (existing) {
        existing.remove();
        simBtn.textContent = "Simulate HUD Overlay";
        return;
      }
      simBtn.textContent = "Hide Simulated HUD";
      const overlay = new QROverlayManager({
        soundEnabled: true,
        autoCopy: false,
        onStopRequested: () => {
          overlay.unmount();
          simBtn.textContent = "Simulate HUD Overlay";
        }
      });
      overlay.mount();
      const sample = document.getElementById("qr-url");
      if (sample) {
        const rect = sample.getBoundingClientRect();
        const mockResult = {
          data: "https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions",
          location: {
            topLeftCorner: { x: rect.left, y: rect.top },
            topRightCorner: { x: rect.right, y: rect.top },
            bottomRightCorner: { x: rect.right, y: rect.bottom },
            bottomLeftCorner: { x: rect.left, y: rect.bottom }
          }
        };
        overlay.update(mockResult, 1, 1);
      }
    });
  }
  async function setupBlinkingTest() {
    const img = document.getElementById("blinking-qr-img");
    const canvas = document.getElementById("blinking-qr-canvas");
    const toggleBtn = document.getElementById("toggle-blink-manual");
    const autoBtn = document.getElementById("toggle-blink-auto");
    const intervalSelect = document.getElementById("blink-interval-select");
    const modeSelect = document.getElementById("blink-mode-select");
    const statusBadge = document.getElementById("blink-status-badge");
    const statsSpan = document.getElementById("blink-stats");
    if (!img || !canvas || !toggleBtn) return;
    const dataUrl = await import_qrcode.default.toDataURL("https://github.com/ZloyRadetski/live-qr-extension/blink-test-img", {
      width: 200,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" }
    });
    img.src = dataUrl;
    const offscreen = document.createElement("canvas");
    offscreen.width = 150;
    offscreen.height = 150;
    await import_qrcode.default.toCanvas(offscreen, "https://github.com/ZloyRadetski/live-qr-extension/blink-test-canvas", {
      width: 150,
      margin: 2,
      color: { dark: "#031326", light: "#ffffff" }
    });
    const ctx = canvas.getContext("2d");
    function drawCanvasQR() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
    }
    function clearCanvasQR() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    drawCanvasQR();
    let isVisible = true;
    let toggleCount = 0;
    let autoTimer = null;
    let autoRunning = true;
    function setVisibleState(visible, mode) {
      isVisible = visible;
      toggleCount++;
      if (statsSpan) statsSpan.textContent = `\u041F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0439: ${toggleCount}`;
      if (statusBadge) {
        if (visible) {
          statusBadge.style.background = "rgba(56, 239, 125, 0.15)";
          statusBadge.style.color = "#38ef7d";
          statusBadge.style.borderColor = "rgba(56, 239, 125, 0.3)";
          statusBadge.innerHTML = `<span style="width: 7px; height: 7px; border-radius: 50%; background: #38ef7d; box-shadow: 0 0 8px #38ef7d;"></span> STATUS: VISIBLE`;
        } else {
          statusBadge.style.background = "rgba(239, 68, 68, 0.15)";
          statusBadge.style.color = "#ef4444";
          statusBadge.style.borderColor = "rgba(239, 68, 68, 0.3)";
          statusBadge.innerHTML = `<span style="width: 7px; height: 7px; border-radius: 50%; background: #ef4444;"></span> STATUS: HIDDEN`;
        }
      }
      img.style.display = "";
      img.style.visibility = "";
      img.style.opacity = "";
      canvas.style.display = "";
      canvas.style.visibility = "";
      canvas.style.opacity = "";
      if (visible) {
        drawCanvasQR();
      } else {
        if (mode === "display") {
          img.style.display = "none";
          canvas.style.display = "none";
        } else if (mode === "visibility") {
          img.style.visibility = "hidden";
          canvas.style.visibility = "hidden";
        } else if (mode === "opacity") {
          img.style.opacity = "0";
          canvas.style.opacity = "0";
        } else if (mode === "clear") {
          clearCanvasQR();
          img.style.display = "none";
        }
      }
    }
    function toggle() {
      const mode = modeSelect ? modeSelect.value : "display";
      setVisibleState(!isVisible, mode);
    }
    function restartAutoBlink() {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
      if (!autoRunning) return;
      const interval = parseInt(intervalSelect ? intervalSelect.value : "1000", 10) || 1e3;
      autoTimer = setInterval(toggle, interval);
    }
    toggleBtn.addEventListener("click", () => {
      autoRunning = false;
      if (autoBtn) autoBtn.textContent = "Auto-Blink: OFF";
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
      toggle();
    });
    if (autoBtn) {
      autoBtn.addEventListener("click", () => {
        autoRunning = !autoRunning;
        autoBtn.textContent = autoRunning ? "Auto-Blink: ON" : "Auto-Blink: OFF";
        if (autoRunning) {
          restartAutoBlink();
        } else if (autoTimer) {
          clearInterval(autoTimer);
          autoTimer = null;
        }
      });
    }
    if (intervalSelect) {
      intervalSelect.addEventListener("change", () => {
        if (autoRunning) restartAutoBlink();
      });
    }
    if (modeSelect) {
      modeSelect.addEventListener("change", () => {
        setVisibleState(isVisible, modeSelect.value);
      });
    }
    restartAutoBlink();
  }
  async function setupVideoStreamTest() {
    const video = document.getElementById("test-video-player");
    const toggleQrBtn = document.getElementById("toggle-video-qr-btn");
    const playBtn = document.getElementById("toggle-video-play-btn");
    const statusBadge = document.getElementById("video-status-badge");
    if (!video) return;
    const qrCanvas = document.createElement("canvas");
    qrCanvas.width = 160;
    qrCanvas.height = 160;
    await import_qrcode.default.toCanvas(qrCanvas, "https://github.com/ZloyRadetski/live-qr-extension/live-video-stream-qr", {
      width: 160,
      margin: 2,
      color: { dark: "#031326", light: "#ffffff" }
    });
    const streamCanvas = document.createElement("canvas");
    streamCanvas.width = 320;
    streamCanvas.height = 220;
    const ctx = streamCanvas.getContext("2d");
    let showQr = true;
    let isPlaying = true;
    let frameCount = 0;
    function renderVideoFrame() {
      frameCount++;
      ctx.fillStyle = "#060913";
      ctx.fillRect(0, 0, streamCanvas.width, streamCanvas.height);
      ctx.strokeStyle = "rgba(0, 240, 255, 0.15)";
      ctx.lineWidth = 1;
      const offset = frameCount * 0.8 % 20;
      for (let x2 = offset; x2 < streamCanvas.width; x2 += 20) {
        ctx.beginPath();
        ctx.moveTo(x2, 0);
        ctx.lineTo(x2, streamCanvas.height);
        ctx.stroke();
      }
      for (let y2 = offset; y2 < streamCanvas.height; y2 += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y2);
        ctx.lineTo(streamCanvas.width, y2);
        ctx.stroke();
      }
      ctx.fillStyle = "#38bdf8";
      ctx.font = "11px sans-serif";
      ctx.fillText(`REC \u25CF LIVE STREAM [FRAME ${frameCount}]`, 12, 22);
      if (showQr) {
        ctx.drawImage(qrCanvas, 80, 40, 160, 160);
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.fillRect(80, 40, 160, 160);
        ctx.fillStyle = "#8b949e";
        ctx.font = "13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("[QR HIDDEN IN STREAM]", 160, 125);
        ctx.textAlign = "start";
      }
      if (isPlaying) {
        requestAnimationFrame(renderVideoFrame);
      }
    }
    try {
      if (streamCanvas.captureStream) {
        const stream = streamCanvas.captureStream(30);
        video.srcObject = stream;
        video.play().catch(() => {
        });
      }
    } catch (err) {
      console.warn("[TestBench] Video captureStream error:", err);
    }
    renderVideoFrame();
    if (toggleQrBtn) {
      toggleQrBtn.addEventListener("click", () => {
        showQr = !showQr;
        toggleQrBtn.textContent = showQr ? "Toggle QR in Video (\u0421\u043A\u0440\u044B\u0442\u044C)" : "Toggle QR in Video (\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C)";
      });
    }
    if (playBtn) {
      playBtn.addEventListener("click", () => {
        isPlaying = !isPlaying;
        playBtn.textContent = isPlaying ? "Pause Stream" : "Resume Stream";
        if (statusBadge) {
          if (isPlaying) {
            statusBadge.style.background = "rgba(56, 189, 248, 0.15)";
            statusBadge.style.color = "#38bdf8";
            statusBadge.style.borderColor = "rgba(56, 189, 248, 0.3)";
            statusBadge.innerHTML = `<span style="width: 7px; height: 7px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 8px #38bdf8;"></span> VIDEO: STREAMING`;
            renderVideoFrame();
            video.play().catch(() => {
            });
          } else {
            statusBadge.style.background = "rgba(234, 179, 8, 0.15)";
            statusBadge.style.color = "#eab308";
            statusBadge.style.borderColor = "rgba(234, 179, 8, 0.3)";
            statusBadge.innerHTML = `<span style="width: 7px; height: 7px; border-radius: 50%; background: #eab308;"></span> VIDEO: PAUSED`;
            video.pause();
          }
        }
      });
    }
  }
  function initTestBench() {
    renderSampleQRs();
    setupCustomGenerator();
    setupAnimatedCanvas();
    setupBlinkingTest();
    setupVideoStreamTest();
    setupInPageSimulation();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTestBench);
  } else {
    initTestBench();
  }
})();
