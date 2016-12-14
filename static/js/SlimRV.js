/**
 * Created with PyCharm.
 * User: Eric
 * Date: 11/19/13
 * Time: 2:59 PM
 * To change this template use File | Settings | File Templates.
 */
var wrNS = {};
wrNS.w = 1200;
wrNS.h = 400;
wrNS.buffer = 10;
wrNS.topicW = 10;
wrNS.wordH = 2;
wrNS.maxTopicH = 200;
wrNS.transdur = 1000;
wrNS.queryWordLabelX = 100;
wrNS.queryWordLabelY = 3*wrNS.buffer;
wrNS.queryWordLabelH = 15;

var tvNS = {};
tvNS.maxBarWidth = 50;
tvNS.barHeight = 10;
tvNS.barBuffer = 3;
tvNS.barXoffset = 100;
tvNS.barYoffset = 0;
tvNS.w = 300;
tvNS.barFill = 'red';
tvNS.barBorder = 'black';
tvNS.barFillOpacity = .6;
tvNS.numWords = 20;

var state = {};
var view;
var defaultColor = '#FFFF33';

var initForms = function() {
    $('#addWordsForm').on('submit', function(event) {
        event.preventDefault();
        var words = $('#addWordsInput').val().split(' ');
        var color = $('#colorSelect').val();
        $('#addWordsForm').addClass('withLoadingIndicator');
        var colors = new Array(words.length);
        for (var i = 0; i < words.length; i++) {
            colors[i] = color;
        }
        addWords(words, colors, true)
        $('#addWordsInput').val('').focus();
    })
};

var initWordRankings = function(containerID, corpusName, words, colors, wordsPerTopic, maxWordsPerTopic, rankings) {
    var viewContainer;
    if (containerID === null) {
        viewContainer = d3.select(document.createElement("div"));
    }
    else {
        viewContainer = d3.select(containerID);
    }

    state.words = words;
    state.colors = colors;
    state.wordsPerTopic = wordsPerTopic;
    state.rankings = rankings;
    state.numTopics = wordsPerTopic.length;
    state.currTopicOrder = new Array(state.numTopics);
    for (var i=0; i<state.numTopics; i++) {
        state.currTopicOrder[i] = i;
    }
    state.xScale = d3.scale.linear()
        .domain([0, state.numTopics-1])
        .range([wrNS.queryWordLabelX + wrNS.buffer, wrNS.queryWordLabelX + wrNS.buffer + (state.numTopics-1)*(wrNS.topicW+1)]);
    state.yScale = d3.scale.linear()
        .domain([0, maxWordsPerTopic])
        .range([wrNS.buffer, wrNS.buffer + wrNS.maxTopicH]);
    state.hScale = d3.scale.linear()
        .domain([0, maxWordsPerTopic])
        .range([0, wrNS.maxTopicH]);

    view = viewContainer.html('')
        .append('svg:svg')
        .attr('width', state.xScale.range()[1] + wrNS.topicW + 2*wrNS.buffer)
        .attr('height', wrNS.h);

    // Background box for vis
    view.append('svg:rect')
        .attr('x', state.xScale(0)-2)
        .attr('y', state.yScale(0)-2)
        .attr('width', (state.numTopics)*(wrNS.topicW+1) + 4)
        .attr('height', wrNS.maxTopicH + 4)
        .style('fill', 'lightgray');

    // Bars indicating size of each topic
    state.topicBars = new Array(state.numTopics);
    for (var i = 0; i < state.numTopics; i++) {
        state.topicBars[i] = {'topic':i, 'totWords':wordsPerTopic[i]};
    }
    updateTopicBars();

    // Word lines
    state.wordLines = [];
    var word, color;
    for (var i = 0; i < words.length; i++) {
        word = words[i];
        color = colors[i];
        for (var j = 0; j < rankings[word].length; j++) {
            if (rankings[word][j] >= 0) {
                state.wordLines.push(
                    {'word':word,
                     'color':color,
                     'topic':j,
                     'rank':rankings[word][j]})
            }
        }
    }
    updateWordLines();

    // Topic labels
    d3.json(topicNamesURL, function(json) {
        state.topicLabels = new Array(state.numTopics);
        if (json.topicNames == undefined) {
            for (var i = 0; i < state.numTopics; i++) {
                state.topicLabels[i] = {'topic':i, 'name':'Topic '+i};
            }
        } else {
            for (var i = 0; i < state.numTopics; i++) {
                state.topicLabels[i] = {'topic':i, 'name':json.topicNames[i]};
            }
        }
        updateTopicLabels();
    });

    // Word labels
    updateWordLabels();

    state.sortingBy = state.words.slice(0);
    sortTopicsBy(state.sortingBy);

    // Initiate topic colors from localStorage
    var topicColorObj = getTopicColorObj();
    state.topicColors = new Array(state.numTopics);
    for (var i = 0; i < state.numTopics; i++) {
        if (i in topicColorObj) {
            state.topicColors[i] = topicColorObj[i];
        } else {
            state.topicColors[i] = defaultColor;
        }
    }
};

