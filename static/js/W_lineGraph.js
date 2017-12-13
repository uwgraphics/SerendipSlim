/**
 * Created by ealexand on 4/12/2016.
 */

//importScripts('jquery/jquery-1.9.1.min.js');

var sat;

onmessage = function(e) {
    if (e.data.task === 'buildSAT') {
        var tmp = getSATandTagCounts(e.data.tokens);
        sat = tmp.sat;
        postMessage({
            'task': 'buildSAT',
            'message': 'success',
            'tagCounts': tmp.tagCounts
        });
    } else if (e.data.task === 'getTagLines') {
        if (typeof(sat) !== 'undefined') {
            var tmpObj = getTagLines(e.data.windowSize);
            tmpObj.task = 'getTagLines';
            tmpObj.message = 'success';
            postMessage(tmpObj);
        } else {
            postMessage({
                'task': 'getTagLines',
                'message': 'FAILURE. SAT not built before getTagLines called.'
            })
        }
    }
};

var getSATandTagCounts = function(tokens) {
    var maxSATlines = 2000;
    var tokensPerSATline = Math.ceil(tokens.length / maxSATlines);
    var numSATlines = Math.ceil(tokens.length / tokensPerSATline);
    var sat = new Array(numSATlines);
    var tagCounts = {
        'totalCount': 0,
        'countsByTag': {}
    };

    var currSATline = {};
    var satLineIndex = 0;
    var tag;
    var lastCopied = false;
    for (var i = 0; i < tokens.length; i++) {
        // If there's a tag for this token, store it in the SAT and count it
        if (tokens[i].length > 3 && tokens[i][3] !== '') {
            tag = tokens[i][3];
            if (tag in currSATline) {
                currSATline[tag]++;
            } else {
                currSATline[tag] = 1;
            }
            if (tag in tagCounts.countsByTag) {
                tagCounts.countsByTag[tag]++;
            } else {
                tagCounts.countsByTag[tag] = 0;
            }
            tagCounts.totalCount++;
        }
        // If we've filled a SATline, deep copy it
        if ((i + 1) % tokensPerSATline === 0) {
            //sat[satLineIndex] = jQuery.extend({}, currSATline);
            // http://heyjavascript.com/4-creative-ways-to-clone-objects/
            sat[satLineIndex] = JSON.parse(JSON.stringify(currSATline));
            satLineIndex++;
        }
    }
    // Copy the last little bit into the last SATline
    if (i % tokensPerSATline !== 0) {
        sat[sat.length - 1] = currSATline;
    }

    return {
        'sat': sat,
        'tagCounts': tagCounts
    };
};

// Function for building a topic line graph from a summed area table
var getTagLines = function(normalizedWindowSize, numWindows) {
    // First, calculate the window scores ************************
    if (typeof(numWindows) === "undefined") {
        numWindows = Math.min(sat.length, 500); // TODO: why 500?
    }
    if (typeof(normalizedWindowSize) === "undefined") {
        normalizedWindowSize = 50;
    }
    var windowSize = Math.round(normalizedWindowSize * (sat.length / numWindows));
    if (windowSize % 2 !== 0) {
        windowSize++;
    }
    var tagNames = Object.keys(sat[sat.length-1]);
    var tagName, startIndex, endIndex, i;
    var maxWindow = 0;
    var tagLines = new Array(tagNames.length);
    var windowStepSize = sat.length / numWindows;
    // Loop through each tag name (topic)
    var currWindowIndex, currWindowStep, currWindowValue;
    for (var tni = 0; tni < tagNames.length; tni++) {
        tagName = tagNames[tni];
        tagLines[tni] = {
            'tagName': tagName,
            'windows': new Array(numWindows)
        };

        // Loop through each satLine calculating window scores
        for (currWindowIndex = 0; currWindowIndex < numWindows; currWindowIndex++) {
            currWindowStep = currWindowIndex * windowStepSize - windowStepSize/2;

            startIndex = Math.max(0, Math.floor(currWindowStep - windowSize/2));
            endIndex = Math.min(sat.length - 1, Math.ceil(currWindowStep + windowSize/2));
            indexRange = endIndex - startIndex; // Used to make the edge cases proportional

            end = sat[endIndex].hasOwnProperty(tagName) ? sat[endIndex][tagName] : 0;
            start = sat[startIndex].hasOwnProperty(tagName) ? sat[startIndex][tagName] : 0;
            currWindowValue = (end - start) / indexRange;
            tagLines[tni]['windows'][currWindowIndex] = currWindowValue;
            maxWindow = Math.max(maxWindow, currWindowValue);
        }
    }

    return {
        'tagLines': tagLines,
        'maxWindow': maxWindow,
        'numWindows': numWindows
    }
};