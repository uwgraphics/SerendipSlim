/* Begin sloppy globals */
// http://stackoverflow.com/a/956878
function countProperties(obj) {
    var count = 0;

    for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
            ++count;
    }

    return count;
}

// http://stackoverflow.com/a/646643/1991086
if (typeof String.prototype.startsWith !== 'function') {
    String.prototype.startsWith = function (str){
        return this.slice(0, str.length) == str;
    };
}

var updateTimeout;
var tag_colors = {};
var activeTags = [];
var tags_top_only = true;
var color_ramps = true;
var num_ramps = 5;
//var rank_type = 'sal';
var rank_type = 'count';
var color_set_name = "baseColors";
var tokensPerPage = 1000;
var tokenBuffer = 100;
var currPageStart = 0;
var currPageEnd = currPageStart + tokensPerPage;
if (typeof(model_type) === 'undefined') {
    model_type = 'singleText';
}
var tagRepState;
var tagDistribution; // Variable containing the overall tag distribution of document (for CSV output)
var wordDistribution; // Variable containing the distribution of words within a tag (for CSV output)
var searchMatchBarColor = '#dd0';
//var searchMatchBarColor = '#00ff00';
var searchPhrase = '';
var currMatchIndex = 0;
var matchIndices = []; // An array that will store the token indicies of current matches to a search term
var lgState = {}; // Current state of the line graph
var zoomBehavior;
var buildLineGraphTV = function() {
    buildLineGraph(
        lgState.tagLines, lgState.maxWindow, lgState.numWindows,
        '#right_sidebar_content', true, {
            'click': function() {
                $('#btn-' + d3.select(this).attr('data-key')).trigger('click');
            },
            'mouseover': function() {
                brushTag($(this).attr("data-key"));
            },
            'mouseout': function() {
                unbrushTag($(this).attr("data-key"));
            },
            'contextmenu': function() {
                d3.event.preventDefault();
                var btnID = '#btn-' + d3.select(this).attr('data-key');
                d3.select(btnID).each(showTagRep);
            }
        }
    );
    d3.select('.tag_line_graph').call(zoomBehavior);
    /*d3.select('#window_box').call(d3.behavior.drag()
        .on('dragstart', function() {

        })
        .on('drag', function() {
            var newX = d3.event.x;
            d3.select(this)
                .attr('y', function() {
                    return d3.select(this).attr('y') + d3.event.dy;
                })
        })
        .on('dragend', function() {

        })
    )*/
};
/* End sloppy globals */

// This function takes a given string phrase and searches for token-by-token matches of it in the tokens list
// Returns a list of matches, which are indices corresponding to token list
var searchTokensFor = function(phrase) {
    // Tokenize search phrase, and bail if there are no tokens
    var phraseTokens = tokenize(phrase);
    if (phraseTokens.length === 0) {
        return [];
    }

    // Loop through the token list looking for a tentative match
    var matches = [];
    var i, j, matchSoFar;
    for (i = 0; i < tokens.length; i++) {
        // If we match the first token, loop through the phraseTokens
        if (tokens[i][1] === phraseTokens[0][1]) {
            matchSoFar = true;
            for (j = 1; j < phraseTokens.length; j++) {
                if (i + j >= tokens.length || tokens[i+j][1] !== phraseTokens[j][1]) {
                    matchSoFar = false;
                    break;
                }
            }
            // If we match all the phraseTokens, add it to matches
            if (matchSoFar) {
                matches.push(i);
            }
        }
    }

    return matches;
};

// TODO: fix reference to 'data-key'
var updateTagNames = function() {
    if (model_type === 'topic') {
        d3.json($GET_TAG_NAMES_URL, function(json) {
            if (typeof(json['topicNames']) === 'object' && json['topicNames'].hasOwnProperty('length') && json['topicNames'].length > 0){
                d3.selectAll('.btn-label')
                    .text(function() {
                        var tagNum = parseInt(d3.select(d3.select(this).node().parentNode).attr('data-key').split('_')[1]);
                        return json.topicNames[tagNum];
                    });
            }
        });
    }
};

var storeTagColors = function() {
    var storageStr = '';
    var i = 0;
    for (var tagID in tag_colors) {
        if (i !== 0) {
            storageStr += ';'
        }
        storageStr += tagID + ':' + tag_colors[tagID];
        i++;
    }
    localStorage[model_name] = storageStr;
};