var getTopicColorObj = function() {
    var topicColorAssignments;
    if (localStorage[model_name] == undefined) {
        topicColorAssignments = [];
    } else {
        topicColorAssignments = localStorage[model_name].split(';');
    }
    var topicColorObj = {};
    var tmp;
    for (var i = 0; i < topicColorAssignments.length; i++) {
        tmp = topicColorAssignments[i];
        if (tmp != '') {
            topicColorObj[parseInt(tmp.split(':')[0].split('_')[1])] = tmp.split(':')[1];
        }
    }
    return topicColorObj;
};

var updateTopicBars = function() {
    var topicBar = view.selectAll('.topicBar')
        .data(state.topicBars, function(d) { return d.topic; });
    topicBar.enter()
        .append('svg:rect')
        .attr('class', 'topicBar');
    topicBar
        .attr('x', function(d) { return getTopicX(d.topic); })
        .attr('y', state.yScale(0))
        .attr('width', wrNS.topicW)
        .attr('height', function(d) { return state.hScale(d.totWords); })
        .style('fill', 'gray')
        .on('mouseover', function(d) {
            brushTopic(d.topic, true);
        })
        .on('mouseout', function(d) {
            brushTopic(d.topic, false);
        })
        .on('click', function(d) {
            updateTopicDisplay(d.topic);
        });
    topicBar.exit()
        .remove();
};
var updateWordLines = function() {
    var wordLine = view.selectAll('.wordLine')
        .data(state.wordLines, function(d) { return d.word + ',' + d.topic; });
    wordLine.enter()
        .append('svg:rect')
        .attr('class', 'wordLine');
    wordLine
        .attr('x', function(d) { return getTopicX(d.topic); })
        .attr('y', function(d) { return Math.max(state.yScale(d.rank) - (wrNS.wordH / 2.0), state.yScale(0)); })
        .attr('width', wrNS.topicW)
        .attr('height', wrNS.wordH)
        .style('fill', function(d) { return d.color; })
        .on('mouseover', function(d) {
            brushWord(d.word, true);
        })
        .on('mouseout', function(d) {
            brushWord(d.word, false);
        });
    wordLine.exit()
        .remove();
};
var updateTopicLabels = function() {
    var topicLabel = view.selectAll('.topicLabel')
        .data(state.topicLabels, function(d) { return d.topic; });
    topicLabel.enter()
        .append('svg:text')
        .attr('class', 'topicLabel')
        .text(function(d) { return d.name; });
    topicLabel
        .attr('x', function(d) { return getTopicX(d.topic) + wrNS.topicW/2; })
        .attr('y', wrNS.buffer + state.yScale.range()[1])
        .attr('text-anchor', 'start')
        .attr('alignment-baseline', 'central')
        .attr('transform', function(d) {
            var midX = getTopicX(d.topic) + wrNS.topicW/2;
            var midY = wrNS.buffer + state.yScale.range()[1];
            return 'rotate(90 ' + midX + ' ' + midY + ')';
        })
        .attr('cursor', 'default')
        .style('font-size', wrNS.topicW)
        .on('mouseover', function(d) {
            brushTopic(d.topic, true);
        })
        .on('mouseout', function(d) {
            brushTopic(d.topic, false);
        })
        .on('click', function(d) {
            updateTopicDisplay(d.topic);
        });
    topicLabel.exit()
        .remove();
};
var updateWordLabels = function() {
    var queryWordLabel = view.selectAll('.queryWordLabel')
        .data(state.words, String);
    queryWordLabel.enter()
        .append('svg:text')
        .attr('class', 'queryWordLabel')
        .text(function(d) { return d; });
    queryWordLabel
        .attr('text-anchor', 'end')
        .attr('cursor', 'pointer')
        .style('fill', function(d,i) { return state.colors[i]; })
        .attr('x', wrNS.queryWordLabelX - 15) // The extra space is for the word deleters (see below)
        .attr('y', function(d,i) { return wrNS.queryWordLabelY + i*wrNS.queryWordLabelH})
        .on('mouseover', function(d) {
            brushWord(d, true);
        })
        .on('mouseout', function(d) {
            brushWord(d, false);
        })
        .on('click', function(d) {
            state.sortingBy = [d];
            sortTopicsBy(state.sortingBy);
        })
        .on('contextmenu', function(d) {
            event.preventDefault();
            var thisIndex = state.sortingBy.indexOf(d);
            if (thisIndex == -1) {
                state.sortingBy.push(d);
                sortTopicsBy(state.sortingBy);
            } else {
                state.sortingBy.splice(thisIndex, 1);
                sortTopicsBy(state.sortingBy);
            }
        });
    queryWordLabel.exit()
        .remove();

    var wordDeleter = view.selectAll('.wordDeleter')
        .data(state.words, String);
    wordDeleter.enter()
        .append('svg:text')
        .attr('class', 'wordDeleter')
        .text('x');
    wordDeleter
        .attr('text-anchor', 'end')
        .attr('cursor', 'pointer')
        .style('fill', 'gray')
        .attr('x', wrNS.queryWordLabelX)
        .attr('y', function(d,i) { return wrNS.queryWordLabelY + i*wrNS.queryWordLabelH})
        .on('mouseover', function(d) {
            brushWord(d, true);
            d3.select(this).style('fill','black');
        })
        .on('mouseout', function(d) {
            brushWord(d, false);
            d3.select(this).style('fill','gray');
        })
        .on('click', function(d) {
            removeWord(d);
        });
    wordDeleter.exit()
        .remove();

    view.select('svg')
        .attr('height', Math.max(wrNS.queryWordLabelY + state.words.length*wrNS.queryWordLabelH,
                                 wrNS.h));
};

