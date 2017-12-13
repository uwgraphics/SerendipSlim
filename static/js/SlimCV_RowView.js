/**
 * Created by ealexand on 8/19/2016.
 */

var cv_rowView = (function() {

    // Pointers giving access to the relevant other pieces of code, and the DOM
    var model;
    var controller;
    var htmlIDs;
    
    var currRow; // The row number currently being viewed

    // d3 selections of the SVGs making up this view
    var colCountsSVG;

    // Variables controlling the look of the representations
    var w, h;
    var xScale, yScale;
    var labelBuffer = 30;
    var barBorder = 'black';
    var barFillOpacity = .6;
    var barBuffer = 10;
    var chartBuffer = 10;
    var minBarWidth = 15;
    var barWidth;
    var lineGraphThreshold = .25; // Only tagLines who peak above this threshold (proportion of max) will be shown

    // This view needs pointers to the model and the controller, as well as HTML id's for relevant pieces of the DOM
    var init = function(m, c, ids) {
        model = m;
        controller = c;
        htmlIDs = ids;

        // Calculate width and height based on container
        var $rowContainer = $('#' + htmlIDs['parentContainer']); // Note: this is brittle in relation to DOM structure
        w = $rowContainer.width() - 30;
        h = $rowContainer.height();

        // Calculate some proportions with numCols
        var numCols = model.getNumCols();
        if (w < numCols*minBarWidth + (numCols + 1)*barBuffer) {
            barWidth = minBarWidth;
        } else {
            barWidth = Math.floor((w - barBuffer) / numCols);
        }
        xScale = d3.scale.linear()
            .domain([0, numCols - 1])
            .range([barBuffer, (numCols - 1)*(barBuffer + barWidth)]);
        yScale = d3.scale.linear()
            .domain([0, 1])
            .range([0, h - 2*chartBuffer - labelBuffer]);

        // If they click the rowRepresentationTab, better draw it
        d3.select('#' + htmlIDs['rowRepresentationLI']).on('click', function() {
            if (typeof(currRow) !== 'undefined') {
                buildRowRepresentation(currRow);
            }
        });
    };

    // Selecting a row will build its representation in rowView
    var selectRow = function(row) {
        // If this row is already selected, shouldn't need to do anything
        if (row === currRow) {
            return;
        } else {
            currRow = row;
        }

        // Aggregation specific-behavior
        var aggBy = controller.getAggBy();
        if (typeof(aggBy) === 'undefined') { // If not aggregating, update label and SlimTV Link
            // Update the selected row
            d3.select('#' + htmlIDs['selectedRow']).html(row);

            // Set SlimTV link to this row
            d3.select('#' + htmlIDs['titleDiv'])
                .style('cursor', 'pointer')
                .on('click', function() {
                    controller.openRowInTV(row);
                });
        } else { // If we're aggregating, label/double-click differently
            // Label with aggName
            d3.select('#' + htmlIDs['selectedRow']).html(model.getRowName(row));

            // Double-clicking titleDiv should do open group
            d3.select('#' + htmlIDs['titleDiv'])
                .on('dblclick', function() {
                    // TODO: expand this aggregate within MatrixView?
                });
            // TODO: Write out links to SlimTV for each row
        }

        // Get values from model
        var rowObj = model.getRowAsObj(row);
        var colObjs = [];
        for (var colNum in rowObj) {
            colObjs.push({
                'colNum': parseInt(colNum),
                'perc': rowObj[colNum]
            });
        }
        colObjs.sort(function(a, b) { return b.perc - a.perc; });

        // Build the subviews
        buildRowMeta(row);
        buildColCounts(colObjs);
        if (d3.select('#' + htmlIDs['rowRepresentationLI']).classed('active')) {
            buildRowRepresentation(row);
        }
    };

    // Build colCounts graph SVG (bar chart showing percentages of features)
    var buildColCounts = function(colObjs) {
        colCountsSVG = d3.select('#' + htmlIDs['colCountsContainer'])
            .html('')
            .append('svg:svg')
            .attr('width', w)
            .attr('height', h); // TODO: Why did I used to associate data with this?

        // Draw labels for the column numbers
        colCountsSVG.selectAll('.colLabel')
            .data(colObjs)
            .enter().append('svg:text')
            .attr('class', 'colLabel')
            .text(function(d) { return d.colNum; })
            .attr('x', function(d,i) { return xScale(i) + .5*barWidth; })
            .attr('y', h - labelBuffer + barBuffer)
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'hanging')
            .attr('cursor', 'pointer')
            .on('click', function(d) { controller.selectCol(d.colNum); })
            .on('mouseover', function(d) { controller.brushCol(d.colNum); })
            .on('mouseout', function(d) { controller.unbrushCol(d.colNum); });

        // Draw bars for the proportions
        colCountsSVG.selectAll('.colBar')
            .data(colObjs)
            .enter().append('svg:rect')
            .attr('class', 'colBar')
            .attr('topic', function(d) { return d.colNum; })
            .attr('x', function(d, i) { return xScale(i)/* - .5*dvNS.barWidth*/; })
            .attr('y', function(d) { return h - labelBuffer - yScale(d.perc); })
            .attr('width', barWidth)
            .attr('height', function(d) { return yScale(d.perc); })
            .style('stroke', barBorder)
            .style('fill', function(d) { return controller.getColColor(d.colNum); })
            .style('fill-opacity', barFillOpacity)
            .attr('cursor', 'pointer')
            .on('click', function(d) { controller.selectCol(d.colNum); })
            .on('mouseover', function(d) { controller.brushCol(d.colNum); })
            .on('mouseout', function(d) { controller.unbrushCol(d.colNum); });

        // Draw labels above the bars for the values
        colCountsSVG.selectAll('.propLabel')
            .data(colObjs)
            .enter().append('svg:text')
            .attr('class', 'propLabel')
            .text(function(d) { return d.perc < .01 ? '<1%' : Math.floor(d.perc*100).toString() + '%' })
            .attr('x', function(d,i) { return xScale(i) + .5*barWidth; })
            .attr('y', function(d) { return h - labelBuffer - yScale(d.perc) - 5; })
            .attr('text-anchor', 'middle');
    };

    // Build metadata representation (currently just text)
    var buildRowMeta = function(row) {
        var aggBy = controller.getAggBy();

        if (typeof(aggBy) === 'undefined') { // If not aggregating, show meta for this one
            // Get the metadata for this row and create string representation
            var rowMeta = model.getRowMetaAsObj(row);
            var metadataString = '';
            var preferredFields = ['Title','title','Author','authors','Genre','conf'];
            var i, field;
            for (i = 0; i < preferredFields.length; i++) {
                field = preferredFields[i];
                if (preferredFields[i] in rowMeta) {
                    metadataString += '<strong>' + field + ':</strong> ' + rowMeta[field] + '<br />';
                }
            }
            for (field in rowMeta) {
                if (preferredFields.indexOf(field) === -1) {
                    metadataString += '<strong>' + field + ':</strong> ' + rowMeta[field] + '<br />';
                }
            }
            if (metadataString === '') {
                metadataString = 'No metadata available';
            }

            // Put string representation into the DOM
            d3.select('#' + htmlIDs['metadataContainer'])
                .html('<h4>' + model.getRowName(row) + '</h4>' + '<p>' + metadataString + '</p>');
        } else { // If we're aggregating, show number of rows and links to SlimTV for each
            var aggName = model.getRowName(row);
            var aggList = model.getAggList(aggName);

            // First, list the number of rows in the aggregate
            var container = d3.select('#' + htmlIDs['metadataContainer']);
            container.html('<h4 >' + aggList.length + ' documents:</h4>');

            // Next, add links to SlimTV for each row
            var aggLink = container.selectAll('a')
                .data(aggList)
                .enter().append('a');

            aggLink
                .html(function(d) { return 'Document ' + d; })
                .style('cursor', 'pointer')
                .attr('title', function(d) {
                    var rowMeta = model.getRowMetaAsObj(d);
                    var metadataStr = '';
                    var preferredFields = ['Title','title','Author','author','authors','Genre','genre','conf'];
                    var i, field;
                    for (i = 0; i < preferredFields.length; i++) {
                        field = preferredFields[i];
                        if (preferredFields[i] in rowMeta) {
                            metadataStr += rowMeta[preferredFields[i]] + '\n';
                        }
                    }
                    return metadataStr;
                })
                .on('click', function(d) {
                    controller.openRowInTV(d);
                })
                .insert('br');
        }

    };

    // Build representation of row (will be line graph, can be other things)
    var buildRowRepresentation = function(row) {
        var tokensURL = flask_util.url_for('tv_get_tokens_json', {
            'model_name': model_name,
            'text_name': model.getRowFilename(row)
        });
        if (tokensURL !== '') {
            $('#' + htmlIDs['rowRepresentationContainer'])
                .html('')
                .addClass('withLoadingIndicator');

            d3.json(tokensURL, function(json) {
                    var lgWorker = new Worker($LG_WORKER_URL);

                    lgWorker.onmessage = function(e) {
                        if (e.data.task === 'buildSAT') {
                            if (e.data.message === 'success') {
                                console.log('SAT successfully built.');
                                lgWorker.postMessage({
                                    'task': 'getTagLines',
                                    'windowSize': 50 // TODO: Do we need a slider for this in CV, too?
                                });
                            } else {
                                console.log('SAT build FAILED');
                            }
                        } else if (e.data.task === 'getTagLines') {
                            if (e.data.message === 'success') {
                                console.log('tagLines successfully computed.');
                                //var rsbc = $('#right_sidebar_bottom_content');
                                var rsbc = $('#' + htmlIDs['parentContainer']);
                                buildLineGraph(
                                    e.data.tagLines, e.data.maxWindow, e.data.numWindows,
                                    //'#docTopicLayoutTab', false, {
                                    '#' + htmlIDs['rowRepresentationContainer'], false, {
                                        'click': function(d) {
                                            controller.selectCol(parseInt(d.tagName.split('_')[1]));
                                        },
                                        'mouseover': function(d) {
                                            controller.brushCol(parseInt(d.tagName.split('_')[1]));
                                        },
                                        'mouseout': function(d) {
                                            controller.unbrushCol(parseInt(d.tagName.split('_')[1]));
                                        }
                                    },
                                    rsbc.width(), rsbc.height(), lineGraphThreshold);
                            } else {
                                console.log('getTagLines FAILED');
                            }
                        }
                    };

                    lgWorker.postMessage({
                        'task': 'buildSAT',
                        'tokens': json.tokens
                    });
                });
        } else {
            d3.select('#' + htmlIDs['rowRepresentationContainer'])
                .html('Row representation not available.');
        }

    };

    // Implement functionality for when a col is brushed in any view (called by controller)
    var brushCol = function(col) {
        if (typeof(colCountsSVG) !== 'undefined') {
            colCountsSVG.selectAll('.colLabel').select(function(d) { return parseInt(d.colNum) == col ? this : null; })
                .style('font-weight', 'bold');
        }
        // TODO: highlight lines in line graph
        d3.selectAll('.tag_line_graph g.topic_' + col).classed('highlight-red',true);
        d3.selectAll('.tag_line_graph g.topic_' + col).classed('active',true);
    };
    var unbrushCol = function(col) {
        if (typeof(colCountsSVG) !== 'undefined') {
            colCountsSVG.selectAll('.colLabel').select(function(d) { return parseInt(d.colNum) == col ? this : null; })
                .style('font-weight', 'normal');
        }
        d3.selectAll('.tag_line_graph g.topic_' + col).classed('highlight-red',false);
        d3.selectAll('.tag_line_graph g.topic_' + col).classed('active',false);
    };

    var aggregateRowsBy = function(fieldName) {
        d3.select('#' + htmlIDs['selectedRow']).html('');
        d3.select('#' + htmlIDs['metadataContainer']).html('');
        d3.select('#' + htmlIDs['colCountsContainer']).html('');
        d3.select('#' + htmlIDs['rowRepresentationContainer']).html('');
        currRow = undefined;
    };

    var unaggregateRows = function() {
        d3.select('#' + htmlIDs['selectedRow']).html('');
        d3.select('#' + htmlIDs['metadataContainer']).html('');
        d3.select('#' + htmlIDs['colCountsContainer']).html('');
        d3.select('#' + htmlIDs['rowRepresentationContainer']).html('');
        currRow = undefined;
    };

    var colorBy = function(rowsOrCols) {
        if (typeof(colCountsSVG) === 'undefined') {
            return;
        }

        colCountsSVG.selectAll('.colBar')
            .style('fill', function(d) { return controller.getColColor(d.colNum); });
        updateLineGraphCSS();
    };

    return {
        init: init,
        selectRow: selectRow,
        brushCol: brushCol,
        unbrushCol: unbrushCol,
        aggregateRowsBy: aggregateRowsBy,
        unaggregateRows: unaggregateRows,
        colorBy: colorBy
    }
})();