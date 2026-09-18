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
    } catch (e) {
      throw mod = 0, e;
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
      exports.setToSJISFunction = function setToSJISFunction(f) {
        if (typeof f !== "function") {
          throw new Error('"toSJISFunc" is not a valid function.');
        }
        toSJISFunction = f;
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
        } catch (e) {
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
          for (let i = 0; i < length; i++) {
            this.putBit((num >>> length - i - 1 & 1) === 1);
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
        for (let i = 1; i < posCount - 1; i++) {
          positions[i] = positions[i - 1] - intervals;
        }
        positions.push(6);
        return positions.reverse();
      };
      exports.getPositions = function getPositions(version) {
        const coords = [];
        const pos = exports.getRowColCoords(version);
        const posLength = pos.length;
        for (let i = 0; i < posLength; i++) {
          for (let j = 0; j < posLength; j++) {
            if (i === 0 && j === 0 || // top-left
            i === 0 && j === posLength - 1 || // bottom-left
            i === posLength - 1 && j === 0) {
              continue;
            }
            coords.push([pos[i], pos[j]]);
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
        for (let i = 0; i < modulesCount; i++) darkCount += data.data[i];
        const k = Math.abs(Math.ceil(darkCount * 100 / modulesCount / 5) - 10);
        return k * PenaltyScores.N4;
      };
      function getMaskAt(maskPattern, i, j) {
        switch (maskPattern) {
          case exports.Patterns.PATTERN000:
            return (i + j) % 2 === 0;
          case exports.Patterns.PATTERN001:
            return i % 2 === 0;
          case exports.Patterns.PATTERN010:
            return j % 3 === 0;
          case exports.Patterns.PATTERN011:
            return (i + j) % 3 === 0;
          case exports.Patterns.PATTERN100:
            return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
          case exports.Patterns.PATTERN101:
            return i * j % 2 + i * j % 3 === 0;
          case exports.Patterns.PATTERN110:
            return (i * j % 2 + i * j % 3) % 2 === 0;
          case exports.Patterns.PATTERN111:
            return (i * j % 3 + (i + j) % 2) % 2 === 0;
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
        for (let p = 0; p < numPatterns; p++) {
          setupFormatFunc(p);
          exports.applyMask(p, data);
          const penalty = exports.getPenaltyN1(data) + exports.getPenaltyN2(data) + exports.getPenaltyN3(data) + exports.getPenaltyN4(data);
          exports.applyMask(p, data);
          if (penalty < lowerPenalty) {
            lowerPenalty = penalty;
            bestPattern = p;
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
        let x = 1;
        for (let i = 0; i < 255; i++) {
          EXP_TABLE[i] = x;
          LOG_TABLE[x] = i;
          x <<= 1;
          if (x & 256) {
            x ^= 285;
          }
        }
        for (let i = 255; i < 512; i++) {
          EXP_TABLE[i] = EXP_TABLE[i - 255];
        }
      })();
      exports.log = function log(n) {
        if (n < 1) throw new Error("log(" + n + ")");
        return LOG_TABLE[n];
      };
      exports.exp = function exp(n) {
        return EXP_TABLE[n];
      };
      exports.mul = function mul(x, y) {
        if (x === 0 || y === 0) return 0;
        return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
      };
    }
  });

  // node_modules/qrcode/lib/core/polynomial.js
  var require_polynomial = __commonJS({
    "node_modules/qrcode/lib/core/polynomial.js"(exports) {
      var GF = require_galois_field();
      exports.mul = function mul(p1, p2) {
        const coeff = new Uint8Array(p1.length + p2.length - 1);
        for (let i = 0; i < p1.length; i++) {
          for (let j = 0; j < p2.length; j++) {
            coeff[i + j] ^= GF.mul(p1[i], p2[j]);
          }
        }
        return coeff;
      };
      exports.mod = function mod(divident, divisor) {
        let result = new Uint8Array(divident);
        while (result.length - divisor.length >= 0) {
          const coeff = result[0];
          for (let i = 0; i < divisor.length; i++) {
            result[i] ^= GF.mul(divisor[i], coeff);
          }
          let offset = 0;
          while (offset < result.length && result[offset] === 0) offset++;
          result = result.slice(offset);
        }
        return result;
      };
      exports.generateECPolynomial = function generateECPolynomial(degree) {
        let poly = new Uint8Array([1]);
        for (let i = 0; i < degree; i++) {
          poly = exports.mul(poly, new Uint8Array([1, GF.exp(i)]));
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
        } catch (e) {
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
        let d = version << 12;
        while (Utils.getBCHDigit(d) - G18_BCH >= 0) {
          d ^= G18 << Utils.getBCHDigit(d) - G18_BCH;
        }
        return version << 12 | d;
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
        let d = data << 10;
        while (Utils.getBCHDigit(d) - G15_BCH >= 0) {
          d ^= G15 << Utils.getBCHDigit(d) - G15_BCH;
        }
        return (data << 10 | d) ^ G15_MASK;
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
        let i, group, value;
        for (i = 0; i + 3 <= this.data.length; i += 3) {
          group = this.data.substr(i, 3);
          value = parseInt(group, 10);
          bitBuffer.put(value, 10);
        }
        const remainingNum = this.data.length - i;
        if (remainingNum > 0) {
          group = this.data.substr(i);
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
        let i;
        for (i = 0; i + 2 <= this.data.length; i += 2) {
          let value = ALPHA_NUM_CHARS.indexOf(this.data[i]) * 45;
          value += ALPHA_NUM_CHARS.indexOf(this.data[i + 1]);
          bitBuffer.put(value, 11);
        }
        if (this.data.length % 2) {
          bitBuffer.put(ALPHA_NUM_CHARS.indexOf(this.data[i]), 6);
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
        for (let i = 0, l = this.data.length; i < l; i++) {
          bitBuffer.put(this.data[i], 8);
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
        let i;
        for (i = 0; i < this.data.length; i++) {
          let value = Utils.toSJIS(this.data[i]);
          if (value >= 33088 && value <= 40956) {
            value -= 33088;
          } else if (value >= 57408 && value <= 60351) {
            value -= 49472;
          } else {
            throw new Error(
              "Invalid SJIS character: " + this.data[i] + "\nMake sure your charset is UTF-8"
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
        single_source_shortest_paths: function(graph, s, d) {
          var predecessors = {};
          var costs = {};
          costs[s] = 0;
          var open = dijkstra.PriorityQueue.make();
          open.push(s, 0);
          var closest, u, v, cost_of_s_to_u, adjacent_nodes, cost_of_e, cost_of_s_to_u_plus_cost_of_e, cost_of_s_to_v, first_visit;
          while (!open.empty()) {
            closest = open.pop();
            u = closest.value;
            cost_of_s_to_u = closest.cost;
            adjacent_nodes = graph[u] || {};
            for (v in adjacent_nodes) {
              if (adjacent_nodes.hasOwnProperty(v)) {
                cost_of_e = adjacent_nodes[v];
                cost_of_s_to_u_plus_cost_of_e = cost_of_s_to_u + cost_of_e;
                cost_of_s_to_v = costs[v];
                first_visit = typeof costs[v] === "undefined";
                if (first_visit || cost_of_s_to_v > cost_of_s_to_u_plus_cost_of_e) {
                  costs[v] = cost_of_s_to_u_plus_cost_of_e;
                  open.push(v, cost_of_s_to_u_plus_cost_of_e);
                  predecessors[v] = u;
                }
              }
            }
          }
          if (typeof d !== "undefined" && typeof costs[d] === "undefined") {
            var msg = ["Could not find a path from ", s, " to ", d, "."].join("");
            throw new Error(msg);
          }
          return predecessors;
        },
        extract_shortest_path_from_predecessor_list: function(predecessors, d) {
          var nodes = [];
          var u = d;
          var predecessor;
          while (u) {
            nodes.push(u);
            predecessor = predecessors[u];
            u = predecessors[u];
          }
          nodes.reverse();
          return nodes;
        },
        find_path: function(graph, s, d) {
          var predecessors = dijkstra.single_source_shortest_paths(graph, s, d);
          return dijkstra.extract_shortest_path_from_predecessor_list(
            predecessors,
            d
          );
        },
        /**
         * A very naive priority queue implementation.
         */
        PriorityQueue: {
          make: function(opts) {
            var T = dijkstra.PriorityQueue, t = {}, key;
            opts = opts || {};
            for (key in T) {
              if (T.hasOwnProperty(key)) {
                t[key] = T[key];
              }
            }
            t.queue = [];
            t.sorter = opts.sorter || T.default_sorter;
            return t;
          },
          default_sorter: function(a, b) {
            return a.cost - b.cost;
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
        for (let i = 0; i < segs.length; i++) {
          const seg = segs[i];
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
        for (let i = 0; i < nodes.length; i++) {
          const nodeGroup = nodes[i];
          const currentNodeIds = [];
          for (let j = 0; j < nodeGroup.length; j++) {
            const node = nodeGroup[j];
            const key = "" + i + j;
            currentNodeIds.push(key);
            table[key] = { node, lastCount: 0 };
            graph[key] = {};
            for (let n = 0; n < prevNodeIds.length; n++) {
              const prevNodeId = prevNodeIds[n];
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
        for (let n = 0; n < prevNodeIds.length; n++) {
          graph[prevNodeIds[n]].end = 0;
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
        for (let i = 1; i < path.length - 1; i++) {
          optimizedSegs.push(graph.table[path[i]].node);
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
        for (let i = 0; i < pos.length; i++) {
          const row = pos[i][0];
          const col = pos[i][1];
          for (let r = -1; r <= 7; r++) {
            if (row + r <= -1 || size <= row + r) continue;
            for (let c = -1; c <= 7; c++) {
              if (col + c <= -1 || size <= col + c) continue;
              if (r >= 0 && r <= 6 && (c === 0 || c === 6) || c >= 0 && c <= 6 && (r === 0 || r === 6) || r >= 2 && r <= 4 && c >= 2 && c <= 4) {
                matrix.set(row + r, col + c, true, true);
              } else {
                matrix.set(row + r, col + c, false, true);
              }
            }
          }
        }
      }
      function setupTimingPattern(matrix) {
        const size = matrix.size;
        for (let r = 8; r < size - 8; r++) {
          const value = r % 2 === 0;
          matrix.set(r, 6, value, true);
          matrix.set(6, r, value, true);
        }
      }
      function setupAlignmentPattern(matrix, version) {
        const pos = AlignmentPattern.getPositions(version);
        for (let i = 0; i < pos.length; i++) {
          const row = pos[i][0];
          const col = pos[i][1];
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              if (r === -2 || r === 2 || c === -2 || c === 2 || r === 0 && c === 0) {
                matrix.set(row + r, col + c, true, true);
              } else {
                matrix.set(row + r, col + c, false, true);
              }
            }
          }
        }
      }
      function setupVersionInfo(matrix, version) {
        const size = matrix.size;
        const bits = Version.getEncodedBits(version);
        let row, col, mod;
        for (let i = 0; i < 18; i++) {
          row = Math.floor(i / 3);
          col = i % 3 + size - 8 - 3;
          mod = (bits >> i & 1) === 1;
          matrix.set(row, col, mod, true);
          matrix.set(col, row, mod, true);
        }
      }
      function setupFormatInfo(matrix, errorCorrectionLevel, maskPattern) {
        const size = matrix.size;
        const bits = FormatInfo.getEncodedBits(errorCorrectionLevel, maskPattern);
        let i, mod;
        for (i = 0; i < 15; i++) {
          mod = (bits >> i & 1) === 1;
          if (i < 6) {
            matrix.set(i, 8, mod, true);
          } else if (i < 8) {
            matrix.set(i + 1, 8, mod, true);
          } else {
            matrix.set(size - 15 + i, 8, mod, true);
          }
          if (i < 8) {
            matrix.set(8, size - i - 1, mod, true);
          } else if (i < 9) {
            matrix.set(8, 15 - i - 1 + 1, mod, true);
          } else {
            matrix.set(8, 15 - i - 1, mod, true);
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
            for (let c = 0; c < 2; c++) {
              if (!matrix.isReserved(row, col - c)) {
                let dark = false;
                if (byteIndex < data.length) {
                  dark = (data[byteIndex] >>> bitIndex & 1) === 1;
                }
                matrix.set(row, col - c, dark);
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
        for (let i = 0; i < remainingByte; i++) {
          buffer.put(i % 2 ? 17 : 236, 8);
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
        for (let b = 0; b < ecTotalBlocks; b++) {
          const dataSize = b < blocksInGroup1 ? dataCodewordsInGroup1 : dataCodewordsInGroup2;
          dcData[b] = buffer.slice(offset, offset + dataSize);
          ecData[b] = rs.encode(dcData[b]);
          offset += dataSize;
          maxDataSize = Math.max(maxDataSize, dataSize);
        }
        const data = new Uint8Array(totalCodewords);
        let index = 0;
        let i, r;
        for (i = 0; i < maxDataSize; i++) {
          for (r = 0; r < ecTotalBlocks; r++) {
            if (i < dcData[r].length) {
              data[index++] = dcData[r][i];
            }
          }
        }
        for (i = 0; i < ecCount; i++) {
          for (r = 0; r < ecTotalBlocks; r++) {
            data[index++] = ecData[r][i];
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
          hexCode = Array.prototype.concat.apply([], hexCode.map(function(c) {
            return [c, c];
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
        for (let i = 0; i < symbolSize; i++) {
          for (let j = 0; j < symbolSize; j++) {
            let posDst = (i * symbolSize + j) * 4;
            let pxColor = opts.color.light;
            if (i >= scaledMargin && j >= scaledMargin && i < symbolSize - scaledMargin && j < symbolSize - scaledMargin) {
              const iSrc = Math.floor((i - scaledMargin) / scale);
              const jSrc = Math.floor((j - scaledMargin) / scale);
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
        } catch (e) {
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
      function svgCmd(cmd, x, y) {
        let str = cmd + x;
        if (typeof y !== "undefined") str += " " + y;
        return str;
      }
      function qrToPath(data, size, margin) {
        let path = "";
        let moveBy = 0;
        let newRow = false;
        let lineLength = 0;
        for (let i = 0; i < data.length; i++) {
          const col = Math.floor(i % size);
          const row = Math.floor(i / size);
          if (!col && !newRow) newRow = true;
          if (data[i]) {
            lineLength++;
            if (!(i > 0 && col > 0 && data[i - 1])) {
              path += newRow ? svgCmd("M", col + margin, 0.5 + row + margin) : svgCmd("m", moveBy, 0);
              moveBy = 0;
              newRow = false;
            }
            if (!(col + 1 < size && data[i + 1])) {
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
            } catch (e) {
              reject(e);
            }
          });
        }
        try {
          const data = QRCode2.create(text, opts);
          cb(null, renderFunc(data, canvas, opts));
        } catch (e) {
          cb(e);
        }
      }
      exports.create = QRCode2.create;
      exports.toCanvas = renderCanvas.bind(null, CanvasRenderer.render);
      exports.toDataURL = renderCanvas.bind(null, CanvasRenderer.renderToDataURL);
      exports.toString = renderCanvas.bind(null, function(data, _, opts) {
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
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
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
    const updated = [newEntry, ...history.filter((h) => h.text !== item.text)].slice(0, 50);
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
    const nonBody = candidates.filter((el) => el.tagName !== "BODY" && el.tagName !== "HTML");
    if (nonBody.length > 0) {
      nonBody.sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return ra.width * ra.height - rb.width * rb.height;
      });
      return nonBody[0];
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
  function resolveAnchorPosition(anchorEl, offset, viewport) {
    if (!anchorEl || typeof anchorEl.isConnected === "boolean" && !anchorEl.isConnected) {
      return null;
    }
    const vw = viewport?.innerWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1920);
    const vh = viewport?.innerHeight ?? (typeof window !== "undefined" ? window.innerHeight : 1080);
    const rect = anchorEl.getBoundingClientRect();
    let x, y, width, height;
    if (offset.relX !== void 0 && offset.initialWidth > 0 && Math.abs(rect.width - offset.initialWidth) > 1.5) {
      width = rect.width * offset.relW;
      height = rect.height * offset.relH;
      x = rect.left + rect.width * offset.relX;
      y = rect.top + rect.height * offset.relY;
    } else {
      x = rect.left + offset.offsetX;
      y = rect.top + offset.offsetY;
      width = offset.width;
      height = offset.height;
    }
    const isVisible = y + height >= -10 && y <= vh + 10 && x + width >= -10 && x <= vw + 10;
    return {
      x,
      y,
      width,
      height,
      isVisible
    };
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
      this.lastDetectedText = null;
      this.anchorElement = null;
      this.anchorOffset = null;
      this.docBounds = null;
      this.isDomLocked = false;
      this.missingFrames = 0;
      this.maxMissingFrames = 8;
      this.lastWidth = 0;
      this.lastHeight = 0;
      this.lastAnchorRectLeft = null;
      this.lastAnchorRectTop = null;
      this.lastAnchorRectWidth = null;
      this.lastAnchorRectHeight = null;
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
      this.currentLocation = isDom ? targetLoc : lerpLocation(this.currentLocation, targetLoc, 0.45);
      const bounds = computeBounds(this.currentLocation);
      if (!this.anchorElement || !this.anchorElement.isConnected) {
        this.anchorElement = anchorEl || findAnchorElement(bounds.centerX, bounds.centerY);
      }
      this.anchorOffset = computeAnchorOffset(this.anchorElement, bounds);
      this.docBounds = {
        docX: bounds.minX + window.scrollX,
        docY: bounds.minY + window.scrollY,
        width: bounds.width,
        height: bounds.height
      };
      this.applyPosition(bounds.minX, bounds.minY, bounds.width, bounds.height, true);
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
    applyPosition(x, y, width, height, isVisible) {
      if (!this.boxElement) return;
      if (!isVisible) {
        this.boxElement.style.visibility = "hidden";
        return;
      }
      this.boxElement.style.visibility = "visible";
      const rx = Math.round(x * 10) / 10;
      const ry = Math.round(y * 10) / 10;
      this.boxElement.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      if (width > 0 && this.lastWidth !== width) {
        this.lastWidth = width;
        this.boxElement.style.width = `${Math.round(width)}px`;
      }
      if (height > 0 && this.lastHeight !== height) {
        this.lastHeight = height;
        this.boxElement.style.height = `${Math.round(height)}px`;
      }
      const spaceBelow = window.innerHeight - (y + height);
      if (spaceBelow < 180) {
        this.hudCard.classList.add("qr-flipped");
      } else {
        this.hudCard.classList.remove("qr-flipped");
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
      if (this.anchorElement && this.anchorElement.isConnected && this.anchorOffset) {
        const rect = this.anchorElement.getBoundingClientRect();
        if (rect.left === this.lastAnchorRectLeft && rect.top === this.lastAnchorRectTop && rect.width === this.lastAnchorRectWidth && rect.height === this.lastAnchorRectHeight) {
          return;
        }
        this.lastAnchorRectLeft = rect.left;
        this.lastAnchorRectTop = rect.top;
        this.lastAnchorRectWidth = rect.width;
        this.lastAnchorRectHeight = rect.height;
        const pos = resolveAnchorPosition(this.anchorElement, this.anchorOffset);
        if (pos) {
          this.applyPosition(pos.x, pos.y, pos.width, pos.height, pos.isVisible);
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
      if (this.anchorElement && this.anchorElement.isConnected && this.anchorOffset) {
        const pos = resolveAnchorPosition(this.anchorElement, this.anchorOffset);
        if (pos) {
          this.applyPosition(pos.x, pos.y, pos.width, pos.height, pos.isVisible);
          return;
        }
      }
      if (this.docBounds) {
        const currentViewportX = this.docBounds.docX - window.scrollX;
        const currentViewportY = this.docBounds.docY - window.scrollY;
        const isOut = currentViewportY + this.docBounds.height < -10 || currentViewportY > window.innerHeight + 10 || currentViewportX + this.docBounds.width < -10 || currentViewportX > window.innerWidth + 10;
        this.applyPosition(currentViewportX, currentViewportY, this.docBounds.width, this.docBounds.height, !isOut);
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
      const fps = this.options.scanRate || 12;
      this.hudCard.innerHTML = `
      <div class="qr-radar-hud-header">
        <span class="qr-radar-type-badge qr-badge-${parsed.type}">${parsed.type}</span>
        <span style="font-size: 11px; color: #8b949e;">${escapeHtml(parsed.title)}</span>
        <span class="qr-radar-fps-pill" title="Scan Speed">${fps} FPS</span>
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
        copyBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this.callbacks.copy) {
            this.callbacks.copy(text, copyBtn);
          }
        });
      }
      if (this.miniBadge) {
        const typeLabels = {
          url: "\u{1F517} LINK",
          wifi: "\u{1F4F6} WIFI",
          email: "\u{1F4E7} EMAIL",
          phone: "\u{1F4DE} CALL",
          sms: "\u{1F4AC} SMS",
          geo: "\u{1F4CD} GEO",
          text: "\u{1F4DD} TEXT"
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
    }
  };
  var QROverlayManager = class {
    constructor(options = {}) {
      this.options = {
        soundEnabled: true,
        autoCopy: false,
        themeColor: "cyan",
        cardDisplayMode: "hover",
        glowAnimation: true,
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
    }
    /**
     * Applies CSS classes for themes, display mode, and animations to root overlay.
     */
    applySettingsClasses() {
      if (!this.root) return;
      this.root.className = [
        `theme-${this.options.themeColor || "cyan"}`,
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
     * Initializes overlay DOM structure.
     */
    mount() {
      if (this.root) return;
      this.root = document.createElement("div");
      this.root.id = "qr-radar-root";
      this.applySettingsClasses();
      document.body.appendChild(this.root);
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
          const trackerBounds = tracker.currentLocation ? computeBounds(tracker.currentLocation) : null;
          const isNear = trackerBounds && areBoundsNear(trackerBounds, itemBounds, 90);
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
          if (tracker.isDomLocked && tracker.anchorElement && tracker.anchorElement.isConnected) {
            const rect = tracker.anchorElement.getBoundingClientRect();
            const inView = rect.bottom >= 0 && rect.top <= window.innerHeight && rect.right >= 0 && rect.left <= window.innerWidth && rect.width > 12 && rect.height > 12;
            if (inView && source === "screen") {
              continue;
            }
          }
          tracker.missingFrames++;
          if (tracker.missingFrames > tracker.maxMissingFrames) {
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
        if (tracker.isDomLocked && tracker.anchorElement && tracker.anchorElement.isConnected) {
          const rect = tracker.anchorElement.getBoundingClientRect();
          const inView = rect.bottom >= 0 && rect.top <= window.innerHeight && rect.right >= 0 && rect.left <= window.innerWidth;
          if (inView) continue;
        }
        tracker.missingFrames++;
        if (tracker.missingFrames > tracker.maxMissingFrames) {
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
      const dataUrl = await import_qrcode.default.toDataURL("https://antigravity.ai/tiny-dom-qr-test", {
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
      const text = input.value.trim() || "https://antigravity.ai";
      await import_qrcode.default.toCanvas(canvas, text, {
        width: 200,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" }
      });
    }
    btn.addEventListener("click", generate);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") generate();
    });
    generate();
  }
  async function setupAnimatedCanvas() {
    const canvas = document.getElementById("moving-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const offscreenCanvas = document.createElement("canvas");
    await import_qrcode.default.toCanvas(offscreenCanvas, "https://antigravity.ai/realtime-radar-moving", {
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
      for (let x = 0; x < canvas.width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
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
  function initTestBench() {
    renderSampleQRs();
    setupCustomGenerator();
    setupAnimatedCanvas();
    setupInPageSimulation();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTestBench);
  } else {
    initTestBench();
  }
})();