var addWords = function(words, colors, sortByThem) {
    var wordsStr = words.join(',');
    var wrURL = flask_util.url_for('get_word_rankings_json', {model_name:model_name, words:wordsStr, rankingType:rankingType})
    d3.json(wrURL, function(json) {
        state.words = state.words.concat(words);
        state.colors = state.colors.concat(colors);
        var word;
        for (var i = 0; i < words.length; i++) {
            word = words[i];
            state.rankings[word] = json.rankings[word]
            for (var j = 0; j < state.rankings[word].length; j++) {
                if (state.rankings[word][j] >= 0) {
                    state.wordLines.push({
                        'word':word,
                        'color':colors[i],
                        'topic':j,
                        'rank':state.rankings[word][j]
                    });
                }
            }
        }

        updateWordLabels();
        updateWordLines();
        if (sortByThem) {
            sortTopicsBy(state.sortingBy = words);
        }
        $('#addWordsForm').removeClass('withLoadingIndicator');
    });
};

var removeWord = function(word) {
    var wordIndex = state.words.indexOf(word);
    if (wordIndex != -1) {
        state.words.splice(wordIndex,1);
        state.colors.splice(wordIndex,1);
        var tmpWL = [];
        for (var i = 0; i < state.wordLines.length; i++) {
            if (state.wordLines[i].word != word) {
                tmpWL.push(state.wordLines[i]);
            }
        }
        state.wordLines = tmpWL;

        updateWordLabels();
        updateWordLines();
    }
}