var retrieveAndApplyTagColors = function(oldRankType) {
    if (typeof(localStorage[model_name]) === 'undefined') {
        localStorage[model_name] = '';
    }
    var tagColorAssignments = localStorage[model_name].split(';');
    var tempTagColors = {};
    var tmp, tag_name, color, $btn;
    var colorSansPound, classToSelect, classToAdd, classToRemove;
    var rankTypeToRemove;
    var ramp_index;
    for (var i = 0; i < tagColorAssignments.length; i++) {
        if (tagColorAssignments[i] !== '') {
            tmp = tagColorAssignments[i].split(':');
            tag_name = tmp[0];
            color = tmp[1];
            tempTagColors[tag_name] = color;

            $btn = $('#btn-' + tag_name);
            if (tag_name in tag_colors) {
                // Remove old color
                colorSansPound = tag_colors[tag_name].substring(1);
                $btn.removeClass('noramp_' + colorSansPound);
                /*if (oldRankType == 'count') { // If it's count, it's basically noramp
                    //$('span.' + tag_name).removeClass('noramp_' + colorSansPound);
                    $('.tagToken[data-key~="' + tag_name + '"]').removeClass('noramp_' + colorSansPound);
                }
                // TODO: fix this for non-count color ramps (now that tags aren't classes)
                else { // Otherwise, remove for all ramp numbers
                    for (ramp_index = 1; ramp_index <= num_ramps; ramp_index++) {
                        if (oldRankType == undefined) {
                            rankTypeToRemove = rank_type;
                        }
                        else {
                            rankTypeToRemove = oldRankType;
                        }
                        classToSelect = rankTypeToRemove + ramp_index + '.' + tag_name;
                        // Remove both noramp and ramped, not knowing whether color_ramps just changed
                        $('.' + classToSelect)
                            .removeClass(rankTypeToRemove + colorSansPound)
                            .removeClass('noramp_' + colorSansPound);
                    }
                }*/
            } else {
                $btn.addClass('active');
                activeTags.push(tag_name);
            }
            // Add new color
            colorSansPound = color.substring(1);
            $btn.addClass('noramp_' + colorSansPound);
            // If we're ranking by count, it's effectively !color_ramps
            // TODO: fix this for non-count color ramps (now that tags aren't classes)
            /*if (rank_type != 'count') {
                for (ramp_index = 1; ramp_index <= num_ramps; ramp_index++) {
                    classToSelect = rank_type + ramp_index + '.' + tag_name;
                    classToAdd = color_ramps ? rank_type + colorSansPound
                                             : 'noramp_' + colorSansPound;
                    $('.' + classToSelect).addClass(classToAdd);
                }
            }
            else {
                //$('span.' + tag_name).addClass('noramp_' + colorSansPound);
                $('.tagToken[data-key~="' + tag_name + '"]').addClass('noramp_' + colorSansPound);
            }*/
        }
    }

    // Untoggle non-active tags
    for (var tmp_tag_name in tag_colors) {
        if (!(tmp_tag_name in tempTagColors)) {
            /*colorSansPound = tag_colors[tmp_tag_name].substring(1);
            $('#btn-' + tmp_tag_name).removeClass("active")
                              .removeClass('noramp_' + colorSansPound);
            for (var j = 1; j <= num_ramps; j++) {
                classToSelect = rank_type + j + '.' + tmp_tag_name;
                classToRemove = color_ramps ? rank_type + colorSansPound
                                            : 'noramp_' + colorSansPound;
                $('.' + classToSelect).removeClass(classToRemove);
            }
            activeTags.splice(activeTags.indexOf(tmp_tag_name), 1);*/
            toggleTag(tmp_tag_name);
        }
    }

    tag_colors = tempTagColors;
    updateTagColorsD3();
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(
        updateLineGraphCSS,
        100
    );
};

// This will update the .tagToken colors using current tag_colors, using D3
// Vast improvement over the nonsense Joe was doing with ramped classes in retrieveAndApplyTagColors
var updateTagColorsD3 = function() {
    var tagToken;
    if (rank_type === 'count') {
        tagToken = d3.selectAll('.tagToken')
            .style('background-color', function() {
                var data_key_vals = d3.select(this).attr('data-key').split(' ');
                var tagName;
                for (var i = 0; i < data_key_vals.length; i++) {
                    if (data_key_vals[i].startsWith('topic_')) {
                        tagName = data_key_vals[i];
                    }
                }
                return tag_colors[tagName];
            });
    } else {
        tagToken = d3.selectAll('.tagToken')
            .style('background-color', function() {
                // Get rank_bin given this tags data-key values and current rank_type
                var data_key_vals = d3.select(this).attr('data-key').split(' ');
                var tagName, rank_bin;
                for (var i = 0; i < data_key_vals.length; i++) {
                    if (data_key_vals[i].startsWith('topic_')) {
                        tagName = data_key_vals[i];
                    } else if (data_key_vals[i].startsWith(rank_type)) {
                        rank_bin = data_key_vals[i].substring(rank_type.length);
                    }
                }
                var tagBaseColor = tag_colors[tagName];
                if (typeof(tagBaseColor) === 'undefined') {
                    return;
                }
                return app_colors['baseColorRamps'][tagBaseColor][rank_bin - 1];
            });
    }
};

