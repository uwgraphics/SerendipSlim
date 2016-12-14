/**
 * Created by ealexand on 4/29/2016.
 */
// A silly hash fxn for filenames
var hashCode = function(str){
    var hash = 0;
    if (str.length == 0) return hash;
    for (i = 0; i < str.length; i++) {
        char = str.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
};

// Read in tokens when they input a file
var tokens, model_name, tokens_file_name, txt_file_name, rules_file_name;
var rules;
var tokensCSVstr = '';
var txtFileStr = '';
var rulesCSVstr = '';

// This function parses a CSV string into a set of rules that can be used for tagging
// Returns rules as an object matching rule to tag
// Multi-token rules are represented by nested objects, in which terminating rules are placed into special index
var TERMINATING_RULE = 'TERMINATING_RULE';
var getRulesFromCSVstr = function(s) {
    var ruleRows = d3.csv.parseRows(s);
    var rules = {};
    var ruleInstance, ruleInstanceTokens, ruleName;
    for (var i = 0; i < ruleRows.length; i++) {
        if (ruleRows[i].length != 2) {
            // THROW ERROR
            alert('Invalid rules file: not a 2-column CSV.');
            return '';
        } else {
            // Break down the CSV row
            ruleInstance = ruleRows[i][0].trim();
            ruleName = ruleRows[i][1].trim();
            // If the rule starts with a number, it breaks the CSS
            if (!isNaN(parseInt(ruleName))) {
                ruleName = 'RULE_' + ruleName;
            }
            ruleInstanceTokens = tokenize(ruleInstance);

            ruleOverlap = false;
            currRules = rules;
            // Loop through all but the last token, creating scaffolding in the rules object
            for (var j = 0; j < ruleInstanceTokens.length - 1; j++) {
                tokenToMatch = ruleInstanceTokens[j][1];
                if (!currRules.hasOwnProperty(tokenToMatch)) {
                    currRules[tokenToMatch] = {};
                } else {
                    ruleOverlap = true;
                }
                currRules = currRules[tokenToMatch];
            }
            // Treat last one special
            tokenToMatch = ruleInstanceTokens[ruleInstanceTokens.length - 1][1];
            if (currRules.hasOwnProperty(tokenToMatch)) {
                if (currRules[tokenToMatch].hasOwnProperty(TERMINATING_RULE)) {
                    // DUPLICATE ENTRY
                    alert('ALERT: duplicate rules detected.');
                } else {
                    currRules[tokenToMatch][TERMINATING_RULE] = ruleName;
                }
            } else {
                currRules[tokenToMatch] = {
                    TERMINATING_RULE: ruleName
                };
            }
        }
    }
    return rules;
};

var getRulesArrayfromObj = function(rules) {
    var rulesArray = [];
    var getRules = function(currRules, currInstance) {
        if (currRules.hasOwnProperty(TERMINATING_RULE)) {
            rulesArray.push([currInstance.trim(), currRules[TERMINATING_RULE]]);
        }
        for (var nextToken in currRules) {
            if (typeof currRules[nextToken] === 'object') {
                getRules(currRules[nextToken], currInstance + ' ' + nextToken)
            }
        }
    };
    getRules(rules, '');
    return rulesArray;
};

// This function takes a given string and set of rules and returns a tagged set of tokens.
var getTaggedTokens = function(s, rules) {
    // Tokenize the string first
    var tokens = tokenize(s);

    // Next, go through again and tag
    var i = 0;
    var tokenToMatch, tagLength, bestRuleName, bestRuleLength, currRules, j;
    while (i < tokens.length) {
        tokenToMatch = tokens[i][1];

        if (rules.hasOwnProperty(tokenToMatch)) {
            // Check for longest rule
            tagLength = 1;
            bestRuleLength = -1;
            currRules = rules;
            while (currRules.hasOwnProperty(tokenToMatch)) {
                if (currRules[tokenToMatch].hasOwnProperty(TERMINATING_RULE)) {
                    bestRuleName = currRules[tokenToMatch][TERMINATING_RULE];
                    bestRuleLength = tagLength;
                }
                // Update if we can keep going. Else, break out;
                if (i + tagLength < tokens.length) {
                    currRules = currRules[tokenToMatch];
                    tokenToMatch = tokens[i+tagLength][1];
                    tagLength++;
                } else {
                    break;
                }
            }
            // Apply longest rule and increment counter appropriately
            for (j = i; j < i + bestRuleLength; j++) { // If bestRuleLength is negative, won't fire
                tokens[j].push(bestRuleName);
                tokens[j].push(j - i);
            }
            i += Math.max(bestRuleLength, 1);
        } else {
            i++;
        }
    }

    return tokens;
};

var loadFiles = function(fileType) {
    // Load files depending on type
    if (fileType == 'tokens') {
        // Clear localStorage
        model_name = 'serendip_TV_single_' + tokens_file_name + '_' + hashCode(tokensCSVstr.substring(0,50));
        localStorage[model_name] = '';

        // Load tokens
        tokens = d3.csv.parseRows(tokensCSVstr);

        // Run TextViewer
        $('#fileLoadModal').modal('hide');
        main(); // Run TextViewer

        // TODO: This is a cheap hack, defaulting to 'count' with the single-view ones
        // Make it winner-takes-all tagging
        setTimeout(function() {
            changeRankingType('count');
            $('#textViewOptions').remove();
        }, 4000);
    } else if (fileType == 'text') {
        // Clear localStorage
        model_name = 'serendip_TV_single_' + txt_file_name + '_' + hashCode(txtFileStr.substring(0,50));
        localStorage[model_name] = '';

        // Load rules and tokens
        //var rules;
        if ($('#rulesChoice_write').prop('checked')) {
            rulesCSVstr = $('#rulesTextArea').prop('value');
        }
        rules = getRulesFromCSVstr(rulesCSVstr);
        tokens = getTaggedTokens(txtFileStr, rules);

        // Run TextViewer
        $('#fileLoadModal').modal('hide');
        main();

        // Make it winner-takes-all tagging
        setTimeout(function() {
            changeRankingType('count');
            $('#textViewOptions').remove();
        }, 4000);
    }
};

var handleCSVselect = function(evt) {
    // Just take the first file, cause there should only be one...
    var f = evt.target.files[0];
    tokens_file_name = f.name;

    // Make sure we have the right file type
    if (!tokens_file_name.toLowerCase().endsWith('.csv')) {
        d3.select('#tokensCollapse .accordion-inner')
            .append('div')
            .attr('class', 'alert fileTypeAlert')
            .html('<strong>Error:</strong> Invalid file type.');
    } else {
        d3.select('#tokensCollapse .accordion-inner .fileTypeAlert').remove();
        // Read the file in using a FileReader
        var reader = new FileReader();
        reader.onload = (function(theFile) {
            return function(e) {
                tokensCSVstr = e.target.result;
            };
        })(f);
        reader.readAsText(f);

        $('#loadFilesBtn').removeClass('disabled');
    }
};

var handleTXTselect = function(evt) {
    // Just take the first file, cause there should only be one...
    var f = evt.target.files[0];
    txt_file_name = f.name;

    // Make sure we have the right file type
    if (!txt_file_name.toLowerCase().endsWith('.txt')) {
        d3.select('#textCollapse .accordion-inner')
            .append('div')
            .attr('class', 'alert fileTypeAlert')
            .html('<strong>Error:</strong> Invalid file type.');
    } else {
        d3.select('#textCollapse .accordion-inner .fileTypeAlert').remove();
        // Read the file in using a FileReader
        var reader = new FileReader();
        reader.onload = (function(theFile) {
            return function(e) {
                txtFileStr = e.target.result;
            };
        })(f);
        reader.readAsText(f);

        $('#loadFilesBtn').removeClass('disabled');
    }
};

var handleRulesCSVselect = function(evt) {
    // Just take the first file, cause there should only be one...
    var f = evt.target.files[0];
    rules_file_name = f.name;

    // Make sure we have the right file type
    if (!rules_file_name.toLowerCase().endsWith('.csv')) {
        d3.select('#txtCollapse .accordion-inner')
            .append('div')
            .attr('class', 'alert fileTypeAlert')
            .html('<strong>Error:</strong> Invalid file type.');
    } else {
        d3.select('#txtCollapse .accordion-inner .fileTypeAlert').remove();
        // Read the file in using a FileReader
        var reader = new FileReader();
        reader.onload = (function(theFile) {
            return function(e) {
                rulesCSVstr = e.target.result;
            };
        })(f);
        reader.readAsText(f);
    }
};

// Attach event listeners to the input elements
document.getElementById('tokensFileInput').addEventListener('change', handleCSVselect, false);
document.getElementById('textFileInput').addEventListener('change', handleTXTselect, false);
document.getElementById('rulesFileInput').addEventListener('change', handleRulesCSVselect, false);

// Event listeners to control loadFilesBtn
$('#tokensCollapse').on('shown', function() {
    if (tokensCSVstr == '') {
        $('#loadFilesBtn').addClass('disabled');
    } else {
        $('#loadFilesBtn').removeClass('disabled');
    }
});
$('#textCollapse').on('shown', function() {
    if (txtFileStr == '') {
        $('#loadFilesBtn').addClass('disabled');
    } else {
        $('#loadFilesBtn').removeClass('disabled');
    }
});
$('#loadFilesBtn').on('click', function() {
    if (!$(this).hasClass('disabled')) {
        var expandedAccordion = $('.accordion-body.in').attr('id');
        if (expandedAccordion == 'tokensCollapse') {
            loadFiles('tokens');
        } else if (expandedAccordion == 'textCollapse') {
            loadFiles('text');
        }
    }
});
// Button for opening new instance
$('#newInstanceBtn').on('click', function() {
    window.open(window.location, '_blank');
});

// Pop up the modal dialog
$('#fileLoadModal').modal({
    'keyboard': false,
    'backdrop': 'static'
});