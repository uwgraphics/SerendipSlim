// Function to test for zero values (which Flask doesn't like)
var zTest = function(val) {
    return val === 0 ? '0' : val;
};

// This function takes a string and turns it into a (untagged) tokens list
// Each token is of the form [rawToken, tokenToMatch, endReason]
// endReasons:
//  's': whitespace
//  'n': newline(s) (multiple for multiple)
//  'c': new token (e.g., punctuation)
//  'e': end-of-file
var tokenize = function(s) {
    // If it's a .txt file, we'll need to parse it
    var rawTokens = s.split(/(\s+)/);
    var tokens = [];

    // First, go through and get the tokens (no tagging)
    var i = 0;
    var punc_re = /[^\w\s]$/; // This will only grab *end* punctuation
    var numNewlines, wordToken, puncToken;
    var tmp;
    while (i < rawTokens.length) {
        // If it has non-whitespace chars, consider it a token.
        if (rawTokens[i].match(/\S/)) {
            // Calculate the proper endreason based on number of newlines and EOF
            var endReason;
            if (i + 1 < rawTokens.length) {
                numNewlines = (rawTokens[i+1].match(/\n/g)||[]).length;
                endReason = numNewlines > 0 ? 'n'.repeat(numNewlines) : 's';
            } else {
                endReason = 'e';
            }

            // If token ends with punctuation, break off punctuation into own token
            if (rawTokens[i].match(punc_re)) {
                // Check the rules for wordToken -- if it isn't an empty string (e.g. a token that is just punctuation), push it
                wordToken = rawTokens[i].split(punc_re)[0];
                if (wordToken !== '') {
                    tmp = [wordToken, wordToken.toLowerCase(), 'c'];
                    tokens.push(tmp);
                }

                // Check the rules for puncToken
                puncToken = rawTokens[i].match(punc_re)[0];
                tmp = [puncToken, puncToken, endReason];
                tokens.push(tmp);
            } else {
                // Check the rules for wordToken
                wordToken = rawTokens[i];
                tmp = [rawTokens[i], rawTokens[i].toLowerCase(), endReason];
                tokens.push(tmp);
            }

            i += 2; // Skip the whitespace token after this so we don't have to match it
        } else {
            i++; // If we start with a whitespace token, just skip it
        }
    }

    return tokens;
};

// This function will take an array of tokens and output a string of text
var tokensToText = function(tokens) {
    var txtStr = '';
    for (var i = 0; i < tokens.length; i++) {
        txtStr += tokens[i][0];
        if (tokens[i][2] === 's') {
            txtStr += ' ';
        } else if (typeof tokens[i][2] !== 'undefined' && tokens[i][2][0] === 'n') {
            txtStr += '\n'.repeat(tokens[i][2].length);
        }
    }
    return txtStr;
};


// Helper functions for performing similarity calculations
// Convert object with int keys to an array of given length (i.e. convert theta and phi objects to rows/cols)
var objToArray = function(obj, arrayLen) {
    var returnArray = new Array(arrayLen);
    for (var i = 0; i < arrayLen; i++) {
        if (i in obj) {
            returnArray[i] = obj[i];
        } else {
            returnArray[i] = 0;
        }
    }
    return returnArray;
};

// Dot product of two arrays of numbers
var dot = function(v1, v2) {
    if (v1.length !== v2.length) {
        throw "Dot product lengths do not match";
    }
    var sum = 0;
    for (var i = 0; i < v1.length; i++) {
        sum += v1[i] * v2[i];
    }
    return sum;
};

// Magnitude of an array of numbers
var mag = function(v1) {
    var sumSquares = 0;
    for (var i = 0; i < v1.length; i++) {
        sumSquares += v1[i] * v1[i];
    }
    return Math.sqrt(sumSquares);
};

// Define the colors available within SerendipSlim
var colors = {};
colors.cat = ['#E41A1C', '#377EB8', '#4DAF4A', '#984EA3', '#FF7F00', '#FFFF33', '#A65628', '#F781BF', '#999999']; // ColorBrewer 9-class Set 1 Qualitative
colors.div = ['#B2182B', '#D6604D', '#F4A582', '#FDDBC7', '#F7F7F7', '#D1E5F0', '#92C5DE', '#4393C3', '#2166AC']; // ColorBrewer 11-class Red-Blue Diverging (top and bottom removed)
colors.seq = ['#F7FCF5', '#E5F5E0', '#C7E9C0', '#A1D99B', '#74C476', '#41AB5D', '#238B45', '#006D2C', '#00441B']; // ColorBrewer 9-class Greens Sequential
colors.topic = ["#6baed6","#74c476","#fd8d3c","#9e9ac8","#fb6a4a"];