var toggleTag = function(tag_name) {
    var $btn = $('#btn-' + tag_name);
    var colorSansPound;
    if (! $btn.hasClass("active")) {
        $btn.addClass("active");
        activeTags.push(tag_name);

        var colors = app_colors[color_set_name];
        var color_index = getNextUnusedColorIndex(colors, tag_colors);
        colorSansPound = colors[color_index].substring(1);
        for (var j = 0; j < activeTags.length; j++) {
            var class_str = activeTags[j];
            if (! tag_colors.hasOwnProperty(class_str)) {
                tag_colors[class_str] = colors[color_index];
            }
        }
    }
    else {
        $btn.removeClass("active");
        // Free up this tag's color.
        colorSansPound = tag_colors[tag_name].substring(1);
        delete tag_colors[tag_name];
        activeTags.splice(activeTags.indexOf(tag_name), 1);
    }

    // Apply colors (using hueRamps)
    $btn.toggleClass('noramp_' + colorSansPound);
    var classToSelect, classToToggle;
    /*if (rank_type != 'count') { // TODO: NEEEEED to fix this with ramped tags, given switch from class tags to data-keys
        for (var j = 1; j <= num_ramps; j++) {
            classToSelect = rank_type + j + '.' + tag_name;
            classToToggle = color_ramps ? rank_type + colorSansPound
                                     : 'noramp_' + colorSansPound;
            $('.' + classToSelect).toggleClass(classToToggle);
        }
    } else {
        //classToSelect = tag_name;
        classToToggle = 'noramp_' + colorSansPound;
        //$('span.' + classToSelect).toggleClass(classToToggle);
        $('.tagToken[data-key~="' + tag_name + '"]').toggleClass(classToToggle);
    }*/
    updateTagColorsD3();

    storeTagColors();
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(
        updateLineGraphCSS,
        100
    );
};

var getNextUnusedColorIndex = function(colors, tag_colors) {
    // The index to use when all other colors are used up.
    var index_to_return = colors.length - 1;
    for (var j = 0; j < colors.length - 1; j++) {
        var color = colors[j];
        if (countProperties(tag_colors) === 0) {
            index_to_return = j;
            break;
        }
        else {
            // Verify that this color is unused.
            var is_unused = true;
            for (var prop in tag_colors) {
                if (tag_colors.hasOwnProperty(prop) && color === tag_colors[prop]) {
                    is_unused = false;
                }
            }
            if (is_unused) {
                index_to_return = j;
                break;
            }
        }
    }
    return index_to_return;
};

// Function for updating tag representation when tagRepState has changed
var updateTagRep = function() {
    d3.select('#tagRep_name').text(tagRepState.tag_name);
    wordDistribution = buildTagRep(typeof(model_name) === 'undefined' ? 'undefined' : model_name,
        tagRepState.tag_name,
        tag_colors[tagRepState.tag_name],
        model_type,
        tagRepState.repType,
        tagRepState.repScope,
        '#tagRepContainer',
        {
            'ranking_type': rank_type,
            'tokens': tokens
        }
    );
};
var showTagRep = function(d) {
    event.preventDefault();
    tagRepState.tag_name = d.tagName;
    updateTagRep();
    $('#tagRepModal').modal('show');
};