var brushWord = function(word, bool) {
    d3.selectAll('.wordLine').filter(function() {
        return d3.select(this).data()[0].word == word;
    }).classed('highlight', bool);
    d3.selectAll('.queryWordLabel').filter(function() {
        return d3.select(this).data()[0] == word;
    }).classed('highlight', bool);
};

var brushTopic = function(topic, bool) {
    d3.selectAll('.topicLabel').filter(function() {
        return d3.select(this).data()[0].topic == topic;
    }).classed('highlight', bool);
    d3.selectAll('.topicBar').filter(function() {
        return d3.select(this).data()[0].topic == topic;
    }).classed('highlight', bool);
    d3.selectAll('.queryWordLabel').filter(function() {
        var word = d3.select(this).data()[0];
        return state.rankings[word][topic] != -1;
    }).classed('highlight', bool);
};

var sortTopicsBy = function(words) {
    // Update styles, then sort
    d3.selectAll('.queryWordLabel').filter(function() {
        return words.indexOf(d3.select(this).data()[0]) != -1;
    }).classed('sortingBy', true);
    d3.selectAll('.queryWordLabel').filter(function() {
        return words.indexOf(d3.select(this).data()[0]) == -1;
    }).classed('sortingBy', false);
    // Now sort
    var mergedRanks = new Array(state.numTopics);
    var rankedWords = new Array(state.numTopics);
    var mergedRank, store, word;
    for (var i = 0; i < state.numTopics; i++) {
        mergedRank = 0;
        rankedWords[i] = 0;
        for (var j = 0; j < words.length; j++) {
            word = words[j];
            if (state.rankings[word][i] != -1) {
                mergedRank += state.rankings[word][i];
                rankedWords[i] += 1;
            }
        }
        mergedRanks[i] = rankedWords[i] > 0 ? mergedRank : -1;
    }
    state.currTopicOrder.sort(function(a,b) {
        if (rankedWords[a] == rankedWords[b]) {
            var aRank = mergedRanks[a];
            var bRank = mergedRanks[b];
            if (aRank == -1 && bRank != -1) {
                return 1;
            } else if (aRank != -1 && bRank == -1) {
                return -1;
            } else {
                return aRank - bRank;
            }
        } else {
            return rankedWords[b] - rankedWords[a];
        }
    });

    view.selectAll('.wordLine, .topicBar')
        .transition()
        .duration(wrNS.transdur)
        .attr('x', function(d) { return getTopicX(d.topic); });
    view.selectAll('.topicLabel')
        .transition()
        .duration(wrNS.transdur)
        .attr('x', function(d) { return getTopicX(d.topic) + wrNS.topicW/2; })
        .attr('transform', function(d) {
            var midX = getTopicX(d.topic) + wrNS.topicW/2;
            var midY = wrNS.buffer + state.yScale.range()[1];
            return 'rotate(90 ' + midX + ' ' + midY + ')';
        })
};

var getTopicX = function(topic) {
    return state.xScale(state.currTopicOrder.indexOf(topic));
};

