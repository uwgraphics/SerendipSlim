/**
 * Created by ealexand on 8/17/2016.
 */

var cv_controller = (function() {

    var model;
    var views;
    var selectedRows;
    var selectedCols;
    var rowColors = {};
    var colColors = {};
    var coloringByRows = true;
    var rankingType = 'sal';
    var validRankingTypes = ['sal', 'freq', 'ig'];

    var aggregatingBy;  // metadata field by which data is being aggregated (or undefined if not aggregating)

    var init = function(mod, v) {
        model = mod;
        views = v;
        selectedRows = [];
        selectedCols = [];

        // Remove elements with deprecated functionality
        $('.deprecated').remove();

        // Initialize UI button functionality
        initSettings();
        initTooltips();
        initMiscButtons();
        initSelectionColorPickers();
        initRowControls();
        initColControls();

        // Initialize interactions between SlimCV, SlimTV, etc. through localStorage
        initCrossTabInteractions();
    };

    // Helper fxn that takes a given fxn name and parameter and runs it for every view that has such a fxn
    var runForAllViews = function(fxn, param) {
        for (var viewName in views) {
            if (views[viewName].hasOwnProperty(fxn)) {
                views[viewName][fxn](param);
            }
        }
    };
    
    // Fxn that will update each view after a model has been updated
    var updateViews = function() {
        runForAllViews('update');
    };
    
    // Fxns responsible for telling the various views that rows and columns have been brushed or unbrushed
    var brushRow = function(row) {
        runForAllViews('brushRow', row);
    };
    var unbrushRow = function(row) {
        runForAllViews('unbrushRow', row);
    };
    var brushCol = function(col) {
        runForAllViews('brushCol', col);
    };
    var unbrushCol = function(col) {
        runForAllViews('unbrushCol', col);
    };

    // Fxns responsible for actually selecting rows and columns
    var selectRow = function(row) {
        if (selectedRows.indexOf(row) === -1) {
            selectedRows.push(row);
            updateRowSelection();
        }
        runForAllViews('selectRow', row);
    };
    var selectCol = function(col) {
        if (selectedCols.indexOf(col) === -1) {
            selectedCols.push(col);
            updateColSelection();
        }
        runForAllViews('selectCol', col);
    };
    var unselectRow = function(row) {
        var indexOfRow = selectedRows.indexOf(row);
        if (indexOfRow !== -1) {
            selectedRows.splice(indexOfRow, 1);
        }
        runForAllViews('unselectRow', row);
    };
    var unselectCol = function(col) {
        var indexOfCol = selectedCols.indexOf(col);
        if (indexOfCol !== -1) {
            selectedCols.splice(indexOfCol, 1);
        }
        runForAllViews('unselectCol', col);
    };
    var toggleRowSelect = function(row) {
        if (selectedRows.indexOf(row) === -1) {
            selectRow(row);
        } else {
            unselectRow(row);
        }
    };
    var toggleColSelect = function(col) {
        if (selectedCols.indexOf(col) === -1) {
            selectCol(col);
        } else {
            unselectCol(col);
        }
    };
    var newRowSelection = function(rows) {
        selectedRows = rows;
        updateRowSelection();
    };
    var newColSelection = function(cols) {
        selectedCols = cols;
        updateColSelection();
    };
    var updateRowSelection = function() {
        // First, update depiction of the row selection in the UI controls
        if (selectedRows.length === 0) {
            d3.select('#selectedRows').html('No rows selected');
        } else {
            selectedRows.sort(function(a, b) { return a - b; });
            var selectedRowsList = d3.select('#selectedRows').html('');
            for (var i = 0; i < selectedRows.length; i++) {
                selectedRowsList.append('a')
                    .attr('class', 'selectedRowLink')
                    .attr('rowNum', selectedRows[i])
                    .style('cursor', 'pointer')
                    .text(model.getRowName(selectedRows[i]));
                selectedRowsList.append('br');
            }
            d3.selectAll('.selectedRowLink')
                .on('click', function() {
                    selectRow(parseInt(d3.select(this).attr('rowNum')));
                });
        }

        // Then have views update their selections
        runForAllViews('updateRowSelection', selectedRows);
    };
    var updateColSelection = function() {
        // First, update depiction of the col selection in the UI controls
        if (selectedCols.length === 0) {
            d3.select('#selectedCols').html('No columns selected');
        } else {
            selectedCols.sort(function(a, b) { return a - b; });
            var selectedColsList = d3.select('#selectedCols').html('');
            for (var i = 0; i < selectedCols.length; i++) {
                selectedColsList.append('a')
                    .attr('class', 'selectedColLink')
                    .attr('colNum', selectedCols[i])
                    .style('cursor', 'pointer')
                    .text(model.getColName(selectedCols[i]));
                selectedColsList.append('br');
            }
            d3.selectAll('.selectedColLink')
                .on('click', function() {
                    selectCol(parseInt(d3.select(this).attr('colNum')));
                });
        }

        // Then have views update their selections
        runForAllViews('updateColSelection', selectedCols);
    };

    // Connections to other SlimViewers
    var openRowInTV = function(row) {
        window.open(flask_util.url_for('tv_view_by_name',
            {
                model_name: model_name, // TODO: model_name is currently a global defined in HTML template. Is this OK?
                text_name: model.getRowFilename(row)
            }));
    };

    var initSelectionColorPickers = function() {
        var makeColorSelector = function(selectorID, colorArray, onClick) {
            var colorSize = 12;
            var cpBuffer = 2;
            var colorsPerRow = Math.ceil(Math.sqrt(colorArray.length));
            var pickerWidth = cpBuffer + (colorSize + cpBuffer)*colorsPerRow;
            var pickerHeight = cpBuffer + (colorSize + cpBuffer)*Math.ceil(colorArray.length/colorsPerRow);
            d3.select(selectorID)
                .append('svg:svg')
                .attr('width', pickerWidth)
                .attr('height', pickerHeight)
                .selectAll('rect').data(colorArray)
                .enter().append('svg:rect')
                .attr('x', function(d, i) { return cpBuffer + (i % colorsPerRow)*(colorSize + cpBuffer); })
                .attr('y', function(d, i) { return cpBuffer + Math.floor(i / colorsPerRow)*(colorSize + cpBuffer); })
                .attr('width', colorSize)
                .attr('height', colorSize)
                .style('stroke', 'black')
                .style('fill', function(d) { return d; })
                .on('click', onClick);
        };

        $('#colorSelection')
            .popover({ html:true, content:'<div id="rowColorPickerFloat"></div>', placement:'top'})
            .on('click', function() {
                makeColorSelector('#rowColorPickerFloat', colors.cat, function(d) {
                    colorRows(selectedRows, d);
                    $('#colorSelection').popover('hide');
                });
            });

        $('#topicColorSelection')
            .popover({ html:true, content:'<div id="colColorPickerFloat"></div>', placement:'top'})
            .on('click', function() {
                makeColorSelector('#colColorPickerFloat', colors.topic, function(d) {
                    colorCols(selectedCols, d);
                    //exportTopicColors();
                    $('#topicColorSelection').popover('hide');
                });
            });
    };

    // Initializes functionality for buttons in col control box (upper left-hand box in SerendipSlim)
    var initColControls = function() {
        // Sort by metadata
        var colSortSelect = d3.select('#topicSortSelect');
        populateMetaDropdown(colSortSelect, model.getColMetaNames(), function() {
            var fieldName = d3.select(this).property('value');
            if (model.getColMetaNames().indexOf(fieldName) === -1) {
                model.resetColOrder(updateViews);
            } else {
                model.sortColsByMeta(fieldName, updateViews);
            }
        });

        // ANOVA order // TODO
        // Contrast order // TODO

        // Custom order
        d3.select('#topicCustomOrderSubmit')
            .on('click', function() {
                var order = d3.select('#topicCustomOrderInput').property('value').split(',');
                for (var i = 0; i < order.length; i++) {
                    order[i] = parseInt(order[i]);
                }
                d3.select('#topicCustomOrderInput').property('value', '');
                //d3.select('#topicSortSelect').property('value', 'None'); // TODO: gotta reset topicSortSelect when sorting by other things
                $('#topicCustomOrderInput').modal('hide');
                model.setColOrder(order, updateViews);
            });

        // Advanced selection
        // TODO: implement advanced col selection, or get rid of it

        // Operate on selection
        // Note: code for coloring the col selection can be found in initSelectionColorPickers()
        // Clear the selected columns
        d3.select('#clearColSelection').on('click', function() {
            newColSelection([]);
        });
        // Sort rows by col selection
        d3.select('#sortDocsBySelection').on('click', function() {
            model.sortRowsBy(selectedCols, updateViews);
            $('#sortSelect,#sortByNthTopicSelect').val('');
        });
        // Move selected cols to the left of the matrix view
        d3.select('#moveSelectionToLeft').on('click', function() {
            model.moveColsToLeft(selectedCols, updateViews);
        });
        // Sort cols by distance from col selection
        d3.select('#sortTopicsByDist').on('click', function() {
            model.sortColsByDistanceFrom(selectedCols, updateViews);
            $('#topicSortSelect').val('');
        });

        // Toggle coloring
        d3.select('#toggleColorByColBtn').on('click', function() {
            event.preventDefault();
            colorBy('cols');
        })
    };

    // Initializes functionality for buttons in row control box (lower left-hand box in SerendipSlim)
    var initRowControls = function() {
        // Labeling rows
        var rowLabelSelect = d3.select('#metadataDocLabelSelect');
        rowLabelSelect.style('display', 'none');
        populateMetaDropdown(rowLabelSelect, model.getRowMetaNames(), function() {
            var fieldName = d3.select(this).property('value');
            runForAllViews('changeRowLabels', fieldName);
        });
        d3.select('#metadataDocLabels').on('click', function() {
            var labelSelect = d3.select('#metadataDocLabelSelect');
            labelSelect.style('display', 'initial');
            var fieldName = labelSelect.property('value');
            runForAllViews('changeRowLabels', fieldName);
        });
        d3.select('#autoDocLabels').on('click', function() {
            d3.select('#metadataDocLabelSelect').style('display', 'none');
            runForAllViews('changeRowLabels');
        });

        // Sort by metadata
        var rowSortSelect = d3.select('#sortSelect');
        populateMetaDropdown(rowSortSelect, model.getRowMetaNames(), function() {
            var fieldName = d3.select(this).property('value');
            if (model.getRowMetaNames().indexOf(fieldName) === -1) {
                model.resetRowOrder(updateViews);
            } else {
                model.sortRowsByMeta(fieldName, updateViews);
            }
            $('#sortByNthTopicSelect').val('');
        });
        
        // Sort by nth col size
        var rowSortByNthSelect = d3.select('#sortByNthTopicSelect');
        rowSortByNthSelect.on('change', function() {
            var n = parseInt(d3.select(this).property('value'));
            if (n >= 0) {
                model.sortRowsByNth(n, updateViews);
                $('#sortSelect').val('');
            }
        });
        
        // Custom order
        d3.select('#docCustomOrderSubmit')
            .on('click', function() {
                var order = d3.select('#docCustomOrderInput').property('value').split(',');
                for (var i = 0; i < order.length; i++) {
                    order[i] = parseInt(order[i]);
                }
                d3.select('#docCustomOrderInput').property('value','');
                // d3.select('#sortSelect').property('value','None'); // TODO: gotta reset the other ordering selects
                // d3.select('#sortByNthTopicSelect').property('value','None'); // TODO: gotta reset the other ordering selects
                $('#docCustomOrderModal').modal('hide');
                model.setRowOrder(order, updateViews);
            });

        // Aggregation
        $('.forRowAgg').hide(); // Initially, things that are aggregation specific will be hidden
        var rowAggSelect = d3.select('#aggregateSelect');
        populateMetaDropdown(rowAggSelect, model.getRowMetaNames(), function() {
            var fieldName = d3.select(this).property('value');
            if (model.getRowMetaNames().indexOf(fieldName) === -1) {
                unaggregateRows();
            } else {
                aggregateRowsBy(fieldName); // TODO: numerical aggregation?
            }
        });
        d3.select('#clearAggregation').on('click', function() {
            unaggregateRows();
        });

        // Filtering

        // Advanced selection
        initAdvancedRowSelect(); // Yes, it's silly to have this be in its own function. Sue me.

        // Operate on selection
        // Note: code for coloring the row selection can be found in initSelectionColorPickers()
        // Clear the selected columns
        d3.select('#clearRowSelection').on('click', function() {
            newRowSelection([]);
        });
        // Sort cols by row selection
        d3.select('#sortBySelection').on('click', function() {
            model.sortColsBy(selectedRows, updateViews);
            $('#topicSortSelect').val('');
        });
        // Move selected rows to the top of the view
        d3.select('#moveSelectionToTop').on('click', function() {
            model.moveRowsToTop(selectedRows, updateViews);
        });
        // Sort rows by distance from row selection
        d3.select('#sortDocsByDist').on('click', function() {
            model.sortRowsByDistanceFrom(selectedRows, updateViews);
            $('#sortSelect,#sortByNthTopicSelect').val('');
        });

        // Toggle coloring
        d3.select('#toggleColorByRowBtn').on('click', function() {
            event.preventDefault();
            colorBy('rows');
        });

        // Color by metadata
        // First, populate dropdown
        var colorSelect = d3.select('#colorByMetadataSelect');
        var catMetaNames = model.getRowMetaNames(['cat']);
        for (var i = 0; i < catMetaNames.length; i++) {
            colorSelect.append('option')
                .property('value', catMetaNames[i])
                .property('name', catMetaNames[i])
                .text(catMetaNames[i]);
        }
        // Then, implement functionality
        d3.select('#colorByMetadataSelect').on('change', function() {
            var metadataField = $('#colorByMetadataSelect').val();
            // If they select None, uncolor all rows
            if (metadataField === 'None') {
                rowColors = {};
                coloringByRows ? colorBy('rows') : colorBy('cols');
            }
            // Otherwise, give each category its own color (looping as necessary)
            else {
                var metadataGroups = {};
                var metadataValue;
                for (var rowNum = 0; rowNum < model.getNumRows(); rowNum++) {
                    metadataValue = model.getRowMetaAsObj(rowNum)[metadataField];
                    if (metadataValue in metadataGroups) {
                        metadataGroups[metadataValue].push(rowNum);
                    } else {
                        metadataGroups[metadataValue] = [rowNum];
                    }
                }
                var colorCounter = 0;
                for (metadataValue in metadataGroups) {
                    colorRows(metadataGroups[metadataValue], colors.cat[colorCounter]);
                    colorCounter = (colorCounter + 1) % colors.cat.length;
                }
                // Reset the dropdown menu just so we can do it again if needed. Hack-y, but ah well.
                $('#colorByMetadataSelect').val('');
            }
        });
    };

    // Functionality for creating the advanced row select. Annoyingly long with lots of helpers, hence its own fxn
    var initAdvancedRowSelect = function() {
        var formID = 'advancedSelectBody';
        var adSelBody = d3.select('#' + formID);
        var currName, currType, accGrp, accInner;
        var catLists = {}; // This object will store a list of all the options for each categorical metadata field
        var metadataNames = model.getRowMetaNames();
        var metadataTypes = model.getRowMetaTypes();
        // Fill the accordion groups for each metadata field
        for (var i = 0; i < metadataNames.length; i++) {
            currName = metadataNames[i];
            currType = metadataTypes[i];
            accGrp = adSelBody.append('div').attr('class', 'accordion-group');
            accGrp.append('div')
                .attr('class', 'accordion-heading')
                .append('a')
                .attr('class', 'accordion-toggle')
                .attr('data-toggle', 'collapse')
                .attr('href', '#' + currName + '_collapse_' + formID)
                .text(currName);
            accGrp.append('div')
                .attr('id', currName + '_collapse_' + formID)
                .attr('class', 'accordion-body collapse')
                .append('div')
                .attr('class', 'accordion-inner');
            accInner = accGrp.select('.accordion-inner');
            if (currType === 'str') {
                accInner.html(currName + ' contains ')
                    .append('input')
                    .attr('type', 'text')
                    .attr('class', 'str')
                    .attr('name', currName);
            } else if (currType === 'int') {
                accInner.html(currName + ' is between <input type="text" class="int input-small" name="min'
                    + currName + '" /> and <input type="text" class="int input-small" name="max'
                    + currName + '" />');
            } else if (currType === 'cat') {
                accInner.html(currName + ' is ')
                    .append('select')
                    .attr('id', currName + '_select_' + formID)
                    .attr('name', currName)
                    .append('option')
                    .attr('value', '');
                // Create an empty catList for this category...
                catLists[currName] = [];
            }
        }
        // Loop through metadata, filling catLists...
        var currDocMeta, catName;
        for (var rowNum = 0; rowNum < model.getNumRows(); rowNum++) {
            currDocMeta = model.getRowMetaAsObj(rowNum);
            for (catName in catLists) {
                if (catLists[catName].indexOf(currDocMeta[catName]) === -1) {
                    catLists[catName].push(currDocMeta[catName]);
                }
            }
        }
        // Finally, use catLists to fill the cat select tags.
        var selectTag, catOption, j;
        for (catName in catLists) {
            selectTag = d3.select('#' + catName + '_select_' + formID);
            for (j = 0; j < catLists[catName].length; j++) {
                catOption = catLists[catName][j];
                selectTag.append('option')
                    .attr('value', catOption)
                    .attr('name', catOption)
                    .text(catOption);
            }
        }

        // Finally finally, create the functionality for the filtering
        d3.select('#advancedSelectSubmit')
            .on('click', function() {
                var formObj = {};
                var formID = 'advancedSelectBody';
                d3.selectAll('#' + formID + ' input').each(function() {
                    var $this = d3.select(this);
                    if ($this.property('type') !== 'submit') {
                        formObj[$this.property('name')] = $this.property('value');
                    }
                });
                d3.selectAll('#' + formID + ' select').each(function() {
                    var $this = d3.select(this);
                    formObj[$this.property('name')] = $this.property('value');
                });

                var filteredRowSelection = getSelectionFromFormObj(formObj);
                newRowSelection(filteredRowSelection);
                //updateRowSelectDiv();
                //$('#advancedSelectBody .collapse').collapse('hide');
                $('#advancedSelectBody input').val('');
                $('#advancedSelectBody select').val('');
                $('#advancedSelectModal').modal('hide');
            });
    };
    // Helper fxn within advanced select for selecting rows which match metadata within a formObj
    var getSelectionFromFormObj = function(formObj) {
        var i;
        //var sel = state.currRowOrder.slice(0);
        // Rather than just getting documents that are visible, get all (easier for overlapping filters).
        var sel = new Array(model.getNumRows());
        for (i = 0; i < model.getNumRows(); i++) {
            sel[i] = i;
        }
        var currName, currType, minVal, maxVal;
        var metadataNames = model.getRowMetaNames();
        var metadataTypes = model.getRowMetaTypes();
        for (i = 0; i < metadataNames.length; i++) {
            currName = metadataNames[i];
            currType = metadataTypes[i];

            if (currType === 'str' || currType === 'cat') {
                if (formObj[currName] === '') {
                    continue;
                }
                sel = selectByStringField(currName, formObj[currName], sel);
            } else if (currType === 'int') {
                minVal = formObj['min' + currName] === '' ? -Infinity : parseInt(formObj['min' + currName]);
                maxVal = formObj['max' + currName] === '' ? Infinity : parseInt(formObj['max' + currName]);
                if (minVal === '' && maxVal === '') {
                    continue;
                }
                sel = selectByIntField(currName, minVal, maxVal, sel);
            }
        }
        return sel;
    };
    // Helper fxn within advanced select for trimming a given selection by a string metadata field
    var selectByStringField = function(fieldName, fieldValue, currSelection) {
        // Filter by fieldValue
        var currRowMeta, rowNum;
        for (var i = 0; i < currSelection.length; i++) {
            rowNum = currSelection[i];
            currRowMeta = model.getRowMetaAsObj(rowNum);
            if (!currRowMeta.hasOwnProperty(fieldName) || currRowMeta[fieldName] === ''
                || currRowMeta[fieldName].toLowerCase().indexOf(fieldValue.toLowerCase()) === -1) {
                currSelection.splice(i,1);
                i--; // Since we removed one, move index back 1
            }
        }
        return currSelection;
    };
    // Helper fxn within advanced select for trimming a given selection to those whose metadata matches given values
    var selectByIntField = function(fieldName, minVal, maxVal, currSelection) {
        // Filter out rows not in range
        var rowNum, currRowMeta;
        for (var i = 0; i < currSelection.length; i++) {
            rowNum = currSelection[i];
            currRowMeta = model.getRowMetaAsObj(rowNum);
            if (!currRowMeta.hasOwnProperty(fieldName) || currRowMeta[fieldName] === ''
                || currRowMeta[fieldName] < minVal || currRowMeta[fieldName] > maxVal) {
                currSelection.splice(i,1);
                i--; // Since we removed one, move index back 1
            }
        }

        return currSelection;
    };

    // Color rows within a selection with a given color. Also toggles to color-by-rows.
    var colorRows = function(selection, color) {
        for (var i = 0; i < selection.length; i++) {
            rowColors[selection[i]] = color;
        }
        colorBy('rows');
    };

    // Color cols within a selection with a given color. Also toggles to color-by-cols and exports colors.
    var colorCols = function(selection, color) {
        // Set colors
        for (var i = 0; i < selection.length; i++) {
            colColors[selection[i]] = color;
        }

        // Apply colors and toggle to color-by-cols
        colorBy('cols');
    };

    // Remove color from rows within a given selection. Don't toggle coloringBy.
    var uncolorRows = function(selection) {
        for (var i = 0; i < selection.length; i++) {
            delete rowColors[selection[i]];
        }
        coloringByRows ? colorBy('rows') : colorBy('cols');
    };

    // Remove color from cols within a given selection. Don't toggle coloringBy.
    var uncolorCols = function(selection) {
        console.log('uncoloring ' + selection);
        for (var i = 0; i < selection.length; i++) {
            delete colColors[selection[i]];
            d3.select('#colBar_' + selection[i]).remove(); // CHEAP HACK because of race condition with transition when removing colors based on localStorage
        }
        coloringByRows ? colorBy('rows') : colorBy('cols');
    };

    var exportTopicColors = function() {
        // Export col colors to localStorage
        var topicColorStrs = [];
        for (var colNum in colColors) {
            topicColorStrs.push('topic_' + colNum + ':' + colColors[colNum]);
        }
        localStorage[model_name] = topicColorStrs.join(';');
        // updateLineGraphCSS(); // TODO: do we need this?
    };

    // Toggle coloring state to color by given value (rows or cols).
    var colorBy = function(rowsOrCols) {
        if (rowsOrCols === 'rows' && !coloringByRows) {
            coloringByRows = true;
            d3.select('#toggleColorByRowBtn').classed('active', true);
            d3.select('#toggleColorByColBtn').classed('active', false);
        } else if (rowsOrCols === 'cols' && coloringByRows) {
            coloringByRows = false;
            d3.select('#toggleColorByColBtn').classed('active', true);
            d3.select('#toggleColorByRowBtn').classed('active', false);
        }
        exportTopicColors();
        runForAllViews('colorBy', rowsOrCols);
    };

    // Initializes functionality for the high-level settings modal
    var initSettings = function() {
        // Data threshold for drawing glyphs withing matrixView
        $('#dataThresholdInput')
            .val(views['matrix'].getDataThreshold())
            .on('change', function() {
                var newThresh = $(this).val();
                views['matrix'].updateDataThreshold(newThresh);
            });

        // Word ranking type within colView
        $('#rankingTypeRadioGroup')
            .on('change', function() {
                rankingType = $('input[name=rankingType]:checked').attr('id');
                runForAllViews('updateRankingType');
            });
        // Disable unavailable ranking types
        var $GET_RANKING_TYPES_URL = flask_util.url_for('utils_get_ranking_types', {
            model_name: model_name
        });
        d3.json($GET_RANKING_TYPES_URL, function(json) {
            // Remove radio buttons that the current model doesn't support
            if (json['rankingTypes'].length === 1) {
                $('#ranking_type_radio_div').hide()
            } else {
                for (var i = 0; i < validRankingTypes; i++) {
                    if (json['rankingTypes'].indexOf(validRankingTypes[i]) === -1) {
                        $('#' + json['rankingTypes']).parent().hide()
                    }
                }
            }

            // Make sure that currently enabled ranking type is supported, otherwise update it
            var currRankingType = $('input[name=rankingType]:checked').attr('id');
            if (json['rankingTypes'].indexOf(currRankingType) === -1) {
                rankingType = json['rankingTypes'][0];
                runForAllViews('updateRankingType');
            }
        });
    };

    var initTooltips = function() {
        // TODO: Model dropdown
        d3.select('#openRankViewer').attr('title','Open RankViewer for this model.');
        d3.select('#settings').attr('title','Display settings');

        // Color swapping
        d3.select('#toggleColorByColBtn').attr('title','Color by columns (topics)');
        d3.select('#toggleColorByRowBtn').attr('title','Color by rows (documents)');

        // Buttons above matrixView
        d3.select('#hideEmptyTopics').attr('title','Hide all topics contained in zero documents');
        d3.select('#resetColors').attr('title','Clear topic and document colors');
        d3.select('#resetOrders').attr('title','Return matrix to original orders');

        // Sorting
        d3.select('#topicSortSelect').attr('title','Sort topics by statistical metadata');
        d3.select('#topicCustomOrder').attr('title','Input custom ordering of topics');

        d3.select('#sortSelect').attr('title','Sort documents by metadata');
        d3.select('#sortByNthTopicSelect').attr('title','Sort documents by the proportion of their nth biggest topic');
        d3.select('#docCustomOrder').attr('title','Input custom ordering of documents');

        // Aggregation
        d3.select('#aggregateSelect').attr('title','Select metadata field by which to aggregate documents');

        // Filtering
        d3.select('#addFilter').attr('title','Add a filtering query');

        // Selection
        d3.select('#topicAdvancedSelect').attr('title','Select topics by advanced metadata query');
        d3.select('#clearColSelection').attr('title','Clear selection');
        d3.select('#loadTopicSelection').attr('title','Load previous selection');
        d3.select('#saveTopicSelection').attr('title','Save current selection');
        //d3.select('#topicColorSelection').attr('title','Color selected topics'); // TODO: can I do this without overwriting the popover stuff?
        d3.select('#sortDocsBySelection').attr('title','Sort documents by selected topics');
        d3.select('#moveSelectionToLeft').attr('title','Move selected topics to left');
        d3.select('#sortTopicsByDist').attr('title','Sort topics by similarity to selection average');
        d3.select('#hideTopicSelection').attr('title','Hide selected topics');
        d3.select('#hideAllTopicsButSelection').attr('title','Hide all but selected topics');

        d3.select('#advancedSelect').attr('title','Select documents by advanced metadata query');
        d3.select('#clearRowSelection').attr('title','Clear selection');
        d3.select('#loadSelection').attr('title','Load previous selection');
        d3.select('#saveSelection').attr('title','Save current selection');
        //d3.select('#colorSelection').attr('title','Color selected documents'); // TODO: can I do this without overwriting the popover stuff?
        d3.select('#sortBySelection').attr('title','Sort topics by selected documents');
        d3.select('#moveSelectionToTop').attr('title','Move selected documents to top');
        d3.select('#sortDocsByDist').attr('title','Sort documents by similarity to selection average');
        d3.select('#hideSelection').attr('title','Hide selected documents');
        d3.select('#hideAllButSelection').attr('title','Hide all but selected documents');

        // topicView
        d3.select('#topicViewTitle').attr('title','Click to rename topic');
        d3.select('#hideSelectedTopic').attr('title','Hide this topic in matrix');
        d3.select('#topicMetadataTabBtn').attr('title', 'View statistical topic data');
        d3.select('#topicViewBtn').attr('title', 'View topic distribution as bar chart');
        d3.select('#topicCloudViewBtn').attr('title', 'View topic distribution as word cloud');

        // docView
        d3.select('#docViewTitle').attr('title','Click to open selected document in TextViewer');
        d3.select('#hideSelectedDoc').attr('title','Hide this document in matrix');
        d3.select('#docMetadataBtn').attr('title', 'View document metadata');
        d3.select('#aggregateListBtn').attr('title', 'List of documents in aggregate group');
        d3.select('#docTopicLayoutBtn').attr('title', 'View document topic layout');
        d3.select('#docTopicCountsBtn').attr('title', 'View document topic distribution');
    };

    // Helper fxn to populate metadata dropdowns.
    // dropdown: a d3 selection of the dropdown (HTML select element)
    // metaNames: an array of the names of the metadata fields with which to populate the dropdown
    // changeFxn: function to pass to the .on('change') listener for the dropdown
    var populateMetaDropdown = function(dropdown, metaNames, changeFxn) {
        var metaName;
        for (var i = 0; i < metaNames.length; i++) {
            metaName = metaNames[i];
            dropdown.append('option')
                .property('value', metaName)
                .property('name', metaName)
                .text(metaName);
        }
        dropdown.on('change', changeFxn);
    };

    // Initializes functionality for other miscellaneous UI buttons (RankViewer, color toggling, etc.)
    var initMiscButtons = function() {
        // Reset colors
        d3.select('#resetColors').on('click', function() {
            rowColors = {};
            colColors = {};
            coloringByRows ? colorBy('rows') : colorBy('cols');
        });

        // Reset orders
        d3.select('#resetOrders').on('click', function() {
            // If we're already aggregated, should unaggregate first
            if (typeof(aggregatingBy) !== 'undefined') {
                unaggregateRows();
            }
            // Then reset the docOrders
            model.resetOrders(updateViews);
        });
    };

    // Initializes the behavior for communication between SlimCV, SlimTV, etc. (through localStorage)
    var initCrossTabInteractions = function() {
        // First, reset localStorage for this model whenever it's loaded for the first time
        localStorage[model_name] = '';

        // Next, listen for changes made to localStorage
        window.addEventListener('storage', function() {
            // updateLineGraphCSS() // TODO: need this anymore?
            if (event.key === model_name) {
                // Get all the old topic color assignments in an object
                var oldTopicAssignments = event.oldValue.split(';');
                var oldTopicColorObj = {};
                var temp, i;
                for (i = 0; i < oldTopicAssignments.length; i++) {
                    if (oldTopicAssignments[i] !== '') {
                        temp = oldTopicAssignments[i].split(':');
                        oldTopicColorObj[parseInt(temp[0].split('_')[1])] = temp[1];
                    }
                }

                // Then, get the new assignments
                var newTopicAssignments = event.newValue.split(';');
                var newTopicColorObj = {};
                for (i = 0; i < newTopicAssignments.length; i++) {
                    if (newTopicAssignments[i] !== '') {
                        temp = newTopicAssignments[i].split(':');
                        newTopicColorObj[parseInt(temp[0].split('_')[1])] = temp[1];
                    }
                }

                // Uncolor the old topic assignments
                var topic;
                for (topic in oldTopicColorObj) {
                    if (!(topic in newTopicColorObj)) {
                        uncolorCols([parseInt(topic)]);
                    }
                }

                // Color the new topic assignments
                for (topic in newTopicColorObj) {
                    if (!(topic in oldTopicColorObj) || newTopicColorObj[topic] !== oldTopicColorObj[topic]) {
                        colorCols([parseInt(topic)], newTopicColorObj[topic]);
                    }
                }
            }
        });
    };

    // Aggregate rows by a given metadata field
    var aggregateRowsBy = function(fieldName) {
        // If we're already aggregated, should unaggregate first
        if (typeof(aggregatingBy) !== 'undefined') {
            unaggregateRows();
        }

        aggregatingBy = fieldName;

        // Clear the row selection
        newRowSelection([]);

        // Clear row colors
        rowColors = {}; // TODO: store old row colors in a temporary variable for retrieval (as in Model)

        // Make model aggregate the data
        model.aggregateRowsBy(fieldName);

        // Perform aggregation tasks in all views
        runForAllViews('aggregateRowsBy', fieldName);

        d3.select('#docViewTypeLabel').html(fieldName);
        $('.nonRowAgg').hide();
        $('.forRowAgg').show();
    };

    // Unaggregate the rows into individual vectors
    var unaggregateRows = function() {
        aggregatingBy = undefined;

        // Clear the row selection
        newRowSelection([]);

        // Clear row colors
        rowColors = {}; // TODO: retrieve old row colors from temporary variable (as in Model)

        // Unaggregate the data in the model
        model.unaggregateRows();

        // Update the views
        runForAllViews('unaggregateRows');

        d3.select('#aggregateSelect').property('value', 'None');
        d3.select('#docViewTypeLabel').html('Document');
        $('.nonRowAgg').show();
        $('.forRowAgg').hide();
    };

    return {
        init: init,
        updateViews: updateViews,
        brushRow: brushRow,
        brushCol: brushCol,
        unbrushRow: unbrushRow,
        unbrushCol: unbrushCol,
        selectRow: selectRow,
        selectCol: selectCol,
        unselectRow: unselectRow,
        unselectCol: unselectCol,
        toggleRowSelect: toggleRowSelect,
        toggleColSelect: toggleColSelect,
        newRowSelection: newRowSelection,
        newColSelection: newColSelection,
        rowIsSelected: function(row) { return selectedRows.indexOf(row) !== -1; },
        colIsSelected: function(col) { return selectedCols.indexOf(col) !== -1; },
        colorRows: colorRows,
        colorCols: colorCols,
        uncolorRows: uncolorRows,
        uncolorCols: uncolorCols,
        getRowColor: function(row) { return rowColors[row]; },
        getColColor: function(col) { return colColors[col]; },
        getGlyphColor: function(row, col) { return coloringByRows ? rowColors[row] : colColors[col]; },
        getColoringByRows: function() { return coloringByRows; },
        getRankingType: function() { return rankingType; },
        openRowInTV: openRowInTV,
        aggregateRowsBy: aggregateRowsBy,
        unaggregateRows: unaggregateRows,
        getAggBy: function() { return aggregatingBy; }
    }
})();