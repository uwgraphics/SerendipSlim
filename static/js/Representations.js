/**
 * Created by ealexand on 4/22/2016.
 */

// Tag Representation namespace
var tagRepNS = {};
tagRepNS.maxBarWidth = 150;
tagRepNS.barHeight = 10;
tagRepNS.barBuffer = 3;
tagRepNS.barXoffset = 100;
tagRepNS.barYoffset = 0;
tagRepNS.w = 300;
tagRepNS.size = [400, 400];
tagRepNS.barBorder = 'black';
tagRepNS.defaultColor = '#FFFF33';
tagRepNS.defaultWordColor = 'gray';
tagRepNS.defaultMaxCloudWordSize = 150;
tagRepNS.barFillOpacity = .6;
tagRepNS.defaultNumWords = 200;
tagRepNS.defaultRankType = 'sal';

// Function for opening a word in RankViewer
var openWordInRV = function(d) {
    window.open(flask_util.url_for('wordRankings',
        { model_name: model_name,
          rankingType: ranking_type,
          wordColorPairs: d.word + ':red'
        }));
};

// Implemented types for tag representations
var validRepTypes = ['bar', 'cloud'];
var validModelTypes = ['topic', 'singleText'];

// Function for building a tag representation of a specified type
// Returns distribution of words (for output to CSV, for example)
var buildTagRep = function(model_name, tag_name, tag_color, modelType, repType, repScope, svgContainerID, paramsObj) {
    // Make sure we can build this type
    if (validRepTypes.indexOf(repType) === -1) {
        d3.select(svgContainerID).append('div')
            .attr('class', 'alert alert-block')
            .html('Representation type ' + repType + ' nonexistent or not implemented.');
        return;
    } else if (validModelTypes.indexOf(modelType) === -1) {
        d3.select(svgContainerID).append('div')
            .attr('class', 'alert alert-block')
            .html('Support for model type ' + modelType + ' nonexistent or not implemented.');
        return;
    }

    var wordObjs;
    if (repScope === 'doc') {
        // I think that we can probably use the same representations for all models within a single document
        if (!paramsObj.hasOwnProperty('tokens')) {
            console.log('Error: trying to create doc-level tag representation without passing tokens.');
        } else {
            wordObjs = getDocTagDist(paramsObj['tokens'], tag_name);
            if (repType === 'bar') {
                buildBarChart(svgContainerID, wordObjs, tag_color);
            } else if (repType === 'cloud') {
                buildWordCloud(svgContainerID, wordObjs, tag_color);
            }
        }
    } else if (repScope === 'corpus') {
        if (modelType === 'topic') {
            // We don't have a "count" ranking, so get frequency count if that's the ranking type
            if (paramsObj['ranking_type'] === 'count') {
                paramsObj['ranking_type'] = 'freq';
            }
            // Get topic_url
            var $TOPIC_URL = flask_util.url_for('utils_get_topic',{
                model_name: model_name,
                topic_num: zTest(parseInt(tag_name.split('_')[1])),
                num_words: paramsObj.hasOwnProperty('num_words') ? zTest(paramsObj['num_words']) : zTest(tagRepNS.defaultNumWords),
                ranking_type: paramsObj.hasOwnProperty('ranking_type') ? paramsObj['ranking_type'] : tagRepNS.defaultRankType
            });
            // Fetch the data
            d3.json($TOPIC_URL, function(json) {
                if (json == null) {
                    d3.select(svgContainerID).append('div')
                        .attr('class', 'alert alert-block')
                        .html('Topic data not found.')
                } else {
                    wordObjs = json.wordObjs;
                    if (repType === 'bar') {
                        buildBarChart(svgContainerID, wordObjs, tag_color);/*, openWordInRV);*/
                    } else if (repType === 'cloud') {
                        buildWordCloud(svgContainerID, wordObjs, tag_color, paramsObj['size']);/*, openWordInRV);*/
                    }
                }
            });
        }
    }

    // Return wordObjs to let user download distribution if they want
    return wordObjs;
};

