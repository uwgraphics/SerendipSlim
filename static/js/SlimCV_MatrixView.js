/**
 * Created by ealexand on 8/17/2016.
 */

var cv_matrixView = (function() {
    
    var model;
    var controller;
    var htmlIDs;

    var matrixSVG; // Variable pointing to a D3 selection of the matrix view svg

    var cm_currRow, cm_currCol; // Store the recently clicked on row, col for use in context-menu functionality
    
    // Variables for selecting rows and cols
    var dragStart, selectingRows, selectLocked;
    var dragging = false;

    // Variables for scale and sizing the visualization
    var fullW, fullH;
    var fullXscale, fullYscale;
    var matrixSeparation = 20; // TODO: make this dyanmic
    var buffer = 10;
    var minR = 0;   // This used to be set to 1, but this felt weird (and probably bad from an accuracy standpoint)
    var maxR = matrixSeparation / 2;
    var aggRscaleFactor = 3;
    var areaScale = d3.scale.linear()
        .domain([0, 1])
        .range([Math.pow(minR, 2), Math.pow(maxR, 2)]); // Notice: not including Pi because we'll just factor it out
    var getRnorm = function(d) {
        return Math.sqrt(areaScale(Math.abs(d.prop)));
    };
    var aggAreaScale = d3.scale.linear()
        .domain([0, 1])
        .range([Math.pow(minR, 2), Math.pow(aggRscaleFactor * maxR, 2)]);
    var getRagg = function(d) {
        return Math.sqrt(aggAreaScale(Math.abs(d.prop)));
    };
    var getR = getRnorm;
    var rowLabelWidth, colLabelHeight;
    var labelRowBy = undefined;
    
    // Variables for the view window
    var window_rowMin, window_rowMax;
    var window_colMin, window_colMax;
    var window_bufferFactor = .5; // This is the factor of the screen size that the window buffer will extend in either direction
    var window_numRows = 32;        // Debugging default--otherwise set dynamically
    var window_numCols = 32;        // Debugging default--otherwise set dynamically
    var window_rowsPerScreen = 16;  // Debugging default--otherwise set dynamically
    var window_colsPerScreen = 16;  // Debugging default--otherwise set dynamically
    var window_rowBuffer = 8;       // Debugging default--otherwise set dynamically
    var window_colBuffer = 8;       // Debugging default--otherwise set dynamically
    var dataThreshold = 0.01; // The threshold below which we won't show feature proportions
    var window_debug = false; // Debugging keeps window size small enough to fit on screen so enter/exit is visible
    
    // Variables for visual look and feel
    var gridcolor = 'lightgray';
    var gridwidth = 1;
    var transdur = 800;
    var defaultGlyphColor = '#FFFF33';
    var highlightBarOpacity = .2;
    var highlightBarThickness = matrixSeparation - 2;

    // Variable containing extra classes to be applied to glyphs under certain conditions (like aggregation)
    var extraGlyphClasses = '';
    
    var init = function(m, c, ids) {
        // First, initiate pointers to model and controller
        model = m;
        controller = c;
        htmlIDs = ids;

        // Grab the data dimensions
        var numRows = model.getNumRows();
        var numCols = model.getNumCols();

        // Calculate sizes and build scales
        rowLabelWidth = 8 * model.getMaxRowLabelLength() + 10;
        colLabelHeight = 7 * model.getMaxColLabelLength() + 10;
        var tmp = $('#' + htmlIDs['matrixContainer']).parent();
        var minW = tmp.width()-25;
        var minH = tmp.height()-25;
        fullW = Math.max(minW, numCols * matrixSeparation + rowLabelWidth);
        fullH = Math.max(minH, numRows * matrixSeparation + colLabelHeight);
        fullXscale = d3.scale.linear()
            .domain([-1, numCols])
            .range([rowLabelWidth + buffer, fullW - buffer]);
        fullYscale = d3.scale.linear()
            .domain([-1, numRows])
            .range([colLabelHeight + buffer, fullH - buffer]);
        matrixSVG = d3.select('#' + htmlIDs['matrixContainer']).html('').append('svg:svg')
            .attr('width', fullW)
            .attr('height', fullH)
            .on('mousedown', function() {
                $('.contextmenu').hide();
            });

        // Initialize the window
        if (!window_debug) {
            window_rowsPerScreen = Math.floor(tmp.height() / matrixSeparation);
            window_colsPerScreen = Math.floor(tmp.width() / matrixSeparation);
            window_rowBuffer = Math.ceil(window_rowsPerScreen * window_bufferFactor);
            window_colBuffer = Math.ceil(window_colsPerScreen * window_bufferFactor);
            window_numRows = window_rowsPerScreen + 2*window_rowBuffer;
            window_numCols = window_colsPerScreen + 2*window_colBuffer;
        }
        window_rowMin = 0;
        window_rowMax = window_numRows;
        window_colMin = 0;
        window_colMax = window_numCols;
        $('#' + htmlIDs['parentContainer']).scroll(scrollWindow);

        // Make some other initializations
        initDragSelect();
        initContextMenus();
    };
    
    // After data in the model has changed, this fxn will redraw things as necessary
    var update = function(forceSnapshot) {
        // forceSnapshot gives us a chance to enforce curr and old orders being the same (e.g., when scrolling)
        if (typeof(forceSnapshot) === 'undefined') {
            forceSnapshot = false;
        }

        var tmp = model.getOrdersAndData(window_rowMin, window_rowMax, window_colMin, window_colMax,
                                         dataThreshold, forceSnapshot);
        var rowOrder = tmp.rowOrder;
        var colOrder = tmp.colOrder;
        var data = tmp.data;

        drawGrid();
        drawHighlightBars();
        drawLabels(rowOrder, colOrder);
        drawGlyphs(data);
    };

    // Fxn responsible for drawing matrix grid lines
    var drawGrid = function() {
        // Build range arrays for lines that we're going to draw
        var i;
        var rowArray = new Array(window_numRows);
        for (i = 0; i < rowArray.length; i++) {
            rowArray[i] = window_rowMin + i;
        }
        var colArray = new Array(window_numCols);
        for (i = 0; i < colArray.length; i++) {
            colArray[i] = window_colMin + i;
        }

        // First, draw edges. Note: this will actually draw the edge all the way at the end
        matrixSVG.selectAll('.colLineEdge')
            .data([-1, fullXscale.domain()[1]])
            .enter().append('svg:line')
            .attr('class', 'colLineEdge')
            .attr('stroke', gridcolor)
            .attr('stroke-width', gridwidth)
            .attr('x1', function(d) { return fullXscale(d); })
            .attr('y1', fullYscale.range()[0])
            .attr('x2', function(d) { return fullXscale(d); })
            .attr('y2', fullYscale.range()[1]);
        matrixSVG.selectAll('.rowLineEdge')
            .data([-1, fullYscale.domain()[1]])
            .enter().append('svg:line')
            .attr('class', 'rowLineEdge')
            .attr('stroke', gridcolor)
            .attr('stroke-width', gridwidth)
            .attr('x1', fullXscale.range()[0])
            .attr('y1', function(d) { return fullYscale(d); })
            .attr('x2', fullXscale.range()[1])
            .attr('y2', function(d) { return fullYscale(d); });

        // Then, draw the inner lines.
        var rowLine = matrixSVG.selectAll('.rowLine')
            .data(rowArray, String);
        rowLine.enter().append('svg:line')
            .attr('class', 'rowLine')
            .attr('stroke', gridcolor)
            .attr('stroke-width', gridwidth)
            .attr('x1', fullXscale.range()[0])
            .attr('y1', function(d, i) { return fullYscale(window_rowMin + i); })
            .attr('x2', fullXscale.range()[1])
            .attr('y2', function(d, i) { return fullYscale(window_rowMin + i); });
        rowLine.exit().remove();
        var colLine = matrixSVG.selectAll('.colLine')
            .data(colArray, String);
        colLine.enter().append('svg:line')
            .attr('class', 'colLine')
            .attr('stroke', gridcolor)
            .attr('stroke-width', gridwidth)
            .attr('x1', function(d, i) { return fullXscale(window_colMin + i); })
            .attr('y1', fullYscale.range()[0])
            .attr('x2', function(d, i) { return fullXscale(window_colMin + i); })
            .attr('y2', fullYscale.range()[1]);
        colLine.exit().remove();
    };

    // Fxn responsible for drawing the rectangles that provide color highlighting for rows and cols
    var drawHighlightBars = function() {
        var data, i;
        if (controller.getColoringByRows()) {
            // First, collect a set of data objects for visible rows (including rowNum & rowColor)
            data = [];
            var rowOrderRange = model.getRowOrderRange(window_rowMin, window_rowMax);
            var rowNum, rowColor;
            for (i = 0; i < rowOrderRange.length; i++) {
                rowNum = rowOrderRange[i];
                rowColor = controller.getRowColor(rowNum);
                if (typeof(rowColor) !== 'undefined') {
                    data.push({
                        'rowNum': rowNum,
                        'rowColor': rowColor
                    });
                }
            }

            // Then, make D3 updates
            var rowBar = matrixSVG.selectAll('.rowBar')
                .data(data, function(x) { return x.rowNum; });
            rowBar.enter().append('svg:rect')
                .attr('class', 'rowBar')
                .style('fill-opacity', highlightBarOpacity);
            rowBar
                .attr('x', fullXscale(window_colMin - 1))
                .attr('width', fullXscale(window_colMax) - fullXscale(window_colMin - 1))
                .attr('y', function(d) { return fullYscale(model.getOldRowIndex(d.rowNum)) - highlightBarThickness/2; })
                .attr('height', highlightBarThickness)
                .style('fill', function(d) { return d.rowColor; });
            // TODO: mouseover, mouseout, click?
            rowBar.transition()
                .duration(transdur)
                .attr('y', function(d) { return fullYscale(model.getRowIndex(d.rowNum)) - highlightBarThickness/2; });
            rowBar.exit()
                .transition()
                .duration(transdur)
                .attr('y', function(d) { return fullYscale(model.getRowIndex(d.rowNum)) - highlightBarThickness/2; })
                .remove();

            // Remove the unneeded colLines
            matrixSVG.selectAll('.colBar').remove();
        } else {
            // First, collect a set of data objects for visible cols (including colNum & colColor)
            data = [];
            var colOrderRange = model.getColOrderRange(window_colMin, window_colMax);
            var colNum, colColor;
            for (i = 0; i < colOrderRange.length; i++) {
                colNum = colOrderRange[i];
                colColor = controller.getColColor(colNum);
                if (typeof(colColor) !== 'undefined') {
                    data.push({
                        'colNum': colNum,
                        'colColor': colColor
                    });
                }
            }

            // Then, make D3 updates
            var colBar = matrixSVG.selectAll('.colBar')
                .data(data, function(x) { return x.colNum; });
            colBar.enter().append('svg:rect')
                .attr('class', 'colBar')
                .attr('id', function(d) { return 'colBar_' + d.colNum; }) // Used for hack in controller.uncolorCols()
                .style('fill-opacity', highlightBarOpacity);
            colBar
                .attr('x', function(d) { return fullXscale(model.getOldColIndex(d.colNum)) - highlightBarThickness/2; })
                .attr('width', highlightBarThickness)
                .attr('y', fullYscale(window_rowMin - 1))
                .attr('height', fullYscale(window_rowMax) - fullYscale(window_rowMin - 1))
                .style('fill', function(d) { return d.colColor; });
            colBar.transition()
                .duration(transdur)
                .attr('x', function(d) { return fullXscale(model.getColIndex(d.colNum)) - highlightBarThickness/2; });
            colBar.exit()
                .transition()
                .duration(transdur)
                .attr('x', function(d) { return fullXscale(model.getColIndex(d.colNum)) - highlightBarThickness/2; })
                .remove();

            // Remove the unneeded rowLines
            matrixSVG.selectAll('.rowBar').remove();
        }
    };

    // Function responsible for the text labels of the rows and cols of matrix
    var drawLabels = function(rowOrder, colOrder) {
        var rowLabel = matrixSVG.selectAll('.rowLabel')
            .data(rowOrder, String);
        rowLabel.enter().append('svg:text')
            .attr('class', 'rowLabel')
            .text(function(d) {
                if (typeof(labelRowBy) === 'undefined' || typeof(controller.getAggBy()) !== 'undefined') {
                    return model.getRowName(d);
                }
                var name = model.getRowMetaAsObj(d)[labelRowBy];
                return name === '' ? '[EMPTY FIELD]' : name;
            })
            .attr('x', rowLabelWidth)
            .attr('y', function(d) { return fullYscale(model.getOldRowIndex(d)); })
            .attr('text-anchor', 'end')
            .attr('cursor', 'pointer')
            .style('fill', function(d) { return controller.rowIsSelected(d) ? 'red' : 'black'; })
            .on('mouseover', function(d) {
                controller.brushRow(d);
                // TODO: metadata tooltip?
            })
            .on('mouseout', function(d) {
                controller.unbrushRow(d);
                // TODO: metadata tooltip?
            })
            .on('contextmenu', function(d) {
                //controller.selectCol(d); // TODO: should right-clicking select the row?
                cm_currRow = d;
                showContextMenu(htmlIDs['rowContextMenu'], event);
            })
            .on('click', function(d) { controller.toggleRowSelect(d); })
            .on('dblclick', function(d) {
                model.sortColsBy([d], update);
                $('#topicSortSelect').val('');
            })
            .call(d3.behavior.drag()
                .on('dragstart', function(d) {

                })
                .on('drag', function() {
                    var newY = Math.max(fullYscale.range()[0], Math.min(fullYscale.range()[1], d3.event.y));
                    d3.select(this).attr('y', newY);
                })
                .on('dragend', function(d) {
                    var newY = d3.select(this).attr('y');
                    var newI = getRowIndexByY(newY);
                    model.updateRowIndex(d, newI, update);
                })
            );
        rowLabel.transition()
            .duration(transdur)
            .attr('y', function(d, i) { return fullYscale(window_rowMin + i); });
        rowLabel.exit()
            .transition()
            .duration(transdur)
            .attr('y', function(d) { return fullYscale(model.getRowIndex(d)); })
            .remove(); // Note: if actually making them fly away wastes too much computation, can just remove

        var colLabel = matrixSVG.selectAll('.colLabel')
            .data(colOrder, String);
        colLabel.enter().append('svg:text')
            .attr('class', 'colLabel')
            .attr('x', function(d) { return fullXscale(model.getOldColIndex(d)); })
            .attr('y', colLabelHeight)
            .attr('text-anchor', 'left')
            .attr('transform', function(d) { return 'rotate(-60 ' + fullXscale(model.getOldColIndex(d)) + ' ' + colLabelHeight + ')'; })
            .attr('cursor', 'pointer')
            .style('fill', function(d) { return controller.colIsSelected(d) ? 'red' : 'black'; })
            .on('mouseover', function(d) { controller.brushCol(d); })
            .on('mouseout', function(d) { controller.unbrushCol(d); })
            .on('contextmenu', function(d) {
                //controller.selectCol(d); // TODO: should right-clicking select the col?
                cm_currCol = d;
                showContextMenu(htmlIDs['colContextMenu'], event);
            })
            .on('click', function(d) { controller.toggleColSelect(d); })
            .on('dblclick', function(d) {
                model.sortRowsBy([d], update);
                $('#sortSelect,#sortByNthTopicSelect').val('');
            })
            .call(d3.behavior.drag()
                .on('dragstart', function(d) {

                })
                .on('drag', function() {
                    var newX = Math.max(fullXscale.range()[0], Math.min(fullXscale.range()[1], d3.event.x));
                    d3.select(this)
                        .attr('x', newX)
                        .attr('transform', function() { return 'rotate(-60 ' + newX + ' ' + colLabelHeight + ')'; });
                })
                .on('dragend', function(d) {
                    var newX = d3.select(this).attr('x');
                    var newI = getColIndexByX(newX);
                    model.updateColIndex(d, newI, update);
                })
            );
        colLabel
            .text(function(d) { return model.getColName(d); });
        colLabel.transition()
            .duration(transdur)
            .attr('x', function(d, i) { return fullXscale(window_colMin + i); })
            .attr('transform', function(d, i) { return 'rotate(-60 ' + fullXscale(window_colMin + i) + ' ' + colLabelHeight + ')'; });
        colLabel.exit()
            .transition()
            .duration(transdur)
            .attr('x', function(d) { return fullXscale(model.getColIndex(d)); })
            .attr('transform', function(d) { return 'rotate(-60 ' + fullXscale(model.getColIndex(d)) + ' ' + colLabelHeight + ')'; })
            .remove(); // Note: if actually making them fly away wastes too much computation, can just remove
    };
    // Helper fxn for finding new index of row after dragging
    var getRowIndexByY = function(yPos) {
        var index = Math.round(fullYscale.invert(yPos));
        return Math.max(0, Math.min(model.getNumRows() - 1, index));
    };
    // Helper fxn for finding new index of col after dragging
    var getColIndexByX = function(xPos) {
        var index = Math.round(fullXscale.invert(xPos));
        return Math.max(0, Math.min(model.getNumCols() - 1, index));
    };
    var changeRowLabels = function(fieldName) {
        if (typeof(fieldName) === 'undefined') {
            labelRowBy = undefined;
        } else if (model.getRowMetaNames().indexOf(fieldName) === -1) {
            return;
        } else {
            labelRowBy = fieldName;
        }

        // Change the labels
        matrixSVG.selectAll('.rowLabel')
            .text(function(d) {
                if (typeof(labelRowBy) === 'undefined') {
                    return model.getRowName(d);
                }
                var name = model.getRowMetaAsObj(d)[labelRowBy];
                return name === '' ? '[EMPTY FIELD]' : name;
            });

        // Re-calculate sizes and scales and move everything around
        shiftPositions();
    };
    
    // Function responsible for the glyphs representing datapoints in matrix
    var drawGlyphs = function(data) {
        var innerShape = matrixSVG.selectAll('.innerShape')
            .data(data, function(d) { return d.row + ',' + d.col; });
        innerShape.enter().append('svg:circle')
            .attr('class', 'innerShape' + extraGlyphClasses)
            .attr('r', getR)
            .attr('cx', function(d) { return fullXscale(model.getOldColIndex(d.col)); })
            .attr('cy', function(d) { return fullYscale(model.getOldRowIndex(d.row)); })
            .attr('title', function(d) { return d.prop; })
            .on('mouseover', function(d) {
                controller.brushRow(d.row);
                controller.brushCol(d.col);
                //showTooltip(d.prop);
            })
            .on('mouseout', function(d) {
                controller.unbrushRow(d.row);
                controller.unbrushCol(d.col);
                //hideTooltip();
            })
            .on('click', function(d) {
                controller.selectRow(d.row);
                controller.selectCol(d.col);
            });
        innerShape
            .style('fill', function(d) {
                var glyphColor = controller.getGlyphColor(d.row, d.col);
                return typeof(glyphColor) === 'undefined' ? defaultGlyphColor : glyphColor;
            });
        innerShape.transition()
            .duration(transdur)
            .attr('cx', function(d) { return fullXscale(model.getColIndex(d.col)); })
            .attr('cy', function(d) { return fullYscale(model.getRowIndex(d.row)); });
        innerShape.exit()
            .transition()
            .duration(transdur)
            .attr('cx', function(d) { return fullXscale(model.getColIndex(d.col)); })
            .attr('cy', function(d) { return fullYscale(model.getRowIndex(d.row)); })
            .remove(); // Note: if actually making them fly away wastes too much computation, can just remove
    };

    // Function that will re-calculate positioning of labels and scales, and then shift the SVG elements
    var shiftPositions = function() {
        // Re-calculate sizes and scales (X)
        var tmp = $('#' + htmlIDs['matrixContainer']).parent();
        var minW = tmp.width()-25;
        var numCols = model.getNumCols();
        if (typeof(labelRowBy) === 'undefined' || typeof(controller.getAggBy()) !== 'undefined') {
            rowLabelWidth = 8 * model.getMaxRowLabelLength() + 10;
        } else {
            rowLabelWidth = 8 * model.getMaxRowMetaLength(labelRowBy) + 10;
        }
        fullW = Math.max(minW, numCols * matrixSeparation + rowLabelWidth);
        fullXscale = d3.scale.linear()
            .domain([-1, numCols])
            .range([rowLabelWidth + buffer, fullW - buffer]);
        matrixSVG.attr('width', fullW);

        // Re-calculate sizes and scales (Y)
        colLabelHeight = 7 * model.getMaxColLabelLength() + 10;
        var minH = tmp.height()-25;
        var numRows = model.getNumRows();
        fullH = Math.max(minH, numRows * matrixSeparation + colLabelHeight);
        fullYscale = d3.scale.linear()
            .domain([-1, numRows])
            .range([colLabelHeight + buffer, fullH - buffer]);
        matrixSVG.attr('height', fullH);

        // Move all the things
        matrixSVG.selectAll('.rowLine, .rowLineEdge').transition().duration(transdur)
            .attr('x1', fullXscale.range()[0])
            .attr('x2', fullXscale.range()[1])
            .attr('y1', function(d) { return fullYscale(d); })
            .attr('y2', function(d) { return fullYscale(d); });
        matrixSVG.selectAll('.colLine, .colLineEdge').transition().duration(transdur)
            .attr('x1', function(d) { return fullXscale(d); })
            .attr('x2', function(d) { return fullXscale(d); })
            .attr('y1', fullYscale.range()[0])
            .attr('y2', fullYscale.range()[1]);
        matrixSVG.selectAll('.rowLabel').transition().duration(transdur)
            .attr('x', rowLabelWidth)
            .attr('y', function(d) { return fullYscale(model.getRowIndex(d)); });
        matrixSVG.selectAll('.colLabel').transition().duration(transdur)
            .attr('x', function(d) { return fullXscale(model.getOldColIndex(d)); })
            .attr('y', colLabelHeight)
            .attr('transform', function(d) { return 'rotate(-60 ' + fullXscale(model.getOldColIndex(d)) + ' ' + colLabelHeight + ')'; });
        matrixSVG.selectAll('.rowBar').transition().duration(transdur)
            .attr('x', fullXscale(window_colMin - 1))
            .attr('width', fullXscale(window_colMax) - fullXscale(window_colMin - 1))
            .attr('y', function(d) { return fullYscale(model.getRowIndex(d.rowNum)) - highlightBarThickness/2; });
        matrixSVG.selectAll('.colBar').transition().duration(transdur)
            .attr('x', function(d) { return fullXscale(model.getColIndex(d.colNum)) - highlightBarThickness/2; })
            .attr('y', fullYscale(window_rowMin - 1))
            .attr('height', fullYscale(window_rowMax) - fullYscale(window_rowMin - 1));
        matrixSVG.selectAll('.innerShape').transition().duration(transdur)
            .attr('cx', function(d) { return fullXscale(model.getColIndex(d.col)); })
            .attr('cy', function(d) { return fullYscale(model.getRowIndex(d.row)); });
    };

    // Function for updating the data if the user scrolls the view
    var scrollWindow = function() {
        // Calculate which rows are visible
        var $pc = $('#' + htmlIDs['parentContainer']);
        var newRowMin = getRowIndexByY($pc.scrollTop());
        var newColMin = getColIndexByX($pc.scrollLeft());
        var newWindow = false;

        // If we've scrolled past threshold, add new buffer
        if ((newRowMin <= window_rowMin + window_rowBuffer/2 && window_rowMin !== 0) ||
            (newRowMin + window_rowsPerScreen > window_rowMax - window_rowBuffer/2)) {
            window_rowMin = Math.max(0, newRowMin - window_rowBuffer);
            window_rowMax = window_rowMin + window_numRows;
            newWindow = true;
        }
        if ((newColMin <= window_colMin + window_colBuffer/2 && window_colMin !== 0) ||
            (newColMin + window_colsPerScreen > window_colMax - window_colBuffer/2)) {
            window_colMin = Math.max(0, newColMin - window_colBuffer);
            window_colMax = window_colMin + window_numCols;
            newWindow = true;
        }

        // Update the DOM
        if (newWindow) {
            update(true);
        }
    };

    // Define behavior for when cols and rows are brushed within any view. Called by controller.
    var brushCol = function(col) {
        matrixSVG.selectAll('.innerShape').select(function (d) { return d.col === col ? this : null; })
            .style('stroke-width', 2);
        matrixSVG.selectAll('.colLabel').select(function (d) { return d === col ? this : null; })
            .style('font-weight', 'bold');
    };
    var unbrushCol = function(col) {
        matrixSVG.selectAll('.innerShape').select(function (d) { return d.col === col ? this : null; })
            .style('stroke-width', 1);
        matrixSVG.selectAll('.colLabel').select(function (d) { return d === col ? this : null; })
            .style('font-weight', 'normal');
    };
    var brushRow = function(row) {
        matrixSVG.selectAll('.innerShape').select(function (d) { return d.row === row ? this : null; })
            .style('stroke-width', 2);
        matrixSVG.selectAll('.rowLabel').select(function (d) { return d === row ? this : null; })
            .style('font-weight', 'bold');
    };
    var unbrushRow = function(row) {
        matrixSVG.selectAll('.innerShape').select(function (d) { return d.row === row ? this : null; })
            .style('stroke-width', 1);
        matrixSVG.selectAll('.rowLabel').select(function (d) { return d === row ? this : null; })
            .style('font-weight', 'normal');
    };

    // Initializes the drag selection behavior of the matrixView
    var initDragSelect = function() {
        matrixSVG
            .on('mousedown', function() {
                event.preventDefault();
                $('.contextmenu').hide();
                var p = d3.mouse(this);
                if (!(p[0] > fullXscale.range()[0] && p[1] > fullYscale.range()[0])) {
                    dragging = true;
                    dragStart = {
                        x: p[0],
                        y: p[1]
                    };
                    matrixSVG.append('rect')
                        .attr('class','selection')
                        .attr('x',p[0])
                        .attr('y',p[1])
                        .attr('width',0)
                        .attr('height',0)
                        .style('fill','transparent')
                        .style('stroke','gray');
    
                    // This bit keeps the drag-box from overflowing into the matrix
                    if (p[0] < fullXscale.range()[0]) {
                        if (p[1] < fullYscale.range()[0]) {
                            selectLocked = false;
                        } else {
                            selectingRows = true;
                            selectLocked = true;
                        }
                    } else {
                        selectingRows = false;
                        selectLocked = true;
                    }
                }
            })
            .on('mousemove', function() {
                if (dragging) {
                    var box = matrixSVG.select('rect.selection');
                    var p = d3.mouse(this);
    
                    // More work to keep drag-box from overflowing into the matrix
                    if (!selectLocked) {
                        if (p[0] < fullXscale.range()[0] && p[1] > fullYscale.range()[0]) {
                            selectingRows = true;
                        } else if (p[0] > fullXscale.range()[0] && p[1] < fullYscale.range()[0]) {
                            selectingRows = false;
                        }
                    }
    
                    var newBox = getNewDragSelectBox(p);
                    box
                        .attr('x', newBox.x)
                        .attr('y', newBox.y)
                        .attr('width', newBox.w)
                        .attr('height', newBox.h);
                }
            })
            .on('mouseup', function() {
                if (dragging) {
                    var p = d3.mouse(this);
                    var newBox = getNewDragSelectBox(p);
                    var lowIndex, highIndex;
                    if (selectingRows === true) {
                        lowIndex = Math.max(0, Math.ceil(fullYscale.invert(newBox.y)));
                        highIndex = Math.ceil(fullYscale.invert(newBox.y + newBox.h));
                        controller.newRowSelection(model.getRowOrderRange(lowIndex, highIndex));
                    } else if (selectingRows === false) {
                        lowIndex = Math.max(0, Math.ceil(fullXscale.invert(newBox.x)));
                        highIndex = Math.ceil(fullXscale.invert(newBox.x + newBox.w));
                        controller.newColSelection(model.getColOrderRange(lowIndex, highIndex));
                    } else {
                        controller.newRowSelection([]);
                        controller.newColSelection([]);
                    }
    
                    matrixSVG.selectAll('rect.selection').remove();
                    selectingRows = null;
                    dragging = false;
                }
            })
            .on('contextmenu', function() {
                event.preventDefault();
            });
    };
    var getNewDragSelectBox = function(p) {
        var change = {
            x: p[0] - dragStart.x,
            y: p[1] - dragStart.y
        };
        return {
            x: change.x < 0 ? p[0] : dragStart.x,
            y: change.y < 0 ? p[1] : dragStart.y,
            w: selectingRows ? (change.x < 0 ? -1*change.x : Math.min(change.x, fullXscale.range()[0] - dragStart.x))
                             : Math.abs(change.x),
            h: selectingRows ? Math.abs(change.y)
                             : (change.y < 0 ? -1*change.y : Math.min(change.y, fullYscale.range()[0] - dragStart.y))
        };
    };

    // If the row or col selections change (either from UI fxns or from drag select, controller will call these
    var updateRowSelection = function(rows) {
        matrixSVG.selectAll('.rowLabel')
            .style('fill', function(d) { return rows.indexOf(d) === -1 ? 'black' : 'red'; });
    };
    var updateColSelection = function(cols) {
        matrixSVG.selectAll('.colLabel')
            .style('fill', function(d) { return cols.indexOf(d) === -1 ? 'black' : 'red'; });
    };

    var colorBy = function(rowsOrCols) {
        /*matrixSVG.selectAll('.innerShape')
            .style('fill', function(d) {
                var glyphColor = controller.getGlyphColor(d.row, d.col);
                return typeof(glyphColor) == 'undefined' ? defaultGlyphColor : glyphColor;
            });

        drawHighlightBars();*/
        update(true); // TODO: overkill? only problem with doing the above is that highlightBars require snapshot of rowOrder
    };
    
    // This function initializes behavior of the context menu that pops up when right-clicking labels
    // TODO: some functionality has not yet been implemented and is commented out
    var initContextMenus = function() {
        // TODO: this should really be moved to CSS
        d3.selectAll('.contextMenu, li')
            .style('cursor', 'default');

        d3.select('#' + htmlIDs['cm_sortByRow'])
            .on('click', function() {
                model.sortColsBy([cm_currRow], controller.updateViews);
                $('#' + htmlIDs['rowContextMenu']).hide();
                $('#topicSortSelect').val('');
            });

        d3.select('#sortByCol')
            .on('click', function() {
                model.sortRowsBy([cm_currCol], controller.updateViews);
                $('#' + htmlIDs['colContextMenu']).hide();
                $('#sortSelect,#sortByNthTopicSelect').val('');
            });

        d3.select('#sortByDistFromRow')
            .on('click', function() {
                model.sortRowsByDistanceFrom([cm_currRow], controller.updateViews);
                $('#' + htmlIDs['rowContextMenu']).hide();
                $('#sortSelect,#sortByNthTopicSelect').val('');
            });

        d3.select('#' + htmlIDs['cm_sortByDistFromCol'])
            .on('click', function() {
                model.sortColsByDistanceFrom([cm_currCol], controller.updateViews);
                $('#' + htmlIDs['colContextMenu']).hide();
                $('#topicSortSelect').val('');
            });

        var rowColorDropdown = d3.select('#' + htmlIDs['cm_rowColorDropdown']);
        var currColor, i;
        for (i = 0; i < colors.cat.length; i++) {
            currColor = colors.cat[i];
            rowColorDropdown.append('li').append('a')
                .attr('tabindex', '-1')
                .attr('href', '#')
                .style('color', currColor)
                .text(currColor)
                .on('click', function() {
                    controller.colorRows([cm_currRow], d3.select(this).text());
                    $('#' + htmlIDs['rowContextMenu']).hide();
                });
        }

        var colColorDropdown = d3.select('#' + htmlIDs['cm_colColorDropdown']);
        for (i = 0; i < colors.topic.length; i++) {
            currColor = colors.topic[i];
            colColorDropdown.append('li').append('a')
                .attr('tabindex', '-1')
                .attr('href', '#')
                .style('color', currColor)
                .text(currColor)
                .on('click', function() {
                    controller.colorCols([cm_currCol], d3.select(this).text());
                    $('#' + htmlIDs['colContextMenu']).hide();
                });
        }

        /*
        d3.select('#' + htmlIDs['cm_openGroup'])
            .on('click', function() {
                openGroup(cm_currRow);
            });
        */

        d3.select('#' + htmlIDs['cm_openInTV']).on('click', function() {
            controller.openRowInTV(cm_currRow);
            $('#' + htmlIDs['rowContextMenu']).hide();
        });

        d3.select('#' + htmlIDs['cm_renameCol']).on('click', function() {
            $('#' + htmlIDs['colContextMenu']).hide();
            // Note: Rename modal is brought up with Bootstrap functionality
        });
        var renameCol = function() {
            var $newNameInputField = $('#newTopicName');
            var newName = $newNameInputField.val();
            if (newName !== '') {
                model.renameCol(cm_currCol, newName, update);
            }
            $('#renameTopicModal').modal('hide');
            $newNameInputField.val('');
        };
        d3.select('#renameTopicSubmit').on('click', renameCol);
        $('#newTopicName').keypress(function(e) {
            if (e.which === 13) {
                renameCol();
            }
        });
    };

    // This fxn brings up the appropriate context menu (row or column)
    var showContextMenu = function(divID, e) {
        e.preventDefault();
        var $mc = $('#' + htmlIDs['parentContainer']);
        var $contextMenu = $('#' + divID);
        var cmX = e.pageX + $contextMenu.width() > $mc.offset().left + $mc.width() ?
                    e.pageX - $contextMenu.width():
                    e.pageX;
        var cmY = e.pageY + $contextMenu.height() > $mc.offset().top + $mc.height() ?
                    e.pageY - $contextMenu.height() :
                    e.pageY;
        d3.select('#' + divID)
            .style('top', cmY+'px')
            .style('left', cmX+'px');
        //$contextMenu.dropdown('toggle');
        $contextMenu.show();
    };

    // Change the threshold for drawing glyphs to given value and update the view
    var updateDataThreshold = function(threshold) {
        dataThreshold = threshold;
        update(true);
    };

    // Aggregate rows by given metadata field
    // noinspection JSUnusedLocalSymbols
    var aggregateRowsBy = function(fieldName) {
        // First, remove all the non-agg svg elements
        d3.selectAll('.innerShape').remove();
        d3.selectAll('.rowLabel').remove();

        extraGlyphClasses = ' aggShape'; // Be sure to add agg-specific CSS to glyphs
        getR = getRagg; // Set the glyph radius function to aggregate version
        update(true); // Draw the new data, labels, etc.
        shiftPositions(); // Move things as appropriate with new labels
    };

    // Unaggregate rows
    var unaggregateRows = function() {
        // First, remove all the agg-specific svg elements
        d3.selectAll('.innerShape').remove();
        d3.selectAll('.rowLabel').remove();

        extraGlyphClasses = ''; // No extraGlyphClasses needed anymore
        getR = getRnorm;        // Return the glyph radius function back to normal
        update(true); // Draw the new data, labels, etc.
        shiftPositions(); // Move things as appropriate with new labels
    };

    return {
        init: init,
        update: update,
        brushCol: brushCol,
        unbrushCol: unbrushCol,
        brushRow: brushRow,
        unbrushRow: unbrushRow,
        updateRowSelection: updateRowSelection,
        updateColSelection: updateColSelection,
        colorBy: colorBy,
        changeRowLabels: changeRowLabels,
        getDataThreshold: function() { return dataThreshold; },
        updateDataThreshold: updateDataThreshold,
        aggregateRowsBy: aggregateRowsBy,
        unaggregateRows: unaggregateRows
    }
})();