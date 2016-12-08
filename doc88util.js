var NO_CHAR_INDICATOR = -1;
var CHAR_TRANSFORM_MAP = new Array(
    'P', 'J', 'K', 'L', 'M', 'N', 'O', 'I', '3', 'x', 'y', 'z', '0', '1', '2', 'w',
    'v', 'p', 'r', 'q', 's', 't', 'u', 'o', 'H', 'B', 'C', 'D', 'E', 'F', 'G', 'A',
    'n', 'h', 'i', 'j', 'k', 'l', 'm', 'g', 'f', 'Z', 'a', 'b', 'c', 'd', 'e', 'Y',
    'X', 'R', 'S', 'T', 'U', 'V', 'W', 'Q', '!', '5', '6', '7', '8', '9', '+', '4');
var CHAR_TRANSFORM_MAP_REV = new Array(128);
for (var i = 0; i < CHAR_TRANSFORM_MAP.length; i++) {
    CHAR_TRANSFORM_MAP_REV[CHAR_TRANSFORM_MAP[i]] = i;
}

// Viewer._OOOOlO
function decodePageContext(str) {
    var strToBeDecoded;
    var strToBeDecodedIdx;

    // Viewer._10l0O1()
    function getNextChar() {
        if (!strToBeDecoded)
            return NO_CHAR_INDICATOR;
        while (true) {
            if (strToBeDecodedIdx >= strToBeDecoded.length)
                return NO_CHAR_INDICATOR;
            var nextCharacter = strToBeDecoded.charAt(strToBeDecodedIdx);
            strToBeDecodedIdx++;
            if (CHAR_TRANSFORM_MAP_REV[nextCharacter]) {
                return CHAR_TRANSFORM_MAP_REV[nextCharacter];
            }
            if (nextCharacter == 'P')
                return 0;
        }
    }

    // Viewer._ll0lOl
    function convertNumberToUtf8Char(n) {
        n = n.toString(16);
        if (n.length == 1) n = "0" + n;
        n = "%" + n;
        return unescape(n)
    }

    // Viewer._11O1O1()
    function transformResultStr(str) {
        var out, i, len, c;
        var char2, char3;
        out = "";
        len = str.length;
        i = 0;
        while (i < len) {
            c = str.charCodeAt(i++);
            switch (c >> 4) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                    out += str.charAt(i - 1);
                    break;
                case 12:
                case 13:
                    char2 = str.charCodeAt(i++);
                    out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                    break;
                case 14:
                    char2 = str.charCodeAt(i++);
                    char3 = str.charCodeAt(i++);
                    out += String.fromCharCode(((c & 0x0F) << 12) | ((char2 & 0x3F) << 6) | ((char3 & 0x3F) << 0));
                    break;
            }
        }
        return out;
    }

    // Viewer._0011l1(str);
    strToBeDecoded = str;
    strToBeDecodedIdx = 0;

    var result = "";
    var inBuffer = new Array(4);
    var done = false;
    while (!done && (inBuffer[0] = getNextChar()) != NO_CHAR_INDICATOR && (inBuffer[1] = getNextChar()) != NO_CHAR_INDICATOR) {
        inBuffer[2] = getNextChar();
        inBuffer[3] = getNextChar();
        result += convertNumberToUtf8Char((((inBuffer[0] << 2) & 0xff) | inBuffer[1] >> 4));
        if (inBuffer[2] != NO_CHAR_INDICATOR) {
            result += convertNumberToUtf8Char((((inBuffer[1] << 4) & 0xff) | inBuffer[2] >> 2));
            if (inBuffer[3] != NO_CHAR_INDICATOR) {
                result += convertNumberToUtf8Char((((inBuffer[2] << 6) & 0xff) | inBuffer[3]))
            } else {
                done = true;
            }
        } else {
            done = true;
        }
    }
    result = transformResultStr(result);
    return result;
}