// A function for populating the tag toggle buttons on the left
var buildTagTogglers = function(countsByTag, totalCount) {
    // First, flatten countsByTag into an array to become D3 data
    var togglerData = [];
    for (var tagName in countsByTag) {
        togglerData.push({
            'tagName': tagName,
            'count': countsByTag[tagName]
        });
    }
    togglerData.sort(function(a,b) { return b.count - a.count; });

    // Then populate toggler list with D3
    var toggleContainer = d3.select('#tag_buttons');
    toggleContainer.selectAll('.tagToggle')
        .data(togglerData)
        .enter().append('button')
        .attr('class', 'tagToggle btn btn-small btn-tag span12') // TODO: add btn_size_class to this, too
        .attr('type', 'button')
        .attr('id', function(d) { return 'btn-' + d.tagName; })
        .attr('data-key', function(d) { return d.tagName; })
        .attr('title', function(d) {
            return Math.round(10000 * d.count / totalCount)/100 + '%';
        })
        .html(function(d) {
            var barWidth = 100 * d.count / totalCount;
            var htmlStr = '<span class="btn-label">' + d.tagName + '</span>';
            htmlStr += '<span class="fill_bar" style="width: ' + barWidth + '%; height: 60%; top: 20%; bottom: auto;"></span>';
            return htmlStr;
        })
        .on('mouseover', function(d) {
            brushTag(d.tagName);
        })
        .on('mouseout', function(d) {
            unbrushTag(d.tagName);
        })
        .on('click', function(d) {
            toggleTag(d.tagName);
        });
        //.on('contextmenu', showTagRep);

    // Also add buttons for showing the tag representations
    d3.selectAll('.tagToggle')
        .append('span')
        .attr('class', 'showTagRepBtn pull-right')
        .attr('title', 'Show distribution of this tag')
        .html('<i class="fa fa-bar-chart rotateClockwise"></i><i class="fa fa-cloud"></i>')
        .on('click', function(d) {
            d3.event.stopPropagation();
            showTagRep(d);
        })
        .on('mouseover', function(d) {
            d3.select(this).classed('showTagRepBtnHighlight', true);
        })
        .on('mouseout', function(d) {
            d3.select(this).classed('showTagRepBtnHighlight', false);
        });

    // Update buttons to current state (colors, toggle state, etc.)
    for (var tag_name in tag_colors) {
        $('#btn-' + tag_name).addClass('active');
    }
    retrieveAndApplyTagColors();
    updateTagNames();
};

var lgWorker;
var kickOffLGworker = function(tokens) {
    $("#right_sidebar_content")
        .html('')
        .addClass("withLoadingIndicator");
    lgWorker = new Worker($LG_WORKER_URL);

    lgWorker.onmessage = function(e) {
        if (e.data.task === 'buildSAT') {
            if (e.data.message === 'success') {
                console.log('SAT successfully built.');
                lgWorker.postMessage({
                    'task': 'getTagLines',
                    'windowSize': $('#windowSlider').val()
                });
                // Store tag distribution to be output.
                tagDistribution =  e.data.tagCounts.countsByTag;
                // Then build the toggle buttons
                buildTagTogglers(e.data.tagCounts.countsByTag, e.data.tagCounts.totalCount);
            } else {
                console.log('SAT build FAILED');
            }
        } else if (e.data.task === 'getTagLines') {
            if (e.data.message === 'success') {
                console.log('tagLines successfully computed.');
                lgState.tagLines = e.data.tagLines;
                lgState.maxWindow = e.data.maxWindow;
                lgState.numWindows = e.data.numWindows;
                buildLineGraphTV();
            } else {
                console.log('getTagLines FAILED');
            }
        }
    };

    lgWorker.postMessage({
        'task': 'buildSAT',
        'tokens': tokens
    });
};

/* End code for tag buttons in sidebar */

/* Code for synced brushing */

var brushTag = function(tag_key) {
    // Add ".highlight" to related elements.
    d3.selectAll(".tag_line_graph g[data-key='" + tag_key + "']")
        .classed("highlight", true);
    d3.selectAll("#sidebar .btn-tag[data-key='" + tag_key + "']")
        .classed("highlight", true);
    d3.selectAll(".popover rect.bar[data-key='" + tag_key + "']")
        .style("fill", "#ffff99");
    d3.selectAll(".tagToken[data-key~='" + tag_key + "']")
        .classed("highlight", true);
};

var unbrushTag = function(tag_key) {
    d3.selectAll(".tag_line_graph g[data-key='" + tag_key + "']")
        .classed("highlight", false);
    d3.selectAll("#sidebar .btn-tag[data-key='" + tag_key + "']")
        .classed("highlight", false);
    d3.selectAll(".popover rect.bar[data-key='" + tag_key + "']")
        .style("fill", false);
    d3.selectAll(".tagToken[data-key~='" + tag_key + "']")
        .classed("highlight", false);
};

/* End code for synced brushing */