// Builds a bar chart in a given svg container given word objects
var buildBarChart = function(svgContainerID, wordObjs, barColor, wordClickFxn) {
    if (wordObjs.length === 0) {
        return;
    }

    if (typeof(barColor) === 'undefined') {
        barColor = tagRepNS.defaultColor;
    }

    // Make the SVG
    var view = d3.select(svgContainerID).html('').append('svg:svg')
        .attr('width', tagRepNS.w)
        .attr('height', (wordObjs.length + 1) * (tagRepNS.barHeight + tagRepNS.barBuffer));

    // Scale the bars to the max weight
    var barScale = d3.scale.linear()
        .domain([0, wordObjs[0].weight])
        .range([0, tagRepNS.maxBarWidth]);

    // Make the labels
    var wordLabel = view.selectAll('.wordLabel')
        .data(wordObjs, function(x) { return x.word + ' ' + x.weight; });
    wordLabel.enter().append('svg:text')
        .attr('class', 'wordLabel')
        .text(function(d) { return d.word; })
        .attr('x', tagRepNS.barXoffset - tagRepNS.barBuffer)
        .attr('y', function(d,i) { return tagRepNS.barYoffset + (i + 1)*(tagRepNS.barBuffer + tagRepNS.barHeight); })
        .attr('text-anchor', 'end')
        .attr('alignment-baseline', 'middle')
        .attr('cursor', 'pointer')
        .on('click', wordClickFxn);
    wordLabel.exit().remove();

    // Make the bars
    var wordBar = view.selectAll('.wordBar')
        .data(wordObjs, function(x) { return x.word + ' ' + x.weight; });
    wordBar.enter().append('svg:rect')
        .attr('class', 'wordBar')
        .attr('x', tagRepNS.barXoffset + tagRepNS.barBuffer)
        .attr('y', function(d,i) { return tagRepNS.barYoffset + (i + 1)*(tagRepNS.barBuffer + tagRepNS.barHeight) - .5*(tagRepNS.barHeight); })
        .attr('width', function(d) { return barScale(d.weight); })
        .attr('height', tagRepNS.barHeight)
        .style('stroke', tagRepNS.barBorder)
        .style('fill', barColor)
        .style('fill-opacity', tagRepNS.barFillOpacity)
        .on('click', wordClickFxn);
    wordBar.exit().remove();
};

// Builds a word cloud tag representation in a given DOM div
var buildWordCloud = function(svgContainerID, wordObjs, wordColor, cloudSize, wordClickFxn) {
    if (wordObjs.length === 0) {
        return;
    }

    if (typeof(wordColor) === 'undefined') {
        wordColor = tagRepNS.defaultWordColor;
    }
    // If the provide us with a size, resize the default word size as well
    var maxSize;
    if (typeof(cloudSize) === 'undefined') {
        cloudSize = tagRepNS.size;
        maxSize = tagRepNS.defaultMaxCloudWordSize;
    } else {
        maxSize = tagRepNS.defaultMaxCloudWordSize * cloudSize[0] / tagRepNS.size[0];
    }

    // Set up some variables that the word cloud builder needs
    for (var i = 0; i < wordObjs.length; i++) {
        wordObjs[i].value = parseFloat(wordObjs[i].weight);
        wordObjs[i].text = wordObjs[i].word;
        wordObjs[i].size = wordObjs[i].weight;
    }

    // Build the SVG
    var svg = d3.select(svgContainerID)
        .html('')
        .append("svg")
        .attr("width", cloudSize[0])
        .attr("height", cloudSize[1])
        .append("g")
        .attr("transform", "translate(" + cloudSize[0] / 2 + "," + cloudSize[1] / 2 + ")");

    // Calculate word size scale, adjusting for the biggest word
    //var maxSize = tagRepNS.defaultMaxCloudWordSize;
    var bigWord = svg.append('text')
        .style('font-size', tagRepNS.defaultMaxCloudWordSize)
        .text(wordObjs[0].word);
    var bigWordWidth = bigWord.node().getComputedTextLength();
    bigWord.remove();
    if (bigWordWidth > cloudSize[0]) {
        maxSize = Math.floor(maxSize * cloudSize[0] / bigWordWidth);
    }
    var sizeScale = d3.scale.linear()
        .domain([0, wordObjs[0].value])
        .range([0, maxSize]);

    // Build the tag cloud layout
    var cloudLayout = d3.layout.cloud()
        .size(cloudSize)
        .words(wordObjs)
        .overflow(true)
        .padding(1)
        .rotate(0)
        .spiral('archimedean')
        .font('Impact')
        .fontSize(function (d) {
            return sizeScale(d.size); // NOTE: this line will update size using the scale
        })
        .on('end', draw);

    // Draw function for building the SVG
    function draw(words) {
        svg
            .selectAll(".cloudWord")
            .data(words)
            .enter().append("text")
            .attr('class', 'cloudWord')
            .style("font-size", function (d) {
                return d.size + "px"; // NOTE: this line uses the UPDATED size
            })
            .style("font-family", "Impact")
            //.style("fill", function(d, i) { return fillFunc(i); })
            .style('fill', wordColor)
            .attr("text-anchor", "middle")
            .attr("transform", function (d) {
                return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
            })
            .text(function (d) {
                return d.text;
            });
    }

    // Actually run the thing!
    cloudLayout.start();
};

// Function for calculating the word distribution of a given tag over a single document
var getDocTagDist = function(tokens, tag_name) {
    // First, loop through tokens counting all occurrences of tag
    var wordCounts = {};
    var totalCount = 0;
    var i, word, tagIndex;
    for (i = 0; i < tokens.length; i++) {
        tagIndex = tokens[i].slice(3).indexOf(tag_name);
        if (tagIndex !== -1) {
            totalCount++;
            word = tokens[i][1];
            if (wordCounts.hasOwnProperty(word)) {
                wordCounts[word] += 1;
            } else {
                wordCounts[word] = 1;
            }
        }
    }

    // Put counts into word objects, normalize them, and sort by weight
    var includedWords = Object.keys(wordCounts);
    var wordObjs = new Array(includedWords.length);
    for (i = 0; i < includedWords.length; i++) {
        word = includedWords[i];
        wordObjs[i] = {
            'word': word,
            'weight': wordCounts[word] / totalCount
        };
    }
    wordObjs.sort(function(a, b) { return b.weight - a.weight; });

    return wordObjs;
};