var updateTopicDisplay = function(topicNum) {
    tvNS.currTopic = topicNum;

    // Build tag representation with Representations.js
    buildTagRep(
        model_name,
        'topic_' + topicNum,
        state.topicColors[tvNS.currTopic],
        'topic',
        'bar',
        'corpus',
        '#topicView',
        {
            'ranking_type': rankingType
        }
    );
    // Update localStorage so that the other Viewers can see that we've selected this topic
    localStorage[model_name + '_topic'] = tvNS.currTopic;

    /*
    // OBSOLETE CODE from before Representations.js
    var $TOPIC_URL = flask_util.url_for('utils_get_topic',
                        {model_name: model_name,
                         topic_num: topicNum == 0 ? '0' : topicNum, // Cheap hack--I think flask_util.url_for can't deal with 0 as a parameter
                         num_words: tvNS.numWords,
                         ranking_type: rankingType
                        });
    d3.select('#topicView').html('');
    d3.json($TOPIC_URL, function(json) {
        if (json == null) {
            d3.select('#topicView').append('div')
                .attr('class', 'alert alert-block')
                .html('Topic data not found.')
        } else {
            var topicView = d3.select('#topicView').append('svg:svg')
                .attr('width', tvNS.w)
                .attr('height', (tvNS.numWords + 1) * (tvNS.barHeight + tvNS.barBuffer))
                .on('mouseover', function() {
                    brushTopic(tvNS.currTopic, true);
                })
                .on('mouseout', function() {
                    brushTopic(tvNS.currTopic, false);
                });

            var wordList = json.wordList;
            var propList = json.propList;

            var barScale = d3.scale.linear()
                .domain([0, propList[0]])
                .range([0, tvNS.maxBarWidth]);

            var wordLabel = topicView.selectAll('.topicWordLabel')
                .data(wordList, String); // Not sure I'd want to animate this, but whatever.
            wordLabel.enter().append('svg:text')
                .attr('class', 'topicWordLabel')
                .text(function(d) { return d; })
                .attr('x', tvNS.barXoffset - tvNS.barBuffer)
                .attr('y', function(d,i) { return tvNS.barYoffset + (i + 1)*(tvNS.barBuffer + tvNS.barHeight); })
                .attr('text-anchor', 'end')
                .attr('alignment-baseline', 'middle')
                .attr('cursor', 'pointer')
                .on('click', function(d) {
                    addWords([d], [$('#colorSelect').val()], true);
                });
            wordLabel.exit().remove();

            var wordBar = topicView.selectAll('.topicWordBar')
                .data(propList);
            wordBar.enter().append('svg:rect')
                .attr('class', 'topicWordBar')
                .attr('x', tvNS.barXoffset + tvNS.barBuffer)
                .attr('y', function(d,i) { return tvNS.barYoffset + (i + 1)*(tvNS.barBuffer + tvNS.barHeight) - .5*(tvNS.barHeight); })
                .attr('width', function(d) { return barScale(d); })
                .attr('height', tvNS.barHeight)
                .style('stroke', tvNS.barBorder)
                .style('fill', state.topicColors[tvNS.currTopic])
                .style('fill-opacity', tvNS.barFillOpacity);
            wordBar.exit().remove();
        }
        // Update localStorage so that the other Viewers can see that we've selected this topic
        localStorage[model_name + '_topic'] = tvNS.currTopic;
    });*/
};

// Have RankViewer listen to what topics are being selected in other levels
window.addEventListener('storage', function() {
    // Select topics as needed
    if (event.key == model_name + '_topic') {
        var topicNum = parseInt(event.newValue);
        if (topicNum >= 0 && topicNum < state.numTopics) {
            updateTopicDisplay(topicNum);
        }
    }
    // Change colors as needed
    else if (event.key == model_name) {
        var topicColorObj = getTopicColorObj();
        if (tvNS.currTopic in topicColorObj) {
            d3.select('#topicView').selectAll('.topicWordBar')
                .style('fill', topicColorObj[tvNS.currTopic]);
        } else {
            d3.select('#topicView').selectAll('.topicWordBar')
                .style('fill', defaultColor);
        }
        for (var i = 0; i < state.numTopics; i++) {
            if (i in topicColorObj) {
                state.topicColors[i] = topicColorObj[i];
            } else {
                state.topicColors[i] = defaultColor;
            }
        }
    }
}, false);