// Code for changing the text tagging display mode.
var changeTagDisplayMode = function(new_mode_value) {
    if (new_mode_value !== undefined) {
        tags_top_only = new_mode_value;
    }
    else {
        tags_top_only = ! tags_top_only;
    }
    if (tags_top_only) {
        $(".btn-group.color_ramps .btn").addClass("tags_top_only_on");
        $(".btn-group.tags_top_only .btn.btn-tags_top_only_on").addClass("btn-primary");
        $(".btn-group.tags_top_only .btn.btn-tags_top_only_off").removeClass("btn-primary");
    }
    else {
        $(".btn-group.color_ramps .btn").removeClass("tags_top_only_on");
        $(".btn-group.tags_top_only .btn.btn-tags_top_only_on").removeClass("btn-primary");
        $(".btn-group.tags_top_only .btn.btn-tags_top_only_off").addClass("btn-primary");
    }
    updateLineGraphCSS();
};

var changeColorRampsMode = function(new_mode_value) {
    if (new_mode_value !== undefined) {
        color_ramps = new_mode_value;
    }
    else {
        color_ramps = ! color_ramps;
    }
    if (color_ramps) {
        $(".btn-group.tags_top_only .btn").addClass("color_ramps_on");
        $(".btn-group.color_ramps .btn.color_ramps_on").addClass("btn-primary");
        $(".btn-group.color_ramps .btn.color_ramps_off").removeClass("btn-primary");
    }
    else {
        $(".btn-group.tags_top_only .btn").removeClass("color_ramps_on");
        $(".btn-group.color_ramps .btn.color_ramps_on").removeClass("btn-primary");
        $(".btn-group.color_ramps .btn.color_ramps_off").addClass("btn-primary");
    }
    retrieveAndApplyTagColors();
};

var changeRankingType = function(new_type) {
    var oldRankType = rank_type;
    rank_type = new_type;
    retrieveAndApplyTagColors(oldRankType);
};

var next_token_buffer = function() {
    var $hf = $('.html_formatter');
    var $mc = $('#main_content');
    var nextBuffer = get_passage_html(currPageEnd, currPageEnd + tokenBuffer);
    if (nextBuffer !== '') {
        var linesAdded = $(nextBuffer).filter('.line').length;
        var oldHeight = $hf.height();
        $hf.append(nextBuffer);
        var heightAdded = $hf.height() - oldHeight;
        //console.log(linesAdded + ' ' + oldHeight + ' ' + heightAdded);
        $('.html_formatter .line').slice(0, linesAdded).remove();
        $mc.scrollTop(Math.max($mc.scrollTop() - heightAdded, $('.prev').height())); // Hack to keep it from immediately triggering prev_token_buffer
        retrieveAndApplyTagColors();
        currPageStart += tokenBuffer;
        currPageEnd += tokenBuffer;
        d3.select('#window_box')
            .attr('y', 100*(currPageStart / tokens.length) + '%')
            .attr('height', 100*(currPageEnd - currPageStart)/tokens.length + '%')
    }
};

var prev_token_buffer = function() {
    var $hf = $('.html_formatter');
    var prevBuffer = get_passage_html(currPageStart - tokenBuffer, currPageStart);
    if (prevBuffer !== '') {
        var linesAdded = $(prevBuffer).filter('.line').length;
        var oldHeight = $hf.height();
        $hf.prepend(prevBuffer);
        var heightAdded = $hf.height() - oldHeight;
        $('.html_formatter .line').slice(-1 * linesAdded).remove();
        $('#main_content').scrollTop(heightAdded);
        retrieveAndApplyTagColors();
        currPageStart -= tokenBuffer;
        currPageEnd -= tokenBuffer;
        d3.select('#window_box')
            .attr('y', 100*(currPageStart / tokens.length) + '%')
            .attr('height', 100*(currPageEnd - currPageStart)/tokens.length + '%')
    }
};

var go_to_token = function(token) {
    //currPageStart = Math.max(0, parseInt(token - tokensPerPage/2)); // This code would go to a window centered around the given token
    currPageStart = parseInt(token); // This code goes to a window STARTING with the given token
    currPageEnd = currPageStart + tokensPerPage;
    $('.html_formatter').html(get_passage_html(currPageStart, currPageEnd));
    $('#main_content').scrollTop(50);
    d3.select('#window_box')
        .attr('y', 100*(currPageStart / tokens.length) + '%')
        .attr('height', 100*(currPageEnd - currPageStart)/tokens.length + '%');
    retrieveAndApplyTagColors();
};