// Function building the line graph SVG from tagLines retrieved from worker
var buildLineGraph = function(tagLines, maxWindow, numWindows, svgContainerID, navigator, interactionFxns, svgW, svgH, tagLineThreshold) {
    if (typeof(navigator) === 'undefined') {
        navigator = true;
    }

    var $svgContainer = $(svgContainerID)
        .html('')
        .addClass("withLoadingIndicator");
    if (typeof(svgW) === 'undefined') {
        svgW = $svgContainer.width();
    }
    if (typeof(svgH) === 'undefined') {
        svgH = $svgContainer.height();
    }

    var svg = d3.select(svgContainerID)
        .append('svg')
        .attr('class', 'tag_line_graph')
        .attr('width', svgW)
        .attr('height', svgH);
    var x = d3.scale.linear()
        .domain([0, maxWindow])
        .range([0, svgW]);
    var y = d3.scale.linear()
        .domain([0, numWindows-1])
        .range([0, svgH]);
    var line = d3.svg.line()
        .x(function(d) { return x(d); })
        .y(function(d, i) { return y(i); });
        //.interpolate('basis');

    // If given the argument, only show tagLines whose max windowSize is above the tagLineThreshold as a proportion of overall maxWindow
    if (typeof(tagLineThreshold) !== 'undefined') {
        var i, tagLineMax;
        for (i = 0; i < tagLines.length; i++) {
            tagLineMax = Math.max.apply(null, tagLines[i].windows);
            if (tagLineMax / maxWindow < tagLineThreshold) {
                tagLines.splice(i, 1);
                i--;
            }
        }
    }

    // Create g elements for the tags
    var tagLine = svg.selectAll('.tagLine')
        .data(tagLines)
        .enter().append('g')
        .attr('data-key', function(d) { return d.tagName; })
        .attr('class', function(d) { return 'tagLine ' + d.tagName; });

    // Create line paths for each tag
    tagLine.append('path')
        .attr('class', function(d) { return 'lineShadow ' + d.tagName; })
        .attr('d', function(d) { return line(d.windows); });

    // Create line paths for each tag
    tagLine.append('path')
        .attr('class', function(d) { return 'line ' + d.tagName; })
        .attr('id', function(d) { return d.tagName + '_polyline'; })
        .attr('d', function(d) { return line(d.windows); });

    tagLine
        .on('click', interactionFxns['click'])
        .on('mouseover', interactionFxns['mouseover'])
        .on('mouseout', interactionFxns['mouseout'])
        .on('contextmenu', interactionFxns['contextmenu']);
    
    // Generally will just use this interactive version for TextViewer
    if (navigator) {
        // Add an SVG element to handle scroll clicking (put it in back so it doesn't fire when lines are clicked)
        svg
            .insert('rect',':first-child')
            .attr('x', 0)
            .attr('y', 0)
            .attr('height', '100%')
            .attr('width','100%')
            .style('fill-opacity',0)
            .on('click', function() {
                var h = $(this).height();
                if (h === 0) {
                    h = $(this).parent().height();
                }
                go_to_token(tokens.length * (d3.event.offsetY / h));
            });

        // Create the window_box iff there are multiple pages
        if (tokensPerPage < tokens.length) {
            d3.select('.tag_line_graph')
                .append('svg:rect')
                .attr('id', 'window_box')
                .attr('x', 0)
                .attr('width', '100%')
                .attr('y', 100*(currPageStart / tokens.length) + '%')
                .attr('height', 100*(currPageEnd - currPageStart)/tokens.length + '%')
                .attr('fill', 'yellow')
                .style('fill-opacity',0.4)
                .style('pointer-events', 'none'); // This allows mouse-events to pass through the window box
        }
    }

    $svgContainer.removeClass("withLoadingIndicator");
};

// Function primarily for changing color CSS for line graph
var updateLineGraphCSS = function() {
    // Generate CSS for tags based on the colors we assigned them.
    var colorStrs = localStorage[model_name].split(';');
    var css_str = '';
    var i, tag_name, tag_color;
    for (i = 0; i < colorStrs.length; i++) {
        [tag_name, tag_color] = colorStrs[i].split(':');
        css_str += '.tag_line_graph g.' + tag_name + ' { opacity: 1.0; }\n';
        css_str += "#" + tag_name + "_polyline { stroke: " + tag_color + "; }\n";
    }

    // Insert the CSS into the DOM.
    var $css_el = $("<style class='lg_style' type='text/css'>");
    $css_el.text(css_str);
    var $lg_style = $("style.lg_style");
    if ($lg_style.get(0)) {
        $lg_style.replaceWith($css_el);
    }
    else {
        $("head").append($css_el);
    }
};