// Viewer._l1O1Ol
function constructFlashParams(pageNum, pageContext, mtp, mhost, mhi, mpebt, madif, p_s) {
    var strToBeDecoded;
    var strToBeDecodedIdx;

    // Viewer._OllO1l
    function deriveEbtLinkValue(str) {
        // Viewer._11Ol01
        function transformStr(str) {
            var out, i, len, c;
            out = "";
            len = str.length;
            for (i = 0; i < len; i++) {
                c = str.charCodeAt(i);
                if ((c >= 0x0001) && (c <= 0x007F)) {
                    out += str.charAt(i)
                } else if (c > 0x07FF) {
                    out += String.fromCharCode(0xE0 | ((c >> 12) & 0x0F));
                    out += String.fromCharCode(0x80 | ((c >> 6) & 0x3F));
                    out += String.fromCharCode(0x80 | ((c >> 0) & 0x3F))
                } else {
                    out += String.fromCharCode(0xC0 | ((c >> 6) & 0x1F));
                    out += String.fromCharCode(0x80 | ((c >> 0) & 0x3F))
                }
            }
            return out;
        }

        // Viewer._lll0l0()
        function getChar() {
            if (!strToBeDecoded)
                return NO_CHAR_INDICATOR;
            if (strToBeDecodedIdx >= strToBeDecoded.length)
                return NO_CHAR_INDICATOR;
            var c = strToBeDecoded.charCodeAt(strToBeDecodedIdx) & 0xff;
            strToBeDecodedIdx++;
            return c;
        }

        str = transformStr(str);
        // Viewer._0011l1(str);
        strToBeDecoded = str;
        strToBeDecodedIdx = 0;
        var result = '';
        var inBuffer = new Array(3);
        var lineCount = 0;
        var done = false;
        while (!done && (inBuffer[0] = getChar()) != NO_CHAR_INDICATOR) {
            inBuffer[1] = getChar();
            inBuffer[2] = getChar();
            result += (CHAR_TRANSFORM_MAP[inBuffer[0] >> 2]);
            if (inBuffer[1] != NO_CHAR_INDICATOR) {
                result += (CHAR_TRANSFORM_MAP[((inBuffer[0] << 4) & 0x30) | (inBuffer[1] >> 4)]);
                if (inBuffer[2] != NO_CHAR_INDICATOR) {
                    result += (CHAR_TRANSFORM_MAP[((inBuffer[1] << 2) & 0x3c) | (inBuffer[2] >> 6)]);
                    result += (CHAR_TRANSFORM_MAP[inBuffer[2] & 0x3F])
                } else {
                    result += (CHAR_TRANSFORM_MAP[((inBuffer[1] << 2) & 0x3c)]);
                    result += ('=');
                    done = true;
                }
            } else {
                result += (CHAR_TRANSFORM_MAP[((inBuffer[0] << 4) & 0x30)]);
                result += ('=');
                result += ('=');
                done = true;
            }
        }
        return result;
    }

    // Viewer._OOl0O1()
    function getFlashParamFn(pageNum) {
        if (pageNum == 1) {
            return 0;
        }
        var result = (pageNum - 1) % 5 /* Viewer._100Ol0 */ ;
        if (result == 0)
            result = 5;
        return result;
    }

    pageNum = parseInt(pageNum);
    if (pageNum > mtp || pageNum < 1) return;
    var pageContextCodes = pageContext[pageNum - 1].split("-");
    var pageCodeIdx0 = pageContextCodes[0];
    var flashParamFn = getFlashParamFn(pageNum);
    var pageCodeIdx3 = pageContextCodes[3];
    var pageCodeIdx4 = pageContextCodes[4];
    var pageCodeIdx1 = pageContextCodes[1];
    var pageCodeIdx2 = pageContextCodes[2];
    var pageCodeIdx0 = pageContextCodes[0];
    var flashParamPh = mhost + "/getebt-" + deriveEbtLinkValue(pageCodeIdx0 + "-0-" + mhi[pageCodeIdx0 - 1] + "-" + mpebt) + ".ebt";
    var flashParamPk = mhost + "/getebt-" + deriveEbtLinkValue(pageCodeIdx0 + "-" + pageCodeIdx3 + "-" + pageCodeIdx4 + "-" + mpebt) + ".ebt";
    var flashParamV = 0;
    if (madif == "0" || p_s != 0) flashParamV = 1;
    var resultParams = "hn=" + pageCodeIdx0 + "&ph=" + flashParamPh + "&pk=" + flashParamPk + "&ptm=GotoPage&hlm=HeaderLoaded&fn=" + flashParamFn + "&e404m=ViewerError&st=GetSURL&v=" + flashParamV;
    //if (Viewer._OO1011.indexOf(pageNum) != -1) {
    //resultParams = resultParams + "&sp=false";
    //}
    return resultParams;
};

exports.decodePageContext = decodePageContext;
exports.constructFlashParams = constructFlashParams;