// Index parameters are rounded to the next line break
// startIndex inclusive
// endIndex non-inclusive
// splitIntoLines controls whether or not the text is broken into line spans.
// Tokens look like:
// token, tokenToMatch, endReason, tag, indexWithinTag
var get_passage_html = function(roughStartIndex, roughEndIndex, splitIntoLines) {
    splitIntoLines = typeof splitIntoLines !== 'undefined' ? splitIntoLines : true;

    // Get tokens on either end to fill in lines.
    var startIndex = roughStartIndex;
    if (startIndex > tokens.length) {
        return '';
    } else if (startIndex > 0) {
        // Look backward for a newline rather than forward, so that we include the line with the given token
        while (startIndex > 0 && tokens[startIndex - 1][2][0] !== 'n') {
            startIndex -= 1;
        }
        /*while (startIndex < tokens.length && tokens[startIndex - 1][2][0] != 'n') {
            startIndex += 1;
        }*/
    } else {
        startIndex = 0;
    }
    var endIndex = roughEndIndex;
    if (endIndex <= 0) {
        return '';
    } else if (endIndex < tokens.length) {
        // Look backward for a newline rather than forward, so that we include the line with the given token
        while (endIndex > 0 && tokens[endIndex - 1][2][0] !== 'n') {
            endIndex -= 1;
        }
        /*while (endIndex < tokens.length && tokens[endIndex-1][2][0] != 'n') {
            endIndex += 1;
        }*/
    } else {
        endIndex = tokens.length;
    }
    if (startIndex === 0 && endIndex === 0) {
        endIndex = tokens.length;
    }
    var subtokens = tokens.slice(startIndex, endIndex);

    // Create the string of HTML
    var htmlStr;
    if (splitIntoLines) {
        htmlStr = '<span class="line">';
    } else {
        htmlStr = '';
    }
    var token, isSearchMatch, isTagged, classStr, dataKeyStr;
    for (var i = 0; i < subtokens.length; i++) {
        token = subtokens[i];
        isSearchMatch = !(matchIndices.indexOf(i + startIndex) === -1);
        isTagged = token.length > 3 && token[3] !== '';

        // Build opening span tag if necessary (e.g. searchMatch or tag)
        if (isSearchMatch || isTagged) {
            classStr = '';
            if (isTagged) {
                classStr += 'tagToken ';
                dataKeyStr = '';
                for (var tagIndex = 3; tagIndex < token.length; tagIndex += 2) {
                    dataKeyStr += token[tagIndex] + ' ';
                }
            }
            if (isSearchMatch) { classStr += 'searchMatch '; }

            htmlStr += '<span class="' + classStr + '" ';
            if (isTagged) { htmlStr += 'data-key="' + dataKeyStr + '" title="' + dataKeyStr + '" '; }
            htmlStr += '>';
        }

        // Print the token
        htmlStr += token[0];

        // Close span if necessary
        if (isTagged || isSearchMatch) {
            htmlStr += '</span>';
        }

        // Print the joiner
        if (token[2] === 's') {
            htmlStr += ' ';
        //} else if (token[2] == 'n') {
        } else if (token[2][0] === 'n') {
            if (splitIntoLines) {
                htmlStr += '<br /></span><span class="line">'.repeat(token[2].length);
            } else {
                htmlStr += '<br />'.repeat(token[2].length);
            }
        }
    }
    if (splitIntoLines) {
        htmlStr += '</span>';
    }
    return htmlStr;
};

// Attach event listeners with jQuery.
var main = function() {
    // Disable unavailable ranking types
    var $GET_RANKING_TYPES_URL = flask_util.url_for('utils_get_ranking_types', {
        model_name: model_name
    });
    d3.json($GET_RANKING_TYPES_URL, function(json) {
        // Remove radio buttons that the current model doesn't support
        if (json['rankingTypes'].length === 1) {
            $('#text_view_options').remove();
        }
    });

    var $main_content = $('#main_content');
    var $html_formatter = $('.html_formatter');

    // Kick off the line graph builder and token counter
    kickOffLGworker(tokens);
    $('#windowSlider').change(function() {
        $("#right_sidebar_content").addClass("withLoadingIndicator");
        var ws = $(this).val();
        console.log(ws);
        lgWorker.postMessage({
            'task': 'getTagLines',
            'windowSize': ws
        })
    });

    // Clear tags button functionality
    $("#clear_all_tags").on("click", function() {
        $("#sidebar .btn-tag.active").click();
    });

    // Implement clicking functionality within tagged text
    $main_content
        .on("contextmenu", ".tagToken", function(event) {
            event.preventDefault();
            if (model_type === 'topic') {
                var word = $.trim($(this).text());
                // Open word in wordRankings
                // TODO: implement wordRankings
                /*if (typeof(model_name) != 'undefined') {
                    window.open(flask_util.url_for('wordRankings',
                        { model_name: model_name,
                          rankingType: rank_type,
                          wordColorPairs: word.toLowerCase() + ':red'
                        }));
                }*/
            }
        })
        .on("click", ".tagToken", function(event) {
            event.preventDefault();
            var dks = d3.select(this).attr('data-key').split(' ');
            /*for (var i = 0; i < dks.length; i++) {
                if (dks[i] !== '') {
                    toggleTag(dks[i]);
                }
            }*/
            toggleTag(dks[0]); // TODO: this is a temporary hack -- don't want to toggleTag for things like sal1 and freq5. Future: overlapping tags?
        });

    // Implement infinite scrolling
    var scrollText = function() {
        if ($main_content.scrollTop() >= $html_formatter.height() - $main_content.height()) {
            next_token_buffer();
        } else if ($main_content.scrollTop() === 0) {
            prev_token_buffer();
        }
    };
    $main_content.scroll(scrollText);
    $html_formatter.html(get_passage_html(currPageStart, currPageEnd));
    retrieveAndApplyTagColors();
    $main_content.scrollTop(0);

    // Specify the zoomBehavior that will be called in buildLineGraphTV
    zoomBehavior = d3.behavior.zoom()
        .on('zoom', function() {
            var wheelDeltaY = d3.event.sourceEvent.wheelDeltaY;
            if (wheelDeltaY < 0) {
                next_token_buffer();
            } else if (wheelDeltaY > 0) {
                prev_token_buffer();
            }
            return false;
        });

    // Rebuild the line graph when window is resized
    d3.select(window)
        .on('resize', function() {
            console.log('Resizing...');
            buildLineGraphTV();
        });

    // Set functionality for the tag representation buttons
    if (model_type === 'topic') {
        tagRepState = {
            'repType': 'bar',
            'repScope': 'corpus'
        };
        d3.select('#downloadWordDistBtn').remove(); // TODO: this doesn't work for topic models because of race condition in Representations.js buildTagRep()
    } else if (model_type === 'singleText') {
        tagRepState = {
            'repType': 'bar',
            'repScope': 'doc'
        };
        d3.select('#tagRepScope_grp').remove();
    }
    d3.select('#tagRepScope_' + tagRepState.repScope).classed('active', true);
    d3.select('#tagRep_' + tagRepState.repType).classed('active', true);
    d3.selectAll('.tagRepToggle')
        .on('click', function() {
            tagRepState.repType = d3.select(this).attr('id').split('_')[1];
            updateTagRep();
        });
    d3.selectAll('.tagRepScopeToggle')
        .on('click', function() {
            tagRepState.repScope = d3.select(this).attr('id').split('_')[1];
            updateTagRep();
        });

    // Set functionality on data download buttons
    // Download tokens as CSV
    d3.select('#downloadTokensBtn').on('click', function() {
        d3.select(this)
            .attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(d3.csv.formatRows(tokens)));
    });
    // Download rules as CSV
    if (typeof rulesCSVstr !== 'undefined' && typeof rules !== 'undefined') {
        d3.select('#downloadRulesBtn').on('click', function() {
            d3.select(this)
                .attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(rulesCSVstr));
        });
    } else {
        $('#downloadRulesBtn').hide();
    }
    // Download raw text as TXT
    d3.select('#downloadTextBtn').on('click', function() {
        d3.select(this)
            .attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(tokensToText(tokens)));
    });
    // Download the tag distribution for the full document
    d3.select('#downloadTagDistBtn').on('click', function() {
        tdArray = [];
        for (var tagName in tagDistribution) {
            tdArray.push([tagName, tagDistribution[tagName]]);
        }
        tdArray.sort(function(a,b) { return b[1] - a[1]; });
        d3.select(this)
            .attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(d3.csv.formatRows(tdArray)));
    });
    // Download the word distribution for the represented tag
    d3.select('#downloadWordDistBtn').on('click', function() {
        wdArray = [];
        for (var i = 0; i < wordDistribution.length; i++) {
            wdArray.push([wordDistribution[i].word, wordDistribution[i].weight]);
        }
        wdArray.sort(function(a,b) { return b[1] - a[1]; });
        d3.select(this)
            .attr('download', 'tagDist_' + tagRepState.tag_name + '.csv')
            .attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(d3.csv.formatRows(wdArray)));
    });

    // Create search functionality
    var conductSearch = function(tmpSearchPhrase) {
        // If we're searching on the same phrase, we'll navigate to the next one
        if (tmpSearchPhrase === searchPhrase) {
            currMatchIndex = (currMatchIndex + 1) % matchIndices.length;
        }
        // Otherwise, new search. Navigate to the first one.
        else {
            searchPhrase = tmpSearchPhrase;

            // Remove searchMatch class from current matches
            d3.selectAll('.searchMatch').classed('searchMatch', false);

            matchIndices = searchTokensFor(searchPhrase);
            console.log(matchIndices);
            var context;
            var matchData = new Array(matchIndices.length);
            for (var i = 0; i < matchIndices.length; i++) {
                context = '...' +  tokensToText(tokens.slice(Math.max(0, matchIndices[i] - 5),
                                                    Math.min(tokens.length-1, matchIndices[i] + 5))) + '...'
                    .replace(/\n+/g, ' ');
                console.log(matchIndices[i] + ': "' + context + '"');
                matchData[i] = {
                    'token': matchIndices[i],
                    'context': context
                };
            }

            // Add lines for each search match to the line graph overview
            var svg = d3.select('.tag_line_graph');
            var tokenScale = d3.scale.linear()
                .domain([0, tokens.length])
                .range([0, svg.attr('height')]);
            var searchMatchBar = svg.selectAll('.searchMatchBar')
                .data(matchData, function(x) { return x.token; }); // Compare match tokens for (rough) equivalency
            searchMatchBar
                .enter().append('rect')
                .attr('class', 'searchMatchBar')
                .attr('x', 0)
                .attr('y', function(d) {
                    return tokenScale(d.token);
                })
                .attr('width', '100%')//'40px')
                .attr('height', 5)
                .style('fill', searchMatchBarColor)
                .style('opacity', 0.4)
                .on('mouseover', function() {
                    d3.select(this).attr('height', 8);
                })
                .on('mouseout', function() {
                    d3.select(this).attr('height', 5);
                })
                .on('click', function(d) {
                    go_to_token(d.token);
                });
            searchMatchBar
                .exit()
                .remove();
            searchMatchBar.append('svg:title')
                .text(function(d) { return d.context; });

            currMatchIndex = 0;
        }

        // Scroll to next match index
        if (matchIndices.length > 0) {
            go_to_token(matchIndices[currMatchIndex]);
        }
    };
    d3.select('#tokenSearcher')
        .on('submit', function() {
            d3.event.preventDefault();
            conductSearch(d3.select(this).select('input').property('value'));
        });
    d3.select('#searchClear')
        .on('click', function() {
            d3.select('#tokenSearcher input').property('value', '');
            conductSearch('');
            d3.selectA
        });
    // Let's override the CTRL-F functionality for searching
    onkeydown = function(e){
      if(e.ctrlKey && e.keyCode === 'F'.charCodeAt(0)){
        e.preventDefault();
        $('#tokenSearcher input').focus().select();
      }
    };
    
    // Attach cross-tab tag toggling
    if (typeof(model_name) !== 'undefined') {
        window.addEventListener('storage', function() {
            if (event.key === model_name) {
                retrieveAndApplyTagColors();
            }
        }, false);
    }

    changeColorRampsMode(color_ramps);

    // Implement settings changes
    $(".btn-group.tags_top_only .btn.btn-tags_top_only_on").click(function() {
        changeTagDisplayMode(true);
    });
    $(".btn-group.tags_top_only .btn.btn-tags_top_only_off").click(function() {
        changeTagDisplayMode(false);
    });
    $(".btn-group.color_ramps .btn.color_ramps_on").click(function() {
        changeColorRampsMode(true);
    });
    $(".btn-group.color_ramps .btn.color_ramps_off").click(function() {
        changeColorRampsMode(false);
    });
    $('#rankingTypeRadioGroup').change(function() {
        var selectedType = $('input[name=rankingType]:checked').attr('id');
        changeRankingType(selectedType);
    });
    // Initialize rank_type check box as type set in code
    d3.select('#' + rank_type).property('checked', true);

    retrieveAndApplyTagColors();
};

if (typeof(waitToRun) === 'undefined' || !(waitToRun) ) {
    main();
}
