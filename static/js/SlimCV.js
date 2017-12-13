var state = {}; // This might need an init function of its own.
state.rankingType = 'sal';
state.drawByQuartiles = true;
state.colorEncoding = 'cat';
state.signEncoding = 'none';
state.sortOrderVar = 1; // TODO: Add this to settings menu
state.colorByRows = true;
var transdur = 1000; // Duration of transitions
var gridcolor = 'lightgray';
var gridWidth = 1;
var colors = {};
colors.topics = [];
colors.cat = ['#E41A1C', '#377EB8', '#4DAF4A', '#984EA3', '#FF7F00', '#FFFF33', '#A65628', '#F781BF', '#999999']; // ColorBrewer 9-class Set 1 Qualitative
colors.div = ['#B2182B', '#D6604D', '#F4A582', '#FDDBC7', '#F7F7F7', '#D1E5F0', '#92C5DE', '#4393C3', '#2166AC']; // ColorBrewer 11-class Red-Blue Diverging (top and bottom removed)
colors.seq = ['#F7FCF5', '#E5F5E0', '#C7E9C0', '#A1D99B', '#74C476', '#41AB5D', '#238B45', '#006D2C', '#00441B']; // ColorBrewer 9-class Greens Sequential
colors.topic = ["#6baed6","#74c476","#fd8d3c","#9e9ac8","#fb6a4a"];
var defaultColor = '#FFFF33';
var defaultCloudWordColor = 'gray';

var matrixSeparation = 20; //TODO: Make this dynamic
var aggSizeFactor = 2;

var MATRIX_X_LIMIT = 20;
var MATRIX_Y_LIMIT = 20;

// matrixView VARS
var mvNS = {};
var tmp = $('#matrixView').parent();
mvNS.minW = tmp.width()-25;
mvNS.minH = tmp.height()-25;
mvNS.buffer = 10;
mvNS.minR = 1;
mvNS.maxR = matrixSeparation / 2;
mvNS.highlightBarHeight = matrixSeparation - 2;
mvNS.minFill = .2;
mvNS.midFill = .6;
mvNS.maxFill = .9;
mvNS.rScale = d3.scale.linear()
    .domain([0,1])
    .range([mvNS.minR, mvNS.maxR]);
mvNS.areaScale = d3.scale.linear()
    .domain([0,1])
    .range([Math.pow(mvNS.minR, 2), Math.pow(mvNS.maxR, 2)]); // Notice: not including Pi because we'll just factor it out

// DOCVIEW VARS
var dvNS = {}; // Document View Namespace
dvNS.labelBuffer = 30;
dvNS.barFill = 'red';
dvNS.barBorder = 'black';
dvNS.barFillOpacity = .6;
dvNS.barBuffer = 10;
dvNS.chartBuffer = 10;
dvNS.titleBuffer = 10;
dvNS.minBarWidth = 15;

// TOPICVIEW VARS
var tvNS = {};
tvNS.maxBarWidth = 50;
tvNS.barHeight = 10;
tvNS.barBuffer = 3;
tvNS.barXoffset = 100;
tvNS.barYoffset = 0;
tvNS.w = 300;
tvNS.barBorder = 'black';
tvNS.barFillOpacity = .6;
tvNS.numWords = 40;

var matrixView, topicView;

// A bit of code from http://stackoverflow.com/questions/15474862/twitter-bootstrap-modal-input-field-focus
// Should bring focus to the first text input field to any modal when shown
$(document).ready(function() {
    $(".modal").on('shown', function() {
        $(this).find("input:first").focus();
    });
});

var initialize = function() {
    $("#main_content").addClass("withLoadingIndicator");
    initContextMenus();
    initColorPickers();
    initTooltips();
    //initSidebarFunctions(); // This needs to happen after the data has been pulled in.
    initMatrixView();
};

var initMatrixView = function() {
    matrixView = d3.select('#matrixView').html('').append('svg:svg')
        .attr('width', mvNS.w)
        .attr('height', mvNS.h)
};

// A helper function that will update the doc labels when the selection has been changed.
var changeDocLabels = function() {
    var nameField = $('#metadataDocLabelSelect').val();
    for (var i = 0; i < state.rowList.length; i++) {
        state.rowList[i] = state.metadata[i][nameField];
    }
    if (typeof(state.aggregatingBy) === 'undefined') {
        d3.selectAll('.rowLabel').text(function(d) {
            return state.rowList[d] === '' ? '[EMPTY FIELD]' : state.rowList[d];
        });
    }
};

var initSettings = function() {
    var docLabelSelect = $('#metadataDocLabelSelect');
    docLabelSelect.hide();
    var anovaOrderSelect = $('#anovaOrderSelect');
    var contrastOrderSelect = $('#contrastOrderSelect');
    // Fill the metadata select dropdown
    var metadataName, metadataType, i;
    for (i = 0; i < state.metadataNames.length; i++) {
        metadataName = state.metadataNames[i];
        metadataType = state.metadataTypes[i];
        d3.select('#metadataDocLabelSelect').append('option')
            .property('value', metadataName)
            .property('name', metadataName)
            .text(metadataName);
        if (metadataType==='cat') {
            d3.select('#anovaOrderSelect').append('option')
                .property('value', metadataName)
                .property('name', metadataName)
                .text(metadataName);
            d3.select('#contrastOrderSelect').append('option')
                .property('value', metadataName)
                .property('name', metadataName)
                .text(metadataName);
        }
    }
    $('#anovaOrderSubmit').click(function() {
        var metadataField = anovaOrderSelect.val();
        sortColsByAnovaOn(metadataField);
        $('#anovaOrderModal').modal('hide');
    });
    // Turn on functionality
    $('#rankingTypeRadioGroup').change(function() {
        state.rankingType = $('input[name=rankingType]:checked').attr('id');
        if (typeof(state.selectedCol) !== 'undefined') {
            renderTopicView(state.selectedCol);
        }
    });
    $('input[name="docLabelsRadios"]').change(function() {
        if ($(this).attr('id') === 'autoDocLabels') {
            docLabelSelect.hide();
            for (i = 0; i < state.rowList.length; i++) {
                state.rowList[i] = 'Document ' + i;
            }
        } else if ($(this).attr('id') === 'metadataDocLabels') {
            docLabelSelect.show();
            var nameField = docLabelSelect.val();
            for (i = 0; i < state.rowList.length; i++) {
                state.rowList[i] = state.metadata[i][nameField];
            }
        }
        if (typeof(state.aggregatingBy) === 'undefined') {
            d3.selectAll('.rowLabel').text(function(d) {
                return state.rowList[d] === '' ? '[EMPTY FIELD]' : state.rowList[d];
            });
        }
        state.docLabelsChanged = true;
    });
    docLabelSelect.change(function() {
        changeDocLabels();
        state.docLabelsChanged = true;
    });
    var setContrastGroupDropdowns = function() {
        var nameField = contrastOrderSelect.val();
        var currDoc;
        var catList = [];
        for (i = 0; i < state.metadata.length; i++) {
            currDoc = state.metadata[i];
            if (catList.indexOf(currDoc[nameField]) === -1) {
                catList.push(currDoc[nameField]);
            }
        }
        var contrastGroups = d3.selectAll('.contrastGroup');
        contrastGroups.html('<option>[ALL]</option>');
        for (i = 0; i < catList.length; i++) {
            var catOption = catList[i];
            contrastGroups.append('option')
                .attr('value', catOption)
                .attr('name', catOption)
                .text(catOption);
        }
    };
    setContrastGroupDropdowns();
    contrastOrderSelect.change(function() {
        setContrastGroupDropdowns();
    });
    $('#contrastOrderSubmit').click(function() {
        var metadataField = contrastOrderSelect.val();
        var group1 = [$('#contrastGroup1Select').val()];
        var group2 = [$('#contrastGroup2Select').val()];
        sortColsByContrastBetween(metadataField, group1, group2);
        $('#contrastOrderModal').modal('hide');
    });
    d3.select('#numWordsInput')
        .property('value', tvNS.numWords)
        .on('change', function() {
            var $this = d3.select(this);
            var newNum = parseInt($this.property('value'));
            if (isNaN(newNum) || newNum < 0) {
                $this.property('value', tvNS.numWords);
            } else {
                tvNS.numWords = newNum;
                if (state.selectedCol != null) {
                    renderTopicView(state.selectedCol);
                }
            }
        });
    d3.select('#aggSizeFactorInput')
        .property('value', aggSizeFactor)
        .on('change', function() {
            var $this = d3.select(this);
            var newFactor = parseInt($this.property('value'));
            if (isNaN(newFactor) || newFactor < 1 || newFactor > 5) {
                $this.property('value', tvNS.numWords);
            } else {
                aggSizeFactor = newFactor;
                updateMatrixView();
            }
        });
    $('#settingsModal').on('hide', function() {
        if (state.docLabelsChanged) {
            updateMatrixView();
            state.docLabelsChanged = false;
        }
    });
    if (state.metadataNames.indexOf('filename') !== -1) {
        docLabelSelect.val('filename');
        changeDocLabels();
        updateMatrixView();
    }
};

var initContextMenus = function() {
    d3.select('#sortByRow')
        .on('click', function() {
            sortColsBy([state.selectedRow]);
            $('#rowContextMenu').hide();
        });

    var rowColorDropdown = d3.select('#rowColorDropdown');
    var currColor, i;
    for (i = 0; i < colors.cat.length; i++) {
        currColor = colors.cat[i];
        rowColorDropdown.append('li').append('a')
            .attr('tabindex', '-1')
            .attr('href', '#')
            .style('color', currColor)
            .text(currColor)
            .on('click', function() {
                colorRows([state.selectedRow], d3.select(this).text());
                $('#rowContextMenu').hide();
            });
    }

    var colColorDropdown = d3.select('#colColorDropdown');
    for (i = 0; i < colors.topic.length; i++) {
        currColor = colors.topic[i];
        colColorDropdown.append('li').append('a')
            .attr('tabindex', '-1')
            .attr('href', '#')
            .style('color', currColor)
            .text(currColor)
            .on('click', function() {
                colorCols([state.selectedCol], d3.select(this).text());
                $('#colContextMenu').hide();
                exportTopicColors();
            });
    }

    d3.select('#sortByDistFromRow')
        .on('click', function() {
            sortRowsByDistanceFrom([state.selectedRow]);
            $('#rowContextMenu').hide();
        });

    d3.select('#sortByDistFromCol')
        .on('click', function() {
            sortColsByDistanceFrom([state.selectedCol]);
            $('#colContextMenu').hide();
        });

    d3.select('#hideRow')
        .on('click', function() {
            hideRows([state.selectedRow]);
            $('#rowContextMenu').hide();
        });

    d3.select('#openGroup')
        .on('click', function() {
            openGroup(state.selectedRow);
        });

    d3.select('#openGroupInMeso')
        .on('click', function() {
            openDocsInMesoViewer(state.aggregates[state.selectedRow]);
        });

    d3.select('#openInTextViewer')
        .on('click', function() {
            openDocInTextViewer(state.selectedRow);
            $('#rowContextMenu').hide();
        });

    d3.select('#sortByCol')
        .on('click', function() {
            sortRowsBy([state.selectedCol]);
            $('#colContextMenu').hide();
        });

    d3.select('#hideCol')
        .on('click', function() {
            hideCols([state.selectedCol]);
            $('#colContextMenu').hide();
        });

    d3.select('#renameCol')
        .on('click', function() {
            $('#colContextMenu').hide();
        });

    var renameTopic = function() {
        var $newTopicName = $('#newTopicName');
        var newName = $newTopicName.val();
        if (newName !== '') {
            state.colList[state.selectedCol] = newName;
            matrixView.selectAll('.colLabel').text(function(d) { return state.colList[d]; });
            renderTopicView(state.selectedCol);

            var $SET_TOPIC_NAME_URL = flask_util.url_for('utils_set_topic_name',
                {model_name: model_name,
                 topic_num: state.selectedCol == 0 ? '0' : state.selectedCol, // Hack because url_for doesn't like 0
                 topic_name: newName,
                 num_topics: state.colList.length}
            );

            d3.json($SET_TOPIC_NAME_URL, function(json) {
                var x;
            });
        }
        $('#renameTopicModal').modal('hide');
        $newTopicName.val('');
    };
    d3.select('#renameTopicSubmit')
        .on('click', function() {
            renameTopic();
        });
    $('#newTopicName').keypress(function(e) {
        if (e.which === 13) {
            renameTopic();
        }
    });

    d3.select('#renameTopicCancel,#renameTopicDismiss')
        .on('click', function() {
            $('#newTopicName').val('');
        });
};

var openGroup = function(aggNum) {
    // Update matrixView breadcrumbs
    state.lastAgg = state.aggregatingBy;
    var aggName = state.aggList[aggNum] == '' ? '[EMPTY FIELD]' : state.aggList[aggNum];
    d3.select('#matrixViewBreadcrumbs')
        .html('<a id="matrixModelReset">Model</a> / '
            + '<a id="aggByReset">Aggregating by: ' + state.aggregatingBy + '</a> / '
            + state.aggregatingBy + ': ' + aggName);
    d3.select('#matrixModelReset')
        .on('click', function() {
            state.lastAgg = undefined;
            state.groupData = undefined;
            unaggregate();
        });
    d3.select('#aggByReset')
        .on('click', function() {
            state.groupData = undefined;
            aggregateBy(state.lastAgg);
            state.lastAgg = undefined;
        });

    hideRowsNotIn([aggNum]);
    state.aggregatingBy = undefined;

    // Set currData to just include the selected aggregate and then unaggregate
    setTimeout(function() {
        state.groupRowOrder = state.aggregates[aggNum];
        state.groupData = [];
        var currDoc;
        for (var i = 0; i < state.groupRowOrder.length; i++) {
            currDoc = state.theta[state.groupRowOrder[i]];
            for (var topicID in currDoc) {
                topicID = parseInt(topicID);
                if (state.currColOrder.indexOf(topicID) !== -1) {
                    state.groupData.push({
                        col: topicID,
                        row: state.groupRowOrder[i],
                        prop: currDoc[topicID]
                    });
                }
            }
        }
        unaggregate(state.groupData);
    }, transdur);

    $('#rowContextMenu').hide();
};

var initColorPickers = function() {
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

    $('#colorSelection').popover({ html:true, content:'<div id="rowColorPickerFloat"></div>', placement:'top'});
    d3.select('#colorSelection')
        .on('click', function() {
            makeColorSelector('#rowColorPickerFloat', colors.cat, function(d) {
                colorRows(state.selectedRows, d);
                selectRow(state.selectedRow);
                $('#colorSelection').popover('hide');
            });
        });

    $('#topicColorSelection').popover({ html:true, content:'<div id="colColorPickerFloat"></div>', placement:'top'});
    d3.select('#topicColorSelection')
        .on('click', function() {
            makeColorSelector('#colColorPickerFloat', colors.topic, function(d) {
                if (typeof(state.selectedCols) !== 'undefined' && state.selectedCols.length !== 0) {
                    colorCols(state.selectedCols, d);
                    selectCol(state.selectedCol);
                    exportTopicColors();
                }
                $('#topicColorSelection').popover('hide');
            });
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
    d3.select('#topicColorSelection').attr('title','Color selected topics');
    d3.select('#sortDocsBySelection').attr('title','Sort documents by selected topics');
    d3.select('#moveSelectionToLeft').attr('title','Move selected topics to left');
    d3.select('#sortTopicsByDist').attr('title','Sort topics by similarity to selection average');
    d3.select('#hideTopicSelection').attr('title','Hide selected topics');
    d3.select('#hideAllTopicsButSelection').attr('title','Hide all but selected topics');

    d3.select('#advancedSelect').attr('title','Select documents by advanced metadata query');
    d3.select('#clearRowSelection').attr('title','Clear selection');
    d3.select('#loadSelection').attr('title','Load previous selection');
    d3.select('#saveSelection').attr('title','Save current selection');
    d3.select('#colorSelection').attr('title','Color selected documents');
    d3.select('#sortBySelection').attr('title','Sort topics by selected documents');
    d3.select('#moveSelectionToTop').attr('title','Move selected documents to top');
    d3.select('#sortDocsByDist').attr('title','Sort documents by similarity to selection average');
    d3.select('#hideSelection').attr('title','Hide selected documents');
    d3.select('#hideAllButSelection').attr('title','Hide all but selected documents');

    // topicView
    d3.select('#topicViewTitle').attr('title','Double-click to rename topic');
    d3.select('#hideSelectedTopic').attr('title','Hide this topic in matrix');
    d3.select('#topicMetadataTabBtn').attr('title', 'View statistical topic data');
    d3.select('#topicViewBtn').attr('title', 'View topic distribution as bar chart');
    d3.select('#topicCloudViewBtn').attr('title', 'View topic distribution as word cloud');

    // docView
    d3.select('#docViewTitle').attr('title','Double-click to open in TextViewer');
    d3.select('#hideSelectedDoc').attr('title','Hide this document in matrix');
    d3.select('#docMetadataBtn').attr('title', 'View document metadata');
    d3.select('#aggregateListBtn').attr('title', 'List of documents in aggregate group');
    d3.select('#docTopicLayoutBtn').attr('title', 'View document topic layout');
    d3.select('#docTopicCountsBtn').attr('title', 'View document topic distribution');
};

var initSidebarFunctions = function() {
    // Above all
    d3.select('#openRankViewer')
        .on('click', function() {
            window.open(flask_util.url_for('wordRankingsDefault',
                { model_name: model_name
                }));
        });

    // Above matrixView
    d3.select('#hideEmptyTopics')
        .on('click', function() {
            hideEmptyCols();
        });
    d3.select('#resetColors')
        .on('click', function() {
            resetColors();
        });
    d3.select('#resetOrders')
        .on('click', function() {
            resetOrders();
        });

    // "Close" buttons for docView and topicView
    d3.select('#hideSelectedTopic')
        .on('click', function() {
            if (typeof(state.selectedCol) !== 'undefined') {
                hideCols([state.selectedCol]);
                unselectCol();
            }
        });
    d3.select('#hideSelectedDoc')
        .on('click', function() {
            if (typeof(state.selectedRow) !== 'undefined') {
                hideRows([state.selectedRow]);
                unselectRow();
            }
        });

    // Topic Sorting
    var topicSortSelect = d3.select('#topicSortSelect');
    var topicMetadataName, i;
    for (i = 0; i < state.topicMetadataNames.length; i++) {
        topicMetadataName = state.topicMetadataNames[i];
        topicSortSelect.append('option')
            .property('value', topicMetadataName)
            .property('name', topicMetadataName)
            .text(topicMetadataName);
    }
    topicSortSelect.on('change', function() {
        var fieldName = d3.select(this).property('value');
        if (state.topicMetadataNames.indexOf(fieldName) === -1) {
            state.currColOrder.sort(function(a,b) {return a-b;});
            updateMatrixView();
        } else {
            sortColsByMetadata(fieldName);
        }
    });
    d3.select('#topicCustomOrderSubmit')
        .on('click', function() {
            var order = d3.select('#topicCustomOrderInput').property('value').split(',');
            for (i = 0; i < order.length; i++) {
                order[i] = parseInt(order[i]);
            }
            d3.select('#topicCustomOrderInput').property('value','');
            d3.select('#topicSortSelect').property('value','None');
            $('#topicCustomOrderModal').modal('hide');
            setTopicOrder(order);
        });

    // Topic Selection
    // TODO: Include advanced select for topics
    /*
    buildMetadataForm('topicAdvancedSelectBody');
    d3.select('#topicAdvancedSelectSubmit')
        .on('click', function() {
            var formObj = getObjectFromForm('advancedSelectBody');
            var sel = getSelectionFromFormObj(formObj);
            state.selectedRows = sel;
            updateRowSelectDiv();
            //$('#advancedSelectBody .collapse').collapse('hide');
            $('#advancedSelectBody input').val('');
            $('#advancedSelectBody select').val('');
            $('#advancedSelectModal').modal('hide');
        });*/
    d3.select('#moveSelectionToLeft')
        .on('click', function() {
            moveColsToLeft(state.selectedCols);
        });
    d3.select('#sortDocsBySelection')
        .on('click', function() {
            sortRowsBy(state.selectedCols);
        });
    d3.select('#sortTopicsByDist')
        .on('click', function() {
            sortColsByDistanceFrom(state.selectedCols);
        });
    d3.select('#clearColSelection')
        .on('click', function() {
            state.selectedCols = [];
            updateColSelectDiv();
        });
    d3.select('#hideTopicSelection')
        .on('click', function() {
            hideCols(state.selectedCols);
            state.selectedCols = [];
            updateColSelectDiv();
        });
    d3.select('#hideAllTopicsButSelection')
        .on('click', function() {
            hideColsNotIn(state.selectedCols)
        });

    // Doc Sorting
    var sortSelect = d3.select('#sortSelect');
    var sortByNthSelect = d3.select('#sortByNthTopicSelect');
    var metadataName;
    for (i = 0; i < state.metadataNames.length; i++) {
        metadataName = state.metadataNames[i];
        sortSelect.append('option')
            .property('value', metadataName)
            .property('name', metadataName)
            .text(metadataName);
    }
    sortSelect.on('change', function() {
        var fieldName = d3.select(this).property('value');
        if (state.metadataNames.indexOf(fieldName) === -1) {
            state.currRowOrder.sort(function(a,b) {return a-b;});
            updateMatrixView();
        } else {
            sortRowsByMetadata(fieldName);
            sortByNthSelect.property('value', '-1');
        }
    });
    sortByNthSelect.on('change', function() {
        var n = parseInt(d3.select(this).property('value'));
        if (n >= 0) {
            sortDocsByNth(n);
            sortSelect.property('value', 'None');
        }
    });

    // Coloring by metadata
    var colorSelect = d3.select('#colorByMetadataSelect');
    var metadataName;
    var metadataType;
    for (i = 0; i < state.metadataNames.length; i++) {
        metadataName = state.metadataNames[i];
        metadataType = state.metadataTypes[i];
        if (metadataType === 'cat') {
            colorSelect.append('option')
                .property('value', metadataName)
                .property('name', metadataName)
                .text(metadataName);
        }
    }
    d3.select('#colorByMetadataSubmit').on('click', function() {
        var metadataField = $('#colorByMetadataSelect').val();
        // If they select None, uncolor all rows
        if (metadataField === 'None') {
            uncolorRows(state.currRowOrder);
        }
        // Otherwise, give each category its own color (looping as necessary)
        else {
            var metadataGroups = {};
            var metadataValue;
            for (var i = 0; i < state.metadata.length; i++) {
                metadataValue = state.metadata[i][metadataField];
                if (metadataValue in metadataGroups) {
                    metadataGroups[metadataValue].push(i);
                } else {
                    metadataGroups[metadataValue] = [i];
                }
            }
            var colorCounter = 0;
            for (metadataValue in metadataGroups) {
                colorRows(metadataGroups[metadataValue], colors.cat[colorCounter]);
                colorCounter = (colorCounter + 1) % colors.cat.length;
            }
        }
    });

    // Aggregating
    $('#clearAggDiv').hide();
    var aggSelect = d3.select('#aggregateSelect');
    for (i = 0; i < state.metadataNames.length; i++) {
        metadataName = state.metadataNames[i];
        metadataType = state.metadataTypes[i];
        if (metadataType !== 'str') {
            aggSelect.append('option')
                .property('value', metadataName)
                .property('name', metadataName)
                .text(metadataName);
        }
    }
    // TODO: we need reset the aggregation select field if they cancel
    aggSelect.on('change', function() {
        if (typeof(state.aggregatingBy) !== 'undefined') {
            unaggregate();
        }
        var fieldName = d3.select(this).property('value');
        if (fieldName === 'None') {
            unaggregate();
        } else {
            var fieldType = state.metadataTypes[state.metadataNames.indexOf(fieldName)];
            // If fieldType is integer, we need to get group threshold
            if (fieldType === 'int') {
                state.tempField = fieldName;
                $('#aggIntModal').modal('show');
            } else {
                aggregateBy(fieldName);
            }
        }
    });
    $('#aggIntSubmit').on('click', function() {
        $('#aggIntModal').modal('hide');
        aggregateBy(state.tempField, parseInt($('#aggChunkSize').val()), parseInt($('#aggStartingFrom').val()));
        state.tempField = undefined;
    });
    $('#clearAggregation').on('click', function() {
        unaggregate();
    });

    // Filtering // TODO: make the accordions collapse when modal closes
    buildMetadataForm('addFilterBody');
    d3.select('#addFilterSubmit')
        .on('click', function() {
            var formObj = getObjectFromForm('addFilterBody');
            var sel = getSelectionFromFormObj(formObj);
            createFilter(sel, formObj);
            $('#addFilterModal').modal('hide');
            //$('#addFilterBody .collapse').collapse('hide');
            $('#addFilterBody input').val('');
            $('#addFilterBody select').val('');
        });

    // Selection // TODO: make the accordions collapse when modal closes
    buildMetadataForm('advancedSelectBody');
    d3.select('#advancedSelectSubmit')
        .on('click', function() {
            var formObj = getObjectFromForm('advancedSelectBody');
            state.selectedRows = getSelectionFromFormObj(formObj);
            updateRowSelectDiv();
            //$('#advancedSelectBody .collapse').collapse('hide');
            $('#advancedSelectBody input').val('');
            $('#advancedSelectBody select').val('');
            $('#advancedSelectModal').modal('hide');
        });
    d3.select('#moveSelectionToTop')
        .on('click', function() {
            moveRowsToTop(state.selectedRows);
        });
    d3.select('#sortBySelection')
        .on('click', function() {
            sortColsBy(state.selectedRows);
        });
    d3.select('#sortDocsByDist')
        .on('click', function() {
            sortRowsByDistanceFrom(state.selectedRows);
        })
        .on('contextmenu', function() {
            event.preventDefault();
            sortRowsByDistanceFrom(state.selectedRows, true);
        });
    d3.select('#docCustomOrderSubmit')
        .on('click', function() {
            var order = d3.select('#docCustomOrderInput').property('value').split(',');
            for (var i = 0; i < order.length; i++) {
                order[i] = parseInt(order[i]);
            }
            d3.select('#docCustomOrderInput').property('value','');
            d3.select('#sortSelect').property('value','None');
            d3.select('#sortByNthTopicSelect').property('value','None');
            $('#docCustomOrderModal').modal('hide');
            setDocOrder(order);
        });
    d3.select('#clearRowSelection')
        .on('click', function() {
            state.selectedRows = [];
            updateRowSelectDiv();
        });
    d3.select('#hideSelection')
        .on('click', function() {
            hideRows(state.selectedRows);
            state.selectedRows = [];
            updateRowSelectDiv();
        });
    d3.select('#hideAllButSelection')
        .on('click', function() {
            hideRowsNotIn(state.selectedRows)
        });
    d3.select('#openSelectionInMeso')
        .on('click', function() {
            openDocsInMesoViewer(state.selectedRows);
        });

    // Dealing with groups
    d3.select('#loadSelection')
        .on('click', function() {
            state.loadingGroupOf = 'docs';
            var lgs = d3.select('#loadGroupSelect');
            lgs.html('');
            for (var groupName in state.docGroups) {
                lgs.append('option')
                    .property('value', groupName)
                    .property('name', groupName)
                    .text(groupName);
            }
            $('#loadGroupModal').modal();
        });
    d3.select('#loadTopicSelection')
        .on('click', function() {
            state.loadingGroupOf = 'topics';
            var lgs = d3.select('#loadGroupSelect');
            lgs.html('');
            for (var groupName in state.topicGroups) {
                lgs.append('option')
                    .property('value', groupName)
                    .property('name', groupName)
                    .text(groupName);
            }
            $('#loadGroupModal').modal();
        });
    d3.select('#loadGroupSubmit')
        .on('click', function() {
            var groupName = $('#loadGroupSelect').val();
            if (state.loadingGroupOf === 'docs') {
                state.selectedRows = state.docGroups[groupName].slice();
                updateRowSelectDiv();
            } else {
                state.selectedCols = state.topicGroups[groupName].slice();
                updateColSelectDiv();
            }
            $('#loadGroupModal').modal('hide');
        });
    d3.select('#saveSelection')
        .on('click', function() {
            state.savingGroupOf = 'docs';
            $('#nameGroupModal').modal();
        });
    d3.select('#saveTopicSelection')
        .on('click', function() {
            $('#nameGroupModal').modal();
            state.savingGroupOf = 'topics';
        });
    d3.select('#nameGroupSubmit')
        .on('click', function() {
            if (state.savingGroupOf === 'docs') {
                nameGroup(state.selectedRows, 'docGroups.csv', state.docGroups);
            } else {
                nameGroup(state.selectedCols, 'topicGroups.csv', state.topicGroups);
            }
            $('#nameGroupModal').modal('hide');
            $('#groupName').val('');
        });
    d3.select('#nameGroupCancel,#nameGroupDismiss')
        .on('click', function() {
            $('#groupName').val('');
        });

    // Toggling
    d3.select('#toggleColorByColBtn')
        .on('click', function() {
            event.preventDefault();
            toggleColorBy('cols');
        });

    d3.select('#toggleColorByRowBtn')
        .on('click', function() {
            event.preventDefault();
            toggleColorBy('rows');
        });
};

var nameGroup = function(group, filename, groupsObj) {
    if (group.length === 0) {
        return;
    }
    var newName = $('#groupName').val();
    groupsObj[newName] = group;
    var groupStr = group.join(',');

    if (newName != '') {
        var $SET_GROUP_NAME_URL = flask_util.url_for('cv_set_group_name',
            {model_name: model_name,
             group_file: filename,
             group: groupStr,
             group_name: newName}
        );

        d3.json($SET_GROUP_NAME_URL, function(json) {
            var x;
        });
    }
};

var getGroups = function(filename) {
    var $GET_GROUPS_URL = flask_util.url_for('cv_get_groups',
        {model_name: model_name,
         group_file: filename}
    );

    d3.json($GET_GROUPS_URL, function(json) {
        return json.groups;
    });
};

var aggregateBy = function(fieldName, chunkSize, startingFrom) {
    var i;
    // Update matrixView breadcrumbs
    d3.select('#matrixViewBreadcrumbs')
        .html('<a id="matrixModelReset">Model</a> / Aggregating by: ' + fieldName);
    d3.select('#matrixModelReset')
        .on('click', function() {
            unaggregate();
        });
    state.lastAgg = undefined; // I.e. we're not in a group

    // Update docView to become basically aggView
    $('#docViewTypeLabel').html('Aggregate');
    d3.select('#docViewTitle')
        .on('dblclick', function() {

        });
    $('#right_sidebar_bottom_navbar li').removeClass('active');
    $('#aggregateListLI')
        .addClass('active')
        .show();
    $('#docMetadataLI').hide();
    $('#docTopicLayoutLI').hide();
    $('#right_sidebar_bottom_content .tab-pane').removeClass('active');
    $('#aggregateListTab').addClass('active');

    unselectRow();
    $('#aggregateSelect').val(fieldName);
    $('#clearAggDiv').show(); // Show the Clear button in the aggregation controls
    $('#sortSelect').val('None'); // Sorting doesn't really make sense after aggregating
    $('#openGroup').parent().removeClass('disabled'); // Enable option to drill down into a group
    $('#openGroupInMeso').parent().removeClass('disabled');
    $('#openInTextViewer').parent().addClass('disabled');
    state.aggregatingBy = fieldName;
    state.aggList = [];
    state.aggregates = [];
    state.docToAgg = new Array(state.rowList.length); // This will later let us match docs to their new agg
    // Categorical aggregation
    var currMeta, docNum;
    if (typeof(chunkSize) === 'undefined') {
        var fieldNameIndex;
        for (docNum = 0; docNum < state.metadata.length; docNum++) {
            currMeta = state.metadata[docNum];
            fieldNameIndex = state.aggList.indexOf(currMeta[fieldName]);
            if (fieldNameIndex === -1) {
                state.docToAgg[docNum] = state.aggList.length;
                state.aggList.push(currMeta[fieldName])
                state.aggregates.push([docNum])
            } else {
                state.docToAgg[docNum] = fieldNameIndex;
                state.aggregates[fieldNameIndex].push(docNum);
            }
        }
    }
    // Numerical aggregation
    else {
        // Store docs in a sparse array of chunks
        var currField, currMin, chunkIndex;
        var tmpAggs = [];
        var tmpAggList = [];
        var preAgg = [];
        for (docNum = 0; docNum < state.metadata.length; docNum++) {
            currMeta = state.metadata[docNum];
            currField = parseInt(currMeta[fieldName]);
            if (currField - startingFrom < 0) {
                preAgg.push(docNum);
            } else {
                currMin = currField - ((currField - startingFrom) % chunkSize);
                chunkIndex = Math.floor((currField - startingFrom) / chunkSize);
                if (typeof(tmpAggs[chunkIndex]) === 'undefined') {
                    tmpAggList[chunkIndex] = fieldName + ': ' + currMin + '-' + (currMin + chunkSize - 1);
                    tmpAggs[chunkIndex] = [docNum];
                } else {
                    tmpAggs[chunkIndex].push(docNum);
                }
            }
        }
        // Flatten out undefined chunks
        if (preAgg.length > 0) {
            state.aggregates.push(preAgg);
            state.aggList.push(fieldName + ': <' + startingFrom);
        }
        for (i = 0; i < tmpAggList.length; i++) {
            if (typeof(tmpAggList[i]) !== 'undefined') {
                state.aggregates.push(tmpAggs[i]);
                state.aggList.push(tmpAggList[i]);
            }
        }
        // Instantiate docToAgg
        for (i = 0; i < state.aggregates.length; i++) {
            for (j = 0; j < state.aggregates[i].length; j++) {
                state.docToAgg[state.aggregates[i][j]] = i;
            }
        }
    }
    // Now have aggregates, combine their data.
    state.aggData = [];
    state.aggTheta = []; // This is an association of aggregateNum to {topicID -> prop} objects
    state.aggColors = new Array(state.aggregates.length);
    state.aggsColored = new Array(state.aggregates.length);
    state.aggIQRs = [];
    var currTopicProps, currDoc, currAggPropTotal, currProp, currDocTopicProp;
    var topicID;
    for (var aggIndex = 0; aggIndex < state.aggregates.length; aggIndex++) {
        // Combine aggregates
        state.aggTheta.push({});
        state.aggIQRs.push({});
        currAggPropTotal = 0.0;
        currTopicProps = {};
        for (i = 0; i < state.aggregates[aggIndex].length; i++) {
            currDoc = state.aggregates[aggIndex][i];
            for (topicID in state.theta[currDoc]) {
                currDocTopicProp = state.theta[currDoc][topicID];
                if (typeof(currTopicProps[topicID]) === 'undefined') {
                    currTopicProps[topicID] = currDocTopicProp;
                } else {
                    currTopicProps[topicID] += currDocTopicProp;
                }
                if (typeof(state.aggIQRs[aggIndex][topicID]) === 'undefined') {
                    state.aggIQRs[aggIndex][topicID] = [currDocTopicProp];
                } else {
                    state.aggIQRs[aggIndex][topicID].push(currDocTopicProp)
                }
                currAggPropTotal += currDocTopicProp;
            }
            if (state.rowsColored.indexOf(currDoc) !== -1) {
                if (typeof(state.aggColors[aggIndex]) === 'undefined') {
                    state.aggsColored[aggIndex] = true;
                    state.aggColors[aggIndex] = state.rowColors[currDoc];
                } else if (state.aggsColored[aggIndex] && state.aggColors[aggIndex] !== state.rowColors[currDoc]) {
                    state.aggsColored[aggIndex] = false;
                    state.aggColors[aggIndex] = defaultColor;
                }
            }
        }
        // Turn into data-points (normalizing along the way)
        for (topicID in currTopicProps) {
            currProp = currTopicProps[topicID]/currAggPropTotal; //TODO: normalize or no?
            //currProp = currTopicProps[topicID];
            if (state.currColOrder.indexOf(parseInt(topicID)) !== -1) {
                state.aggData.push({'col':parseInt(topicID),
                    'row':aggIndex,
                    'prop':currProp});
            }
            state.aggTheta[aggIndex][topicID] = currProp;
        }
    }
    for (i = 0; i < state.aggColors.length; i++) {
        if (typeof(state.aggColors[i]) === 'undefined') {
            state.aggColors[i] = defaultColor;
        }
    }

    state.currAggOrder = new Array(state.aggList.length);
    for (i = 0; i < state.aggList.length; i++) {
        state.currAggOrder[i] = i;
    }

    // Now have data, display it.
    // First, lose or move old stuff
    setWidthsHeightsScales();
    drawGrid();

    d3.selectAll('.rowLabel').remove();
    d3.selectAll('.rowHighlightBar')
        .transition()
        .duration(transdur)
        .attr('y', function(d) { return state.y(state.docToAgg[d]) - mvNS.highlightBarHeight/2; })
        .remove();
    d3.selectAll('.innerShape')
        .transition()
        .duration(transdur)
        .attr('cx', getCircleX)
        .attr('cy', function(d) { return state.y(state.docToAgg[d.row]); })
        .transition()
        .duration(transdur)
        .attr('r', 0)
        .remove();
    repositionLabels();

    // Next, add the new stuff
    var aggLabels = matrixView.selectAll('.rowLabel')
        .data(state.currAggOrder);
    aggLabels.enter().append('svg:text')
        .attr('class', 'rowLabel')
        .attr('x', mvNS.rowLabelWidth)
        .attr('y', function(d) { return state.y(state.currAggOrder.indexOf(d)); })
        .attr("text-anchor", "end")
        .attr('cursor', 'pointer')
        .on('mouseover', function(d) {
            brushRow(d);
            /*if (d3.select('#metadataTooltipCheckbox').filter(':checked')[0].length == 1) {
                d3.select('#metadataTooltip')
                    .html(getMetadataString(d))
                    .style('visibility', 'visible')
                    .style('top', event.pageY+'px')
                    .style('left', (event.pageX + 5) + 'px');
            }*/
        })
        .on('mouseout', function(d) {
            unbrushRow(d);
            /*d3.select('#metadataTooltip')
                .style('visibility', 'hidden')
                .html('');*/
        })
        .on('contextmenu', function(d) {
            selectRow(d);
            event.preventDefault();
            d3.select('#rowContextMenu')
                .style('top', event.pageY+'px')
                .style('left', event.pageX+'px');
            $('#rowContextMenu').show();
        })
        .on('click', function(d) { //TODO: selecting row displays metadata of some sort
            selectRow(d);
        })
        .on('dblclick', function(d) { sortColsBy(state.aggregates[d]); })
        .call(d3.behavior.drag()
            .on('dragstart', function(d) {
                // If I want to do any sort of highlighting of the dragged thing, probably do it here.
            })
            .on('drag', function() {
                var newY = Math.max(state.y(-1), Math.min(state.y(state.aggList.length), d3.event.y));
                d3.select(this)
                    .attr('y', newY);
            })
            .on('dragend', function(d) {
                // Undo any highlighting here.

                // Find closest position to where the row is dropped and stick it there in the order.
                var newY = d3.select(this).attr('y');
                var newI = getRowIndexByY(newY);
                var oldI = state.currAggOrder.indexOf(d);
                if (newI < oldI) {
                    state.currAggOrder.splice(newI, 0, state.currAggOrder.splice(oldI, 1)[0]);
                    $('#sortSelect').val('None');
                } else if (newI > oldI) {
                    state.currAggOrder.splice(newI, 0, state.currAggOrder[oldI]);
                    state.currAggOrder.splice(oldI, 1);
                    $('#sortSelect').val('None');
                }
                repositionData();
                repositionLabels();
            })
        )
        .transition()
        .delay(transdur)
        .text(function(d) {
            return state.aggList[d] == '' ? '[EMPTY FIELD]' : state.aggList[d];
        });

    var rowHighlightBar = matrixView.selectAll('.rowHighlightBar')
        .data(state.currAggOrder, String);
    rowHighlightBar.enter().append('svg:rect')
        .attr('class', 'rowHighlightBar catColor')
        .attr('x', state.x(-1))
        .attr('width', state.x.range()[1] - state.x.range()[0])
        .attr('y', function(d) { return state.y(d) - mvNS.highlightBarHeight/2; })
        .attr('height', mvNS.highlightBarHeight)
        .style('fill', function(d) { return state.aggColors[d]; })
        .style('fill-opacity', function(d) { return state.aggsColored[d] ? mvNS.minFill : 0; })
        .on('mouseover', function(d) {
            brushRow(d);
        })
        .on('mouseout', function(d) {
            unbrushRow(d);
        })
        .on('click', function(d) {
            //toggleRowSelect(d);
            selectRow(d);
        });
    rowHighlightBar.transition()
        .duration(transdur)
        .attr('y', function(d) { return state.y(state.currAggOrder.indexOf(d)) - mvNS.highlightBarHeight/2; })
        .attr('width', state.x(state.currColOrder.length) - state.x.range()[0]);
    //rowHighlightBar.exit().remove();

    var aggShapes = matrixView.selectAll('.aggShape')
        .data(state.aggData);
    aggShapes.enter().append('svg:circle')
        .attr('class','innerShape aggShape')
        .attr('r', 0)
        .attr('cx', getCircleX)
        .attr('cy', getCircleY)
        .style('stroke', 'black')
        .style('fill-opacity', .6)
        .style('fill', function(d) { return state.aggColors[d.row]; })
        //.style('fill', defaultColor)// TODO: during aggregation, combine colors
        .on('mouseover', function(d) {
            brushRow(d.row);
            brushCol(d.col);
            showTooltip(d.prop);
        })
        .on('mouseout', function(d) {
            unbrushRow(d.row);
            unbrushCol(d.col);
            hideTooltip();
        })
        .on('click', function(d) {
            selectRow(d.row);
            selectCol(d.col);
        })
        .transition()
        .duration(transdur)
        .delay(transdur)
        .attr('r', getR);

    // Do this after everything else cause it's less important
    // Replace all the lists in aggIQRs with IQR objects // TODO: move this after the transition?
    var currPropList, q1, q2, q3, l, nz;
    var quartileData = [];
    var getI = function(index, numZeros, vals) {
        if (index < numZeros) {
            return 0;
        } else {
            return vals[index - numZeros];
        }
    };
    for (i = 0; i < state.aggIQRs.length; i++) {
        l = state.aggregates[i].length;
        for (topicID in state.aggIQRs[i]) {
            currPropList = state.aggIQRs[i][topicID];
            //l = currPropList.length;
            nz = l - currPropList.length; // number of zeros, were we to fill out the full array
            currPropList.sort(function(a,b){return a-b;});
            if (l >= 4) {
                if (l % 2 === 0) {
                    q2 = (getI(l/2 - 1,nz,currPropList) + getI(l/2,nz,currPropList))/2;
                    if (l % 4 === 0) {
                        q1 = (getI(l/4 - 1,nz,currPropList) + getI(l/4,nz,currPropList))/2;
                        q3 = (getI(3*l/4 - 1,nz,currPropList) + getI(3*l/4,nz,currPropList))/2;
                    } else {
                        q1 = getI(Math.floor(l/4),nz,currPropList);
                        q3 = getI(Math.floor(3*l/4),nz,currPropList);
                    }
                } else {
                    q2 = getI(Math.floor(l/2),nz,currPropList);
                    if ((l - 1) % 4 === 0) {
                        q1 = (getI((l-1)/4 - 1,nz,currPropList) + getI((l-1)/4,nz,currPropList))/2;
                        q3 = (getI(Math.floor(3*l/4),nz,currPropList) + getI(Math.floor(3*l/4 + 1),nz,currPropList))/2;
                    } else {
                        q1 = getI(Math.floor((l-1)/4),nz,currPropList);
                        q3 = getI(Math.floor(3*l/4),nz,currPropList);
                    }
                }
            } else if (l === 3) {
                q1 = getI(0,nz,currPropList);
                q2 = getI(1,nz,currPropList);
                q3 = getI(2,nz,currPropList);
            } else if (l === 2) {
                q1 = getI(0,nz,currPropList);
                q2 = (getI(0,nz,currPropList) + getI(1,nz,currPropList))/2;
                q3 = getI(1,nz,currPropList);
            } else {
                q1 = getI(0,nz,currPropList);
                q2 = getI(0,nz,currPropList);
                q3 = getI(0,nz,currPropList);
            }
            if (isNaN(q1) || isNaN(q2) || isNaN(q3)) {
                var x;
            }
            state.aggIQRs[i][topicID] = {'q1': q1, 'q2': q2, 'q3': q3};
            quartileData.push({'col':parseInt(topicID), 'row':i, 'prop': q1, 'type': 'q'});
            quartileData.push({'col':parseInt(topicID), 'row':i, 'prop': q2, 'type': 'q'});
            quartileData.push({'col':parseInt(topicID), 'row':i, 'prop': q3, 'type': 'q'});
        }
    }
    var qShapes = matrixView.selectAll('.qShape')
        .data(quartileData);
    qShapes.enter().append('svg:circle')
        //.attr('class','innerShape qShape')
        .attr('class','qShape')
        .attr('r', 0)
        //.attr('r', getR)
        .attr('cx', getCircleX)
        .attr('cy', getCircleY)
        .style('stroke', 'gray')
        .style('fill-opacity', 0)
        .on('mouseover', function(d) {
            brushRow(d.row);
            brushCol(d.col);
            showTooltip(d.prop);
        })
        .on('mouseout', function(d) {
            unbrushRow(d.row);
            unbrushCol(d.col);
            hideTooltip();
        })
        .on('click', function(d) {
            selectRow(d.row);
            selectCol(d.col);
        })
        // For now, no fill or mousing
        .transition()
        .duration(transdur)
        .delay(transdur)
        .attr('r', getR);
};

var unaggregate = function(toThisData) {
    // What are we unaggregating to? Default is just currData, but openGroup may pass something else.
    if (typeof(toThisData) === 'undefined') {
        toThisData = state.currData;
    }

    if (typeof(state.lastAgg) === 'undefined') {
        d3.select('#matrixViewBreadcrumbs').html('Model');
    }
    state.aggregatingBy = undefined;

    // Restore docView to pertain to individual documents
    $('#docViewTypeLabel').html('Document');
    d3.select('#docViewTitle')
        .on('dblclick', function() {

        });
    $('#right_sidebar_bottom_navbar li').removeClass('active');
    $('#aggregateListLI').hide();
    $('#docMetadataLI')
        .addClass('active')
        .show();
    $('#docTopicLayoutLI').show();
    $('#right_sidebar_bottom_content .tab-pane').removeClass('active');
    $('#docMetadataTab').addClass('active');
    $('#aggregateListTab').html('No documents selected.');

    // Other UI updates
    unselectRow();
    $('#clearAggDiv').hide();
    $('#openGroup').parent().addClass('disabled');
    $('#openGroupInMeso').parent().addClass('disabled');
    $('#openInTextViewer').parent().removeClass('disabled');
    $('#aggregateSelect').val('None');
    d3.selectAll('.rowLabel').remove();
    d3.selectAll('.rowHighlightBar').remove();
    d3.selectAll('.qShape').remove();
    d3.selectAll('.aggShape')
        .transition()
        .duration(transdur)
        .attr('r', 0)
        .remove();

    var oldYScale = state.y;

    var innerShape = matrixView.selectAll('.fullData')
        .data(toThisData);
    innerShape.enter().append('svg:circle')
        .attr('class','innerShape fullData')
        .attr('r', 0)
        .attr('cx', getCircleX)
        .attr('cy', function(d) {
            return oldYScale(state.currAggOrder.indexOf(state.docToAgg[d.row]));
        })
        //.attr('cy', getCircleY)
        .style('stroke', 'black')
        .style('fill-opacity', .6)
        .style('fill', function(d) { return state.rowColors[d.row]; })
        .on('mouseover', function(d) {
             brushRow(d.row);
             brushCol(d.col);
             showTooltip(d.prop);
         })
         .on('mouseout', function(d) {
             unbrushRow(d.row);
             unbrushCol(d.col);
             hideTooltip();
         })
         .on('click', function(d) {
             selectRow(d.row);
             selectCol(d.col);
         })
        .transition()
        .duration(transdur)
        .attr('r', getR);
    innerShape.exit().remove();

    setWidthsHeightsScales();
    setTimeout(function() { drawGrid(); }, transdur);

    innerShape.transition()
        .duration(transdur)
        .delay(transdur)
        .attr('cy', getCircleY);

    setTimeout(function() {
//        updateMatrixView(toThisData);
        updateMatrixView();
        matrixView.selectAll('.innerShape').attr('r',getR);
    }, 2*transdur);
};

var createFilter = function(sel, form) {
    // Init filters list if needed
    if (typeof(state.filters) === 'undefined') {
        state.filters = {};
        state.filterCount = 0; // This keeps an index for EVERY filter created in a session.
    }
    // Generate filter names
    var shortName = '';
    var longName = '';
    for (var fieldName in form) {
        if (form[fieldName] != '') {
            shortName += fieldName + ';';
            longName += fieldName + ': ' + form[fieldName] + '<br />';
        }
    }
    // Add filter
    state.filters[state.filterCount] = sel;
    // Create a visual representation of the filter
    var filter = d3.select('#filterWell')
        .append('div')
        .attr('id', 'filter' + state.filterCount)
        .attr('filterIndex', state.filterCount)
        .attr('class', 'alert fade in');
    filter.append('button')
        .attr('type', 'button')
        .attr('class', 'close')
        .attr('data-dismiss', 'alert')
        .text('×');
    filter.append('strong')
        .text(shortName);
    $('#filter' + state.filterCount)
        .tooltip({html:true, placement:'top', title:longName})
        .bind('close', function() {
            removeFilter($(this).attr('filterIndex'));
            $('.tooltip').hide();
        });
    // Hide rows being filtered out
    hideRowsNotIn(sel);
    state.filterCount++;
};

var removeFilter = function(filterIndex) {
    var i;
    if (typeof(state.filters[filterIndex]) !== 'undefined') {
        // Remove filter from the state.filters list
        delete state.filters[filterIndex];
        // Find the rows that will be shown as per the current filters
        var rowsToShow = new Array(state.rowList.length);
        for (i = 0; i < state.rowList.length; i++) {
            rowsToShow[i] = i;
        }
        i = 0;
        while (i < rowsToShow.length) {
            for (var filterNum in state.filters) {
                if (state.filters[filterNum].indexOf(rowsToShow[i]) === -1) {
                    rowsToShow.splice(i, 1);
                    i--;
                    break;
                }
            }
            i++;
        }
        // Show only those rows
        state.currData = state.data.slice(0);

        // Fix row order
        state.currRowOrder = rowsToShow;
        state.selectedRows = [];
        updateRowSelectDiv();

        hideRowsNotIn(rowsToShow);
    }
};

// This function (seems to) populate a given div with a form containing accordions for each metadata field
// Used for filtering and selecting modals
var buildMetadataForm = function(formID) {
    var i;
    var adSelBody = d3.select('#' + formID);
    var currName, currType, accGrp, accInner;
    var catLists = {}; // This object will store a list of all the options of each category
    // Fill the accordion groups for each metadata field
    for (i = 0; i < state.metadataNames.length; i++) {
        currName = state.metadataNames[i];
        currType = state.metadataTypes[i];
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
    var currDoc, catName;
    for (i = 0; i < state.metadata.length; i++) {
        currDoc = state.metadata[i];
        for (catName in catLists) {
            if (catLists[catName].indexOf(currDoc[catName]) === -1) {
                catLists[catName].push(currDoc[catName]);
            }
        }
    }
    // Finally, use catLists to fill the cat select tags.
    var selectTag, catOption;
    for (catName in catLists) {
        selectTag = d3.select('#' + catName + '_select_' + formID);
        for (i = 0; i < catLists[catName].length; i++) {
            catOption = catLists[catName][i];
            selectTag.append('option')
                .attr('value', catOption)
                .attr('name', catOption)
                .text(catOption);
        }
    }
};

// Function for deriving which rows are selected given the state of a particular form
// TODO: this may do some weird things for selections when stuff is hidden vs. not
var getSelectionFromFormObj = function(formObj) {
    var i;
    //var sel = state.currRowOrder.slice(0);
    // Rather than just getting documents that are visible, get all (easier for overlapping filters).
    var sel = new Array(state.rowList.length);
    for (i = 0; i < state.rowList.length; i++) {
        sel[i] = i;
    }
    var currName, currType, minVal, maxVal;
    for (i = 0; i < state.metadataNames.length; i++) {
        currName = state.metadataNames[i];
        currType = state.metadataTypes[i];

        if (currType === 'str' || currType === 'cat') {
            if (formObj[currName] == '') {
                continue;
            }
            sel = selectByStringField(currName, formObj[currName], sel);
        } else if (currType === 'int') {
            minVal = formObj['min' + currName] == '' ? -Infinity : parseInt(formObj['min' + currName]);
            maxVal = formObj['max' + currName] == '' ? Infinity : parseInt(formObj['max' + currName]);
            if (minVal == '' && maxVal == '') {
                continue;
            }
            sel = selectByIntField(currName, minVal, maxVal, sel);
        }
    }
    return sel;
};

var selectByStringField = function(fieldName, fieldValue, currSelection) {
    // If no currSelection provided, default to entire corpus
    if (typeof(currSelection) === 'undefined') {
        currSelection = state.currRowOrder.slice(0);
    }

    // Now filter by fieldValue
    for (var i = 0; i < currSelection.length; i++) {
        // If metadata doesn't exist for this entry, then filter it out.
        if (currSelection[i] > state.metadata.length - 1 || Object.keys(state.metadata[currSelection[i]]).length === 0) {
            currSelection.splice(i,1);
            i--;
        } else {
            if (typeof(state.metadata[currSelection[i]][fieldName]) === 'undefined' ||
                state.metadata[currSelection[i]][fieldName].toLowerCase().indexOf(fieldValue.toLowerCase()) === -1) {
                currSelection.splice(i,1);
                i--; // ...since we removed one, move index back 1
            }
        }
    }

    return currSelection;
};

var selectByIntField = function(fieldName, minVal, maxVal, currSelection) {
    // If no currSelection provided, default to entire corpus
    if (typeof(currSelection) === 'undefined') {
        currSelection = state.currRowOrder.slice(0);
    }
    // Not sure I'll need these year defaults, but doesn't hurt
    if (typeof(maxVal) === 'undefined') {
        maxVal = Infinity;
    }
    if (typeof(minVal) === 'undefined') {
        minVal = -Infinity;
    }

    // Now filter out docs not in range
    var currVal;
    for (var i = 0; i < currSelection.length; i++) {
        // If metadata doesn't exist for this entry, then filter it out.
        if (currSelection[i] > state.metadata.length - 1 || Object.keys(state.metadata[currSelection[i]]).length === 0) {
            currSelection.splice(i,1);
            i--;
        } else {
            currVal = state.metadata[currSelection[i]][fieldName];
            if (currVal < minVal || currVal > maxVal) {
                currSelection.splice(i,1);
                i--;
            }
        }
    }

    return currSelection;
};

var getObjectFromForm = function(formID) {
    var tempObject = {};
    d3.selectAll('#' + formID + ' input').each(function() {
        var $this = d3.select(this);
        if ($this.property('type') !== 'submit') {
            tempObject[$this.property('name')] = $this.property('value');
        }
    });
    d3.selectAll('#' + formID + ' select').each(function() {
        var $this = d3.select(this);
        tempObject[$this.property('name')] = $this.property('value');
    });
    return tempObject;
};

var sortRowsByMetadata = function(fieldName) {
    var fieldNum = state.metadataNames.indexOf(fieldName);
    if (fieldNum === -1) {
        return;
    }

    var fieldType = state.metadataTypes[fieldNum];
    if (fieldType === 'str' || fieldType === 'cat' || fieldType === 'int') {
        state.currRowOrder.sort(function(d1, d2) {
            if (fieldName in state.metadata[d1] && state.metadata[d1] != '') {
                if (fieldName in state.metadata[d2] && state.metadata[d2] != '') {
                    var d1Val = state.metadata[d1][fieldName];
                    var d2Val = state.metadata[d2][fieldName];
                    if (fieldType === 'str' || fieldType === 'cat') {
                        if (d1Val > d2Val) {
                            return state.sortOrderVar;
                        } else if (d2Val > d1Val) {
                            return -1 * state.sortOrderVar;
                        }
                        return 0;
                    } else if (fieldType === 'int') {
                        return parseInt(d1Val) - parseInt(d2Val);
                    }
                } else {
                    return -1;
                }
            } else {
                if (fieldName in state.metadata[d2] && state.metadata[d2] != '') {
                    return 1;
                } else {
                    return 0;
                }
            }
        });
        repositionData();
        repositionLabels(true);
    }
};

var sortColsByMetadata = function(fieldName) {
    var fieldNum = state.topicMetadataNames.indexOf(fieldName);
    if (fieldNum === -1) {
        return;
    }
    // Sorting in descending order, seems more useful that way
    state.currColOrder.sort(function(t1, t2) {
        if (typeof(state.topicMetadata[t1]) !== 'undefined' && fieldName in state.topicMetadata[t1] && state.topicMetadata[t1] != '') {
            if (typeof(state.topicMetadata[t2]) !== 'undefined' && fieldName in state.topicMetadata[t2] && state.topicMetadata[t2] != '') {
                var t1Val = state.topicMetadata[t1][fieldName];
                var t2Val = state.topicMetadata[t2][fieldName];
                //return parseFloat(t1Val) - parseFloat(t2Val);
                return parseFloat(t2Val) - parseFloat(t1Val);
            } else {
                //return -1;
                return 1;
            }
        } else {
            if (typeof(state.topicMetadata[t2]) !== 'undefined' && fieldName in state.topicMetadata[t2] && state.topicMetadata[t2] != '') {
                //return 1;
                return -1;
            } else {
                return 0;
            }
        }
    });
    repositionData();
    repositionLabels(true); // TODO: need to indicate this is different from row resort so select goes back to None
};

var sortColsByAnovaOn = function(fieldName) {
    var $ANOVA_SORT_URL = flask_util.url_for('cv_get_anova_order',
        {model_name: model_name,
         fieldName: fieldName}
    );

    d3.json($ANOVA_SORT_URL, function(json) {
        for (var i = 0; i < json.anovaOrder.length; i++) {
            json.anovaOrder[i] = parseInt(json.anovaOrder[i]);
        }
        setTopicOrder(json.anovaOrder);
    });
};

var sortColsByContrastBetween = function(fieldName, group1fieldNames, group2fieldNames) {
    var $CONTRAST_SORT_URL = flask_util.url_for('cv_get_contrast_order',
        {model_name: model_name,
         fieldName: fieldName,
         group1: group1fieldNames,
         group2: group2fieldNames}
    );

    d3.json($CONTRAST_SORT_URL, function(json) {
        for (var i = 0; i < json.contrastOrder.length; i++) {
            json.contrastOrder[i] = parseInt(json.contrastOrder[i]);
        }
        setTopicOrder(json.contrastOrder);
    });
};

var showTooltip = function(val) {
    d3.select('#dataTooltip')
        .text(val)
        .style('visibility', 'visible')
        .style('top', event.pageY+10+'px')
        .style('left', event.pageX+10+'px');
};

var hideTooltip = function() {
    d3.select('#dataTooltip').style('visibility','hidden');
};

var moveRowsToTop = function(selection) {
    var i;
    if (typeof(selection) !== 'undefined' && selection.length !== 0) {
        var indices = new Array(selection.length);
        for (i = 0; i < selection.length; i++) {
            indices[i] = state.currRowOrder.indexOf(selection[i]);
        }
        indices.sort(function(a,b) {return a-b;});
        for (i = 0; i < indices.length; i++) {
            state.currRowOrder.splice(i, 0, state.currRowOrder.splice(indices[i], 1)[0]);
        }
        repositionData();
        repositionLabels();
    }
};

var moveColsToLeft = function(selection) {
    var i;
    if (typeof(selection) !== 'undefined' && selection.length !== 0) {
        var indices = new Array(selection.length);
        for (i = 0; i < selection.length; i++) {
            indices[i] = state.currColOrder.indexOf(selection[i]);
        }
        indices.sort(function(a,b) {return a-b;});
        for (i = 0; i < indices.length; i++) {
            state.currColOrder.splice(i, 0, state.currColOrder.splice(indices[i], 1)[0]);
        }
        repositionData();
        repositionLabels();
        $('#topicSortSelect').val('');
    }
};

// This function sorts the rows by a selection (list) of cols
var sortRowsBy = function(selection) {
    if (typeof(selection) === 'undefined' || selection.length === 0) {
        return;
    }

    $('#sortSelect').val('None');
    //var sortOrderVar = d3.select('#ascendingOrderCheckbox').filter(':checked')[0].length == 1 ? 1 : -1;
    var sortOrderVar = 1;
    var listToSort;
    if (typeof(state.groupData) === 'undefined') {
        listToSort = typeof(state.aggregatingBy) === 'undefined' ? state.currRowOrder : state.currAggOrder;
    } else {
        listToSort = state.groupRowOrder;
    }
    state.oldRowOrder = listToSort.slice();
    var thetaToUse = typeof(state.aggregatingBy) === 'undefined' ? state.theta: state.aggTheta;
    listToSort.sort(function(d1,d2) {
        var d1Score = 0;
        var d2Score = 0;
        var t;
        for (var i = 0; i < selection.length; i++) {
            t = selection[i];
            if (typeof(thetaToUse[d1][t]) !== 'undefined') {
                d1Score += thetaToUse[d1][t];
            }
            if (typeof(thetaToUse[d2][t]) !== 'undefined') {
                d2Score += thetaToUse[d2][t];
            }
        }
        return sortOrderVar*(d2Score - d1Score);
    });
    repositionData();
    repositionLabels();
};

var addColSortFxn = function(fxnName, fxn) {
    d3.select('#topicSortSelect').append('option')
        .property('value', fxnName)
        .property('name', fxnName)
        .text(fxnName);
    state.colSortFxns[fxnName] = fxn;
};

var sortColsByFxn = function(fxn) {
    state.currColOrder.sort(fxn);
    repositionData();
    repositionLabels();
};

var sortColsBy = function(selection) {
    if (typeof(selection) === 'undefined' || selection.length === 0) {
        return;
    }

    state.oldColOrder = state.currColOrder.slice();

    state.currColOrder.sort(function(t1,t2) {
        var t1Score = 0;
        var t2Score = 0;
        var d;
        for (var i = 0; i < selection.length; i++) {
            d = selection[i];
            if (typeof(state.theta[d][t1]) !== 'undefined') {
                t1Score += state.theta[d][t1];
            }
            if (typeof(state.theta[d][t2]) !== 'undefined') {
                t2Score += state.theta[d][t2];
            }
        }
        return t2Score - t1Score;
    });
    repositionData();
    repositionLabels();
    $('#topicSortSelect').val('');
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
// Row similarity sorting helper
var sortRowsByDistanceFrom = function(rows, weighted) {
    rows = rows.slice(); // Make sure we don't kill the selection!
    // Make sure there are some things to move...
    if (allOutOfScope(rows, state.rowList.length)) {
        return;
    }
    $('#sortSelect').val('None');

    if (weighted) {
        sortVectorsByWeightedDistFrom(rows, state.currRowOrder, state.theta, state.colList.length)
    } else {
        sortVectorsByDistFrom(rows, state.currRowOrder, state.theta, state.colList.length);
    }
    repositionData();
    repositionLabels();
};
// Column similarity sorting helper
var sortColsByDistanceFrom = function(cols) {
    cols = cols.slice(); // Make sure we don't kill the selection!
    // Make sure there are some things to move...
    if (allOutOfScope(cols, state.colList.length)) {
        return;
    }
    $('#topicSortSelect').val('None');

    // Now sort!
    sortVectorsByDistFrom(cols, state.currColOrder, state.phi, state.rowList.length);
    repositionData();
    repositionLabels();
};
var allOutOfScope = function(selection, numTotal) {
    var i = 0;
    while (i < selection.length) {
        if (selection[i] >= 0 && selection[i] < numTotal) {
            return false;
        } else {
            selection.splice(i);
        }
    }
    return true;
};
// Sort the rows of the matrix by their distance from the MEAN of a given array of rows
var sortVectorsByDistFrom = function(vectorSelection, listToSort, parallelObjs, vectorLength) {
    // Define a mean vector with which to compare all vectors.
    var meanVecObj;
    if (vectorSelection.length === 1) {
        meanVecObj = parallelObjs[vectorSelection[0]];
    } else {
        meanVecObj = {};
        var vecObj, keyNum;
        // Add up all the values within vectors
        for (var i = 0; i < vectorSelection.length; i++) {
            vecObj = state.theta[vectorSelection[i]];
            for (keyNum in vecObj) {
                if (typeof(meanVecObj[keyNum]) === 'undefined') {
                    meanVecObj[keyNum] = vecObj[keyNum];
                } else {
                    meanVecObj[keyNum] += vecObj[keyNum];
                }
            }
        }
        // ...and divide!
        for (keyNum in meanVecObj) {
            meanVecObj[keyNum] /= vectorSelection.length;
        }
    }
    var meanVec = objToArray(meanVecObj, vectorLength);
    var meanVecMag = mag(meanVec);

    // And sort! Using a special helper function.
    var simToMean = function(vecNum) {
        var v = objToArray(parallelObjs[vecNum], vectorLength);
        return dot(v,meanVec) / (mag(v) * meanVecMag);
    };
    var sortOrderVar = 1;
    listToSort.sort(function(a,b) {
        return sortOrderVar * (simToMean(b) - simToMean(a));
    });
};
var weightedDot = function(v1, v2, weights) {
    if (v1.length !== v2.length || v1.length !== weights.length) {
        throw "Weighted dot product lengths do not match.";
    }
    var sum = 0;
    for (var i = 0; i < v1.length; i++) {
        sum += v1[i] * v2[i] * weights[i];
    }
    return sum;
};
// Sort the rows of the matrix by their distance from the MEAN of a given array of rows
var sortVectorsByWeightedDistFrom = function(vectorSelection, listToSort, parallelObjs, vectorLength) {
    // Define a mean vector with which to compare all vectors.
    var i;
    var meanVecObj, varVecObj;
    if (vectorSelection.length === 1) {
        meanVecObj = parallelObjs[vectorSelection[0]];
    } else {
        meanVecObj = {};
        varVecObj = {};
        var vecObj, keyNum;
        // Add up all the values within vectors
        for (i = 0; i < vectorSelection.length; i++) {
            vecObj = state.theta[vectorSelection[i]];
            for (keyNum in vecObj) {
                if (typeof(meanVecObj[keyNum]) === 'undefined') {
                    meanVecObj[keyNum] = vecObj[keyNum];
                    varVecObj[parseInt(keyNum)] = [vecObj[keyNum]];
                } else {
                    meanVecObj[keyNum] += vecObj[keyNum];
                    varVecObj[keyNum].push(vecObj[keyNum]);
                }
            }
        }
        // ...and divide!
        var mean, varTot;
        for (keyNum in meanVecObj) {
            meanVecObj[keyNum] /= vectorSelection.length;
            mean = 0.0;
            for (i = 0; i < varVecObj[keyNum]; i++) {
                mean += varVecObj[keyNum][i];
            }
            mean /= vectorSelection.length;
            varTot = 0.0;
            for (i = 0; i < varVecObj[keyNum]; i++) {
                varTot += (varVecObj[keyNum][i] - mean)^2;
            }
            varVecObj[keyNum] = varTot / vectorSelection.length;
        }
    }
    var meanVec = objToArray(meanVecObj, vectorLength);
    var varWeightings = new Array(vectorLength);
    for (i = 0; i < vectorLength; i++) {
        if (i in varVecObj) {
            varWeightings[i] = Math.exp(-1*varVecObj[i]);
        } else {
            varWeightings[i] = 0.0;
        }
    }
    var meanVecMag = mag(meanVec);

    // And sort! Using a special helper function.
    var simToMean = function(vecNum) {
        var v = objToArray(parallelObjs[vecNum], vectorLength);
        return weightedDot(v,meanVec,varWeightings) / (mag(v) * meanVecMag);
    };
    var sortOrderVar = 1;
    listToSort.sort(function(a,b) {
        return sortOrderVar * (simToMean(b) - simToMean(a));
    });
};

var sortDocsByNth = function(n) {
    var getNthFromObj = function(n, obj) {
        var vals = [];
        for (var key in obj) {
            vals.push(obj[key]);
        }
        vals.sort().reverse();
        if (vals.length > n) {
            return vals[n];
        } else {
            return -1;
        }
    };
    state.currRowOrder.sort(function(a,b) {
        return getNthFromObj(n, state.theta[b]) - getNthFromObj(n, state.theta[a]);
    });
    repositionData();
    repositionLabels();
};
var setDocOrder = function(docOrder) {
    if (docOrder.length !== state.rowList.length) {
        return false;
    }
    for (var i = 0; i < docOrder.length; i++) {
        if (!(i in docOrder)) {
            return false;
        }
    }
    state.currRowOrder = docOrder;
    repositionData();
    repositionLabels();
};
var setTopicOrder = function(topicOrder) {
    if (topicOrder.length !== state.colList.length) {
        return false;
    }
    for (var i = 0; i < topicOrder.length; i++) {
        if (!(i in topicOrder)) {
            return false;
        }
    }
    state.currColOrder = topicOrder;
    repositionData();
    repositionLabels();
};

var toggleColorBy = function(rowsOrCols) {
    var i;
    if (rowsOrCols === 'rows') {
        d3.select('#toggleColorByRowBtn').classed('active', true);
        d3.select('#toggleColorByColBtn').classed('active', false);
        if (state.colorByRows !== true) {
            state.colorByRows = true;
            matrixView.selectAll('.innerShape')
                .style('fill', defaultColor);
            matrixView.selectAll('.colHighlightBar')
                .style('fill', defaultColor)
                .style('fill-opacity', 0);

            var currRow;
            for (i = 0; i < state.rowsColored.length; i++) {
                currRow = state.rowsColored[i];
                colorRows([currRow], state.rowColors[currRow]);
            }
        }
    } else if (rowsOrCols === 'cols') {
        d3.select('#toggleColorByColBtn').classed('active', true);
        d3.select('#toggleColorByRowBtn').classed('active', false);
        if (state.colorByRows !== false) {
            state.colorByRows = false;
            matrixView.selectAll('.innerShape')
                .style('fill', defaultColor);
            matrixView.selectAll('.rowHighlightBar')
                .style('fill', defaultColor)
                .style('fill-opacity', 0);

            var currCol;
            for (i = 0; i < state.colsColored.length; i++) {
                currCol = state.colsColored[i];
                colorCols([currCol], state.colColors[currCol]);
            }
        }
    }
};

var colorRows = function(selection, color) {
    var i;
    if (state.colorByRows === false) {
        toggleColorBy('rows');
    }

    matrixView.selectAll('.innerShape').select(function(d) { return selection.indexOf(d.row) !== -1 ? this : null; })
        .style('fill', color);
    matrixView.selectAll('.rowHighlightBar').select(function(d) { return selection.indexOf(d) !== -1 ? this : null; })
        .style('fill', color)
        .style('fill-opacity', mvNS.minFill);
    if (typeof(state.aggregatingBy) === 'undefined') {
        for (i = 0; i < selection.length; i++) {
            state.rowColors[selection[i]] = color;
            if (state.rowsColored.indexOf(selection[i]) === -1) {
                state.rowsColored.push(selection[i]);
            }
        }
    } else {
        for (i = 0; i < selection.length; i++) {
            state.aggColors[selection[i]] = color;
            state.aggsColored[selection[i]] = true;
            for (var j = 0; j < state.aggregates[selection[i]].length; j++) {
                state.rowColors[state.aggregates[selection[i]][j]] = color;
                state.rowsColored[state.aggregates[selection[i]][j]] = true;
                if (state.rowsColored.indexOf(selection[i]) !== -1) {
                    state.rowsColored.splice(state.rowsColored.indexOf(selection[i]), 1);
                }
            }
        }
    }
};

var uncolorRows = function(selection) {
    if (state.colorByRows) {
        matrixView.selectAll('.innerShape').select(function(d) { return selection.indexOf(d.row) !== -1 ? this : null; })
            .style('fill', defaultColor);
        matrixView.selectAll('.rowHighlightBar').select(function(d) { return selection.indexOf(d) !== -1 ? this : null; })
            .style('fill', defaultColor)
            .style('fill-opacity', 0);
    }
    for (var i = 0; i < selection.length; i++) {
        state.rowColors[selection[i]] = defaultColor;
        if (state.rowsColored.indexOf(selection[i]) !== -1) {
            state.rowsColored.splice(state.rowsColored.indexOf(selection[i]),1);
        }
    }

    if (selection.indexOf(state.selectedRow) !== -1) {
        // Nothing to do in this case
    }
};

var colorCols = function(selection, color) {
    if (state.colorByRows === true) {
        toggleColorBy('cols');
    }

    matrixView.selectAll('.innerShape').select(function(d) { return selection.indexOf(d.col) !== -1 ? this : null; })
        .style('fill', color);
    matrixView.selectAll('.colHighlightBar').select(function(d) { return selection.indexOf(d) !== -1 ? this : null; })
        .style('fill', color)
        .style('fill-opacity', mvNS.minFill);
    for (var i = 0; i < selection.length; i++) {
        state.colColors[selection[i]] = color;
        if (state.colsColored.indexOf(selection[i]) === -1) {
            state.colsColored.push(selection[i]);
        }
    }

    // Update topicView and docView if needed.
    if (selection.indexOf(state.selectedCol) !== -1) {
        d3.selectAll('.wordBar,.cloudWord')
            .style('fill', color);
    }
    d3.selectAll('.tBar')
        .filter(function() { return selection.indexOf(parseInt(d3.select(this).attr('topic'))) !== -1; })
        .style('fill', color);
};

var uncolorCols = function(selection) {
    if (state.colorByRows === false) {
        matrixView.selectAll('.innerShape').select(function(d) { return selection.indexOf(d.col) !== -1 ? this : null; })
            .style('fill', defaultColor);
        matrixView.selectAll('.colHighlightBar').select(function(d) { return selection.indexOf(d) !== -1 ? this : null; })
            .style('fill', defaultColor)
            .style('fill-opacity', 0);
    }
    for (var i = 0; i < selection.length; i++) {
        state.colColors[selection[i]] = defaultColor;
        if (state.colsColored.indexOf(selection[i]) !== -1) {
            state.colsColored.splice(state.colsColored.indexOf(selection[i]),1);
        }
    }

    if (selection.indexOf(state.selectedCol) !== -1) {
        d3.selectAll('.wordBar')
            .style('fill', defaultColor);
        d3.selectAll('.cloudWord')
            .style('fill', defaultCloudWordColor);
    }
    d3.selectAll('.tBar')
        .filter(function() { return selection.indexOf(parseInt(d3.select(this).attr('topic'))) !== -1; })
        .style('fill', defaultColor);
};

var exportTopicColors = function() {
    var first = true;
    var topicColorStr = '';
    var topic;
    for (var i = 0; i < state.colsColored.length; i++) {
        topic = state.colsColored[i];
        if (!first) {
            topicColorStr += ';';
        } else {
            first = false;
        }
        topicColorStr += 'topic_' + topic + ':' + state.colColors[topic];
    }
    localStorage[model_name] = topicColorStr;
    updateLineGraphCSS();
};

var applyColorEncoding = function(encodingName) {
    if (encodingName === 'cat' || encodingName === 'div' || encodingName === 'seq') {
        state.colorEncoding = encodingName;

        d3.selectAll('.catColor').style('visibility', 'hidden');
        d3.selectAll('.divColor').style('visibility', 'hidden');
        d3.selectAll('.seqColor').style('visibility', 'hidden');
        d3.selectAll('.' + encodingName + 'Color').style('visibility', 'visible');

        d3.selectAll('.innerShape')
            .style('fill', getColorFxn());
    }
};

var getColorFxn = function() {
    if (state.colorEncoding === 'div') {
        return getDivColor;
    } else if (state.colorEncoding === 'seq') {
        return getSeqColor;
    } else {
        return getCatColor;
    }
};

var getCatColor = function(d) {
    if (state.colorByRows === true) {
        return state.rowColors[d.row];
    } else if (state.colorByRows === false) {
        return state.colColors[d.col];
    } else {
        return defaultColor;
    }
};

var getDivColor = function(d) {
    return colors.div[Math.round(state.divScale(d.prop))];
};

var getSeqColor = function(d) {
    return colors.seq[Math.round(state.seqScale(d.prop))];
};

/**************** HIDING FUNCTIONS *************************/

var hideCols = function(selection) {
    var dataToUse;
    if (typeof(state.groupData) === 'undefined') {
        if (typeof(state.aggregatingBy) === 'undefined') {
            dataToUse = state.currData;
        } else {
            dataToUse = state.aggData;
        }
    } else {
        dataToUse = state.groupData;
    }

    // Remove selected columns from currColOrder
    var i;
    for (var c = 0; c < selection.length; c++) {
        i = state.currColOrder.indexOf(selection[c]);
        if (i !== -1) {
            state.currColOrder.splice(i, 1);
        }
    }
    // Remove selected columns' data from currData
    i = 0;
    while (i < dataToUse.length) {
        if (selection.indexOf(dataToUse[i].col) !== -1) {
            dataToUse.splice(i, 1);
            i--;
        }
        i++;
    }
    // Remove aggregate glyphs, since not taken care of in updateMatrixView -- TODO: this is a cheap hack
    d3.selectAll('.qShape')
        .filter(function(d) { return state.currColOrder.indexOf(d.col) === -1; })
        .remove();
    // Draw 'em
    updateMatrixView();
};

var hideColsNotIn = function(selection) {
    // Loop through currColOrder to see which aren't selected.
    var colsToHide = state.currColOrder.slice(0);
    var i = 0;
    while (i < colsToHide.length) {
        if (selection.indexOf(colsToHide[i]) !== -1) {
            colsToHide.splice(i, 1);
            i--;
        }
        i++;
    }
    hideCols(colsToHide);
};

var hideEmptyCols = function() {
    // Loop through currData to see which cols are empty. TODO: Should this be data or currData?
    var dataToUse;
    if (typeof(state.groupData) === 'undefined') {
        if (typeof(state.aggregatingBy) === 'undefined') {
            dataToUse = state.currData;
        } else {
            dataToUse = state.aggData;
        }
    } else {
        dataToUse = state.groupData;
    }
    var colsToHide = state.currColOrder.slice(0);
    var currDatumIndex;
    for (var i = 0; i < dataToUse.length; i++) {
        if (colsToHide.length === 0) {
            break;
        }
        currDatumIndex = colsToHide.indexOf(dataToUse[i].col);
        if (currDatumIndex !== -1) {
            colsToHide.splice(currDatumIndex, 1);
        }
    }

    if (colsToHide.length !== 0) {
        hideCols(colsToHide);
    }
};

var hideRows = function(selection) {
    var dataToUse, rowOrder;
    if (typeof(state.groupData) === 'undefined') {
        if (typeof(state.aggregatingBy) === 'undefined') {
            dataToUse = state.currData;
            rowOrder = state.currRowOrder;
        } else {
            dataToUse = state.aggData;
            rowOrder = state.currAggOrder;
        }
    } else {
        dataToUse = state.groupData;
        rowOrder = state.groupRowOrder;
    }

    // Remove selected rows from currRowOrder
    var i;
    for (var r = 0; r < selection.length; r++) {
        i = rowOrder.indexOf(selection[r]);
        if (i !== -1) {
            rowOrder.splice(i, 1);
        }
    }
    // Remove selected rows' data from currData
    i = 0;
    while (i < dataToUse.length) {
        // TODO: this is a hacky fix. Should consolidate this and hideCols somehow.
        if (selection.indexOf(dataToUse[i].row) !== -1 || state.currColOrder.indexOf(dataToUse[i].col) === -1) {
            dataToUse.splice(i, 1);
            i--;
        }
        i++;
    }
    // Remove aggregate glyphs, since not taken care of in updateMatrixView -- TODO: this is a cheap hack
    d3.selectAll('.qShape')
        //.filter(function(d) { return state.currRowOrder.indexOf(d.row) == -1; })
        .filter(function(d) { return selection.indexOf(d.row) !== -1; })
        .remove();
    // Draw 'em
    updateMatrixView();
};

var hideRowsNotIn = function(selection) {
    // Loop through currRowOrder to see which aren't selected.
    var rowsToHide;
    if (typeof(state.groupData) === 'undefined') {
        if (typeof(state.aggregatingBy) === 'undefined') {
            rowsToHide = state.currRowOrder.slice(0);
        } else {
            rowsToHide = state.currAggOrder.slice(0);
        }
    } else {
        rowsToHide = state.groupRowOrder.slice(0);
    }
    var i = 0;
    while (i < rowsToHide.length) {
        if (selection.indexOf(rowsToHide[i]) !== -1) {
            rowsToHide.splice(i, 1);
            i--;
        }
        i++;
    }
    hideRows(rowsToHide);
};

var hideEmptyRows = function() {
    // Loop through currData to see which rows are empty. TODO: Should this be data or currData?
    var dataToUse, rowsToHide;
    if (typeof(state.groupData) === 'undefined') {
        if (typeof(state.aggregatingBy) === 'undefined') {
            dataToUse = state.currData;
            rowsToHide = state.currRowOrder.slice(0);
        } else {
            dataToUse = state.aggData;
            rowsToHide = state.currAggOrder.slice(0);
        }
    } else {
        dataToUse = state.groupData;
        rowsToHide = state.groupRowOrder.slice(0);
    }

    var currDatumIndex;
    for (var i = 0; i < dataToUse.length; i++) {
        if (rowsToHide.length === 0) {
            break;
        }
        currDatumIndex = rowsToHide.indexOf(dataToUse[i].row);
        if (currDatumIndex !== -1) {
            rowsToHide.splice(currDatumIndex, 1);
        }
    }
    if (rowsToHide.length !== 0) {
        hideRows(rowsToHide);
    }
};

/**************** DATA RETRIEVAL **************************/

var setWidthsHeightsScales = function() {
    var rowList = typeof(state.aggregatingBy) === 'undefined' ? state.rowList : state.aggList;
    var rowOrder;
    if (typeof(state.groupData) === 'undefined') {
        if (typeof(state.aggregatingBy) === 'undefined') {
            rowOrder = state.currRowOrder;
        } else {
            rowOrder = state.currAggOrder;
        }
    } else {
        rowOrder = state.groupRowOrder;
    }

    var separation = typeof(state.aggregatingBy) === 'undefined' ? matrixSeparation : aggSizeFactor*matrixSeparation;
    mvNS.rowLabelWidth = 8 * Math.max.apply(Math, state.rowList.map(function(e) { return typeof(e) === 'undefined' ? 0 : e.length; })) + 10;
    mvNS.colLabelHeight = 7 * Math.max.apply(Math, state.colList.map(function(e) { return typeof(e) === 'undefined' ? 0 : e.length; })) + 10;
    mvNS.w = Math.max(mvNS.minW, state.currColOrder.length * separation + mvNS.rowLabelWidth);
    matrixView.attr('width', mvNS.w);
    mvNS.h = Math.max(mvNS.minH, rowOrder.length * separation + mvNS.colLabelHeight);
    matrixView.attr('height', mvNS.h);

    state.x = d3.scale.linear()
        .domain([-1, state.currColOrder.length])
        .range([mvNS.rowLabelWidth + mvNS.buffer, mvNS.w - mvNS.buffer]);
    state.y = d3.scale.linear()
        .domain([-1, rowOrder.length])
        .range([mvNS.colLabelHeight + mvNS.buffer, mvNS.h - mvNS.buffer]);
};

var fetchTheta = function() {
    d3.json($THETA_URL, function(json) {
        var i;
        state.theta = json.theta;
        state.topicMetadata = json.topicMetadata;
        state.topicMetadataNames = json.topicMetadataFields;
        state.docGroups = json.docGroups;
        state.topicGroups = json.topicGroups;

        if (typeof(json.rowList) === 'undefined') {
            state.rowList = new Array(json.numDocs);
            for (i = 0; i < json.numDocs; i++) {
                state.rowList[i] = 'Document ' + i;
            }
        } else {
            state.rowList = json.rowList;
        }
        if (typeof(json.colList) === 'undefined') {
            state.colList = new Array(json.numTopics);
            for (i = 0; i < json.numTopics; i++) {
                state.colList[i] = 'Topic ' + i;
            }
        } else {
            state.colList = json.colList;
        }

        state.maxVal = 1;
        state.minVal = 0;
        state.maxSize = Math.max(Math.abs(state.maxVal), Math.abs(state.minVal));
        state.divScale = d3.scale.linear().domain([-1*state.maxSize, state.maxSize]).range([0, colors.div.length - 1]);
        state.seqScale = d3.scale.linear().domain([state.minVal, state.maxVal]).range([0, colors.seq.length - 1])
        mvNS.areaScale.domain([0,state.maxSize]);

        state.phi = buildPhi(state.theta, state.colList.length);
        useData();

        fetchMetadata();
    });
};

var buildPhi = function(theta, numCols) {
    var i;
    var phi = new Array(numCols);
    for (i = 0; i < theta.length; i++) {
        for (var col in theta[i]) {
            if (typeof(phi[col]) === 'undefined') {
                phi[col] = {};
                phi[col][i] = theta[i][col];
            }
            else {
                phi[col][i] = theta[i][col];
            }
        }
    }
    for (i = 0; i < phi.length; i++) {
        if (typeof(phi[i]) === 'undefined') {
            phi[i] = {};
        }
    }
    return phi;
};

var checkThetaAndPhi = function() {
    areEqual = true;
    for (var row=0; row<state.rowList.length; row++) {
        for (var col=0; col<state.colList.length; col++) {
            if (state.theta[row][col] !== state.phi[col][row]) {
                console.log(row + ' ' + col + ' ' + state.theta[row][col] + ' ' + state.phi[col][row]);
                areEqual = false;
            }
        }
    }
    return areEqual;
};

var useData = function() {
    initOrders();
    initColors();
    setWidthsHeightsScales();

    //getQuartiles();

    // Now make the data points.
    state.data = [];
    var v;
    for (var r = 0; r < state.theta.length; r++) {
        for (var c in state.theta[r]) {
            v = state.theta[r][c];
            state.data.push({'row': r, 'col': parseInt(c), 'prop': v});
        }
    }
    state.currData = state.data.slice(0);

    // Draw it.
    updateMatrixView();
};

var fetchMetadata = function() {
    d3.json($METADATA_URL, function(json) {
        state.metadataTypes = json.dataTypes;
        state.metadataNames = json.fieldNames;
        state.metadata = json.metadata;

        initSidebarFunctions();
        initSettings();
    });
};

var initOrders = function() {
    var i;
    // Initially order documents just as they come.
    state.currRowOrder = new Array(state.rowList.length);
    for (i = 0; i < state.rowList.length; i++) {
        state.currRowOrder[i] = i;
    }
    state.currColOrder = new Array(state.colList.length);
    for (i = 0; i < state.colList.length; i++) {
        state.currColOrder[i] = i;
    }
    state.oldRowOrder = state.currRowOrder.slice();
    state.oldColOrder = state.currColOrder.slice();

    // Also create arrays for selectedRows and selectedCols
    state.selectedRows = [];
    state.selectedCols = [];
    updateRowSelectDiv();
};

var initColors = function() {
    var i;
    // Initialize colors all as default
    state.colColors = new Array(state.colList.length);
    for (i = 0; i < state.colList.length; i++) {
        state.colColors[i] = defaultColor;
    }
    state.colsColored = [];

    state.rowColors = new Array(state.rowList.length);
    for (i = 0; i < state.rowList.length; i++) {
        state.rowColors[i] = defaultColor;
    }
    state.rowsColored = [];
};

// TODO: bring up a warning alerting the user that this will bring back hidden columns
// TODO: This screws up the drawing order when bringing back gridlines. Fix using d3's sort operator.
var resetOrders = function() {
    d3.select('#matrixViewBreadcrumbs').html('Model')
    state.groupData = undefined;
    if (typeof(state.aggregatingBy) !== 'undefined') {
        state.aggregatingBy = undefined;
        unaggregate();
    }
    state.currData = state.data.slice(0);
    $('#topicSortSelect').val('');
    initOrders();
    setWidthsHeightsScales();
    updateMatrixView();
    /*repositionData(); // TODO: might keep these as option for when we don't want to unhide cols...
    repositionLabels();*/
};

var resetColors = function() {
    initColors();
    matrixView.selectAll('.innerShape')
        .style('fill', defaultColor);
    matrixView.selectAll('.rowHighlightBar')
        .style('fill', defaultColor)
        .style('fill-opacity', 0);
    matrixView.selectAll('.colHighlightBar')
        .style('fill', defaultColor)
        .style('fill-opacity', 0);
    d3.selectAll('.wordBar')
        .style('fill', defaultColor);
    d3.selectAll('.cloudWord')
        .style('fill', defaultCloudWordColor);
    d3.selectAll('.tBar')
        .style('fill', defaultColor);
    exportTopicColors();
};

var repositionData = function() {
    /*var rowOrder = state.currRowOrder.slice(0, MATRIX_Y_LIMIT);
    var colOrder = state.currColOrder.slice(0, MATRIX_X_LIMIT);
    var dataToUse = state.currData.filter(function(d) {

    });

    matrixView.selectAll('circle')
        .transition()
        .duration(transdur)
        .attr('cx', getCircleX)
        .attr('cy', getCircleY);
    drawGrid();*/
    updateMatrixView();
};

var repositionLabels = function(cameFromSortDropdown, cameFromTopicSortDropdown) {
    /*if (typeof(cameFromSortDropdown == false || cameFromSortDropdown) === 'undefined') {
        $('#sortSelect').val('');
    }

    var orderToUse;
    if (typeof(state.groupData) === 'undefined') {
        if (typeof(state.aggregatingBy) === 'undefined') {
            orderToUse = state.currRowOrder;
        } else {
            orderToUse = state.currAggOrder;
        }
    } else {
        orderToUse = state.groupRowOrder;
    }
    matrixView.selectAll('.rowLabel')
        .transition()
        .duration(transdur)
        .attr('x', mvNS.rowLabelWidth)
        .attr('y', function(d) { return state.y(orderToUse.indexOf(d)); });
    matrixView.selectAll('.rowHighlightBar')
        .transition()
        .duration(transdur)
        .attr('y', function(d) { return state.y(orderToUse.indexOf(d)) - mvNS.highlightBarHeight/2; });

    matrixView.selectAll('.colLabel')
        .transition()
        .duration(transdur)
        .attr('x', function(d) { return state.x(state.currColOrder.indexOf(d)); })
        .attr('transform', function(d) { return 'rotate(-60 ' + state.x(state.currColOrder.indexOf(d)) + ' ' + mvNS.colLabelHeight + ')'; });
    matrixView.selectAll('.colHighlightBar')
        .transition()
        .duration(transdur)
        .attr('x', function(d) { return state.x(state.currColOrder.indexOf(d)) - mvNS.highlightBarHeight/2; })
        */
};

var updateMatrixView = function() {
    $main_content = $("#main_content").addClass("withLoadingIndicator");
    // Specify which data to use (aggregate or full)
    var dataToUse, rowOrder, colOrder;
    if (typeof(state.groupData) === 'undefined') {
        if (typeof(state.aggregatingBy) === 'undefined') {
            dataToUse = state.currData;
            rowOrder = state.currRowOrder;
        } else {
            dataToUse = state.aggData;
            rowOrder = state.currAggOrder;
        }
    } else {
        dataToUse = state.groupData;
        rowOrder = state.groupRowOrder;
    }

    // Filter out the things (rows, cols, data) that don't make the cutoff for displaying in the current window
    rowOrder = rowOrder.slice(0, MATRIX_Y_LIMIT);
    colOrder = state.currColOrder.slice(0, MATRIX_X_LIMIT);
    dataToUse = dataToUse.filter(function(d) {
        return (rowOrder.indexOf(d.row) !== -1 && colOrder.indexOf(d.col) !== -1);
    });

    // Update scales
    setWidthsHeightsScales();

    // First, draw grid.
    drawGrid();

    // Next, draw labels.
    var colLabel = matrixView.selectAll('.colLabel')
        .data(colOrder, String);
    colLabel.enter().append('svg:text')
        .attr('class', 'colLabel')
        .text(function(d) { return state.colList[d]; })
        //.attr('x', function(d) { return state.x(state.currColOrder.indexOf(d)); })
        .attr('x', function(d) { return state.x(state.oldColOrder.indexOf(d)); })
        .attr('y', mvNS.colLabelHeight)
        .attr("text-anchor", "left")
        .attr('transform', function(d) { return 'rotate(-60 ' + state.x(state.currColOrder.indexOf(d)) + ' ' + mvNS.colLabelHeight + ')'; })
        .attr('cursor', 'pointer')
        .on('mouseover', function(d) {
            brushCol(d);
        })
        .on('mouseout', function(d) {
            unbrushCol(d);
        })
        .on('contextmenu', function(d) {
            selectCol(d);
            event.preventDefault();
            $mc = $('#main_content'); // This is the bounding box of the matrixView
            $ccm = $('#colContextMenu'); // This is the floating div with the context menu
            var cmX = event.pageX + $ccm.width() > $mc.offset().left + $mc.width() ?
                        event.pageX - $ccm.width():
                        event.pageX;
            var cmY = event.pageY + $ccm.height() > $mc.offset().top + $mc.height() ?
                        event.pageY - $ccm.height() :
                        event.pageY;
            d3.select('#colContextMenu')
                .style('top', cmY+'px')
                .style('left', cmX+'px');
            //$ccm.dropdown('toggle');
            $ccm.show();
        })
        .on('click', function(d) {
            toggleColSelect(d);
        })
        .on('dblclick', function(d) { sortRowsBy([d]); })
        .call(d3.behavior.drag()
            .on('dragstart', function(d) {
                // If I want to do any sort of highlighting of the dragged thing, probably do it here.
            })
            .on('drag', function(d) {
                var newX = Math.max(state.x(-1), Math.min(state.x(state.colList.length), d3.event.x));
                d3.select(this)
                    .attr('x', newX)
                    .attr('transform', function() { return 'rotate(-60 ' + newX + ' ' + mvNS.colLabelHeight + ')'; });
            })
            .on('dragend', function(d) {
                // Undo any highlighting here.

                // Find closest position to where the col is dropped and stick it there in the order.
                var newX = d3.select(this).attr('x');
                var newI = getColIndexByX(newX);
                var oldI = state.currColOrder.indexOf(d);
                if (newI < oldI) {
                    state.currColOrder.splice(newI, 0, state.currColOrder.splice(oldI, 1)[0]);
                    $('#topicSortSelect').val('');
                } else if (newI > oldI) {
                    state.currColOrder.splice(newI, 0, state.currColOrder[oldI]);
                    state.currColOrder.splice(oldI, 1);
                    $('#topicSortSelect').val('');
                }
                repositionData();
                repositionLabels();
            })
        );
    colLabel.transition()
        .duration(transdur)
        .attr('x', function(d) { return state.x(state.currColOrder.indexOf(d)); })
        .attr('transform', function(d) { return 'rotate(-60 ' + state.x(state.currColOrder.indexOf(d)) + ' ' + mvNS.colLabelHeight + ')'; });
    colLabel.exit().remove();

    var rowLabel = matrixView.selectAll('.rowLabel')
        .data(rowOrder, String)
    rowLabel.enter().append('svg:text')
        .attr('class', 'rowLabel')
        .text(function(d) { return state.rowList[d] == '' ? '[EMPTY FIELD]' : state.rowList[d]; })
        .attr('x', mvNS.rowLabelWidth)
        //.attr('y', function(d) { return state.y(rowOrder.indexOf(d)); })
        .attr('y', function(d) { return state.y(state.oldRowOrder.indexOf(d)); })
        .attr("text-anchor", "end")
        .attr('cursor', 'pointer')
        .on('mouseover', function(d) {
            brushRow(d);
            if (d3.select('#metadataTooltipCheckbox').filter(':checked')[0].length === 1) {
                d3.select('#metadataTooltip')
                    .html(getMetadataString(d))
                    .style('visibility', 'visible')
                    .style('top', event.pageY+'px')
                    .style('left', (event.pageX + 5) + 'px');
            }
        })
        .on('mouseout', function(d) {
            unbrushRow(d);
            d3.select('#metadataTooltip')
                .style('visibility', 'hidden')
                .html('');
        })
        .on('contextmenu', function(d) {
            selectRow(d);
            event.preventDefault();
            $mc = $('#main_content'); // This is the bounding box of the matrixView
            $rcm = $('#rowContextMenu'); // This is the floating div with the context menu
            var cmX = event.pageX + $rcm.width() > $mc.offset().left + $mc.width() ?
                        event.pageX - $rcm.width():
                        event.pageX;
            var cmY = event.pageY + $rcm.height() > $mc.offset().top + $mc.height() ?
                        event.pageY - $rcm.height() :
                        event.pageY;
            d3.select('#rowContextMenu')
                .style('top', cmY+'px')
                .style('left', cmX+'px');
            //$rcm.dropdown('toggle');
            $rcm.show();
        })
        .on('click', function(d) {
            toggleRowSelect(d);
        })
        .on('dblclick', function(d) { sortColsBy([d]); })
        .call(d3.behavior.drag()
            .on('dragstart', function(d) {
                // If I want to do any sort of highlighting of the dragged thing, probably do it here.
            })
            .on('drag', function(d) {
                var newY = Math.max(state.y(-1), Math.min(state.y(state.rowList.length), d3.event.y)); //TODO - aggList?
                d3.select(this)
                    .attr('y', newY);
            })
            .on('dragend', function(d) {
                // Undo any highlighting here.

                // Find closest position to where the row is dropped and stick it there in the order.
                var newY = d3.select(this).attr('y');
                var newI = getRowIndexByY(newY);
                var oldI = rowOrder.indexOf(d);
                if (newI < oldI) {
                    rowOrder.splice(newI, 0, rowOrder.splice(oldI, 1)[0]);
                    $('#sortSelect').val('None');
                } else if (newI > oldI) {
                    rowOrder.splice(newI, 0, rowOrder[oldI]);
                    rowOrder.splice(oldI, 1);
                    $('#sortSelect').val('None');
                }
                repositionData();
                repositionLabels();
            })
        );
    rowLabel.transition()
        .duration(transdur)
        .attr('x', mvNS.rowLabelWidth)
        .attr('y', function(d) { return state.y(rowOrder.indexOf(d)); });
    rowLabel.exit().remove();

    var rowHighlightBar = matrixView.selectAll('.rowHighlightBar')
        .data(rowOrder, String);
    rowHighlightBar.enter().append('svg:rect')
        .attr('class', 'rowHighlightBar catColor')
        .attr('x', state.x(-1))
        .attr('width', state.x.range()[1] - state.x.range()[0])
        .attr('y', function(d) { return state.y(d) - mvNS.highlightBarHeight/2; })
        .attr('height', mvNS.highlightBarHeight)
        .style('fill', function(d) { return state.rowColors[d]; })
        .style('fill-opacity', function(d) { return state.rowsColored.indexOf(d) !== -1 ? mvNS.minFill : 0; })
        .on('mouseover', function(d) {
            brushRow(d);
        })
        .on('mouseout', function(d) {
            unbrushRow(d);
        })
        .on('click', function(d) {
            toggleRowSelect(d);
        });
    rowHighlightBar.transition()
        .duration(transdur)
        .attr('x', state.x(-1))
        .attr('y', function(d) { return state.y(rowOrder.indexOf(d)) - mvNS.highlightBarHeight/2; })
        .attr('width', state.x(state.currColOrder.length) - state.x.range()[0])
        .attr('height', mvNS.highlightBarHeight);
    rowHighlightBar.exit().remove();

    var colHighlightBar = matrixView.selectAll('.colHighlightBar')
        .data(colOrder, String);
    colHighlightBar.enter().append('svg:rect')
        .attr('class', 'colHighlightBar catColor')
        .attr('y', state.y(-1))
        .attr('height', state.y.range()[1] - state.y.range()[0])
        .attr('x', function(d) { return state.x(d) - mvNS.highlightBarHeight/2; })
        .attr('width', mvNS.highlightBarHeight)
        .style('fill', function(d) { return state.colColors[d]; })
        .style('fill-opacity', function(d) { return state.colsColored.indexOf(d) !== -1 ? mvNS.minFill : 0; })
        .on('mouseover', function(d) {
            brushCol(d);
        })
        .on('mouseout', function(d) {
            unbrushCol(d);
        })
        .on('click', function(d) {
            toggleColSelect(d);
        });
    colHighlightBar.transition()
        .duration(transdur)
        .attr('x', function(d) { return state.x(state.currColOrder.indexOf(d)) - mvNS.highlightBarHeight/2; })
        .attr('y', state.y(-1))
        .attr('width', mvNS.highlightBarHeight)
        .attr('height', state.y(rowOrder.length) - state.y.range()[0]);
    colHighlightBar.exit().remove();

    // Finally, draw circles.
    var innerShapes = matrixView.selectAll('.innerShape')
        .data(dataToUse, function(d) { return d.row + ',' + d.col; });
    innerShapes.enter().append('svg:circle')
        .attr('class','innerShape')
        //.attr('r', 0)
        .attr('r', getR)
        //.attr('cx', getCircleX)
        //.attr('cy', getCircleY)
        .attr('cx', function(d) {
            return state.x(state.oldColOrder.indexOf(d.col));
        })
        .attr('cy', function(d) {
            return state.y(state.oldRowOrder.indexOf(d.row));
        })
        .style('stroke', 'black')
        .style('fill-opacity', .6)
        .style('fill', function(d) { return state.rowColors[d.row]; })// TODO: in future, make this apply to columns, too
        .on('mouseover', function(d) {
            brushRow(d.row);
            brushCol(d.col);
            showTooltip(d.prop);
        })
        .on('mouseout', function(d) {
            unbrushRow(d.row);
            unbrushCol(d.col);
            hideTooltip();
        })
        .on('click', function(d) {
            selectRow(d.row);
            selectCol(d.col);
        })
        // TODO: for some reason, having back to back transitions is breaking the data input...
        /*.transition()
        .duration(transdur)
        .attr('r', getR)*/
    innerShapes.transition()
        .duration(transdur)
        .attr('cx', getCircleX)
        .attr('cy', getCircleY);
    innerShapes.exit()
        .transition()
        .duration(transdur / 5.0)
        .attr('r', 0)
        .remove();
    // Move aggregate quantile glyphs if needed
    var qShapes = matrixView.selectAll('.qShape')
        .transition()
        .duration(transdur)
        .attr('cx', getCircleX)
        .attr('cy', getCircleY);


    // Set drag-select behavior
    var dragStart, selectingRows, selectLocked;
    var dragging = false;
    var getNewBox = function(p) {
        var change = {
            x: p[0] - dragStart.x,
            y: p[1] - dragStart.y
        };
        return {
            x: change.x < 0 ? p[0] : dragStart.x,
            y: change.y < 0 ? p[1] : dragStart.y,
            w: selectingRows ? (change.x < 0 ? -1*change.x : Math.min(change.x, state.x(-1) - dragStart.x))
                             : Math.abs(change.x),
            h: selectingRows ? Math.abs(change.y)
                             : (change.y < 0 ? -1*change.y : Math.min(change.y, state.y(-1) - dragStart.y))
        };
    };
    matrixView
        .on('mousedown', function() {
            event.preventDefault();
            $('.contextmenu').hide();
            var p = d3.mouse(this);
            if (!(p[0] > state.x(-1) && p[1] > state.y(-1))) {
                dragging = true;
                dragStart = {
                    x: p[0],
                    y: p[1]
                }
                matrixView.append('rect')
                    .attr('class','selection')
                    .attr('x',p[0])
                    .attr('y',p[1])
                    .attr('width',0)
                    .attr('height',0)
                    .style('fill','transparent')
                    .style('stroke','gray');

                // This bit keeps the drag-box from overflowing into the matrix
                if (p[0] < state.x(-1)) {
                    if (p[1] < state.y(-1)) {
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
                var box = matrixView.select('rect.selection');
                var p = d3.mouse(this);

                // More work to keep drag-box from overflowing into the matrix
                if (!selectLocked) {
                    if (p[0] < state.x(-1) && p[1] > state.y(-1)) {
                        selectingRows = true;
                    } else if (p[0] > state.x(-1) && p[1] < state.y(-1)) {
                        selectingRows = false;
                    }
                }

                var newBox = getNewBox(p);
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
                var newBox = getNewBox(p);
                var lowIndex, highIndex;
                if (selectingRows === true) {
                    lowIndex = Math.max(0, Math.ceil(state.y.invert(newBox.y)));
                    highIndex = Math.ceil(state.y.invert(newBox.y + newBox.h));
                    state.selectedRows = state.currRowOrder.slice(lowIndex, highIndex);
                    updateRowSelectDiv();
                } else if (selectingRows === false) {
                    lowIndex = Math.max(0, Math.ceil(state.x.invert(newBox.x)));
                    highIndex = Math.ceil(state.x.invert(newBox.x + newBox.w));
                    state.selectedCols = state.currColOrder.slice(lowIndex, highIndex);
                    updateColSelectDiv();
                } else {
                    state.selectedRows = [];
                    updateRowSelectDiv();
                    state.selectedCols = [];
                    updateColSelectDiv();
                }

                matrixView.selectAll('rect.selection').remove();
                selectingRows = null;
                dragging = false;
            }
        })
        .on('contextmenu', function() {
            event.preventDefault();
        });

    $main_content.removeClass("withLoadingIndicator");

    state.oldRowOrder = state.currRowOrder.slice();
    state.oldColOrder = state.currColOrder.slice();
};

var drawGrid = function() {
    var rowOrder, colOrder;
    if (typeof(state.groupData) === 'undefined') {
        rowOrder = typeof(state.aggregatingBy) === 'undefined' ? state.currRowOrder : state.currAggOrder;
    } else {
        rowOrder = state.groupRowOrder;
    }
    rowOrder = rowOrder.slice(0, MATRIX_Y_LIMIT);
    colOrder = state.currColOrder.slice(0, MATRIX_X_LIMIT);

    // First, draw edges.
    var xLineEdge = matrixView.selectAll('.xLineEdge')
        .data([-1, state.x.domain()[1]]);
    xLineEdge.enter().append('svg:line')
        .attr('class', 'xLineEdge')
        .attr('stroke', gridcolor)
        .attr('stroke-width', gridWidth)
        .attr('x1', function(d) { return state.x(d); })
        .attr('y1', state.y(-1))
        .attr('x2', function(d) { return state.x(d); })
        .attr('y2', state.y(rowOrder.length));
    xLineEdge.transition()
        .duration(transdur)
        .attr('x1', function(d) { return state.x(d); })
        .attr('y1', state.y(-1))
        .attr('x2', function(d) { return state.x(d); })
        .attr('y2', state.y(rowOrder.length));
    var yLineEdge = matrixView.selectAll('.yLineEdge')
        .data([-1, state.y.domain()[1]])
    yLineEdge.enter().append('svg:line')
        .attr('class', 'yLineEdge')
        .attr('stroke', gridcolor)
        .attr('stroke-width', gridWidth)
        .attr('x1', state.x(-1))
        .attr('y1', function(d) { return state.y(d); })
        .attr('x2', state.x(state.currColOrder.length))
        .attr('y2', function(d) { return state.y(d); });
    yLineEdge.transition()
        .duration(transdur)
        .attr('x1', state.x(-1))
        .attr('y1', function(d) { return state.y(d); })
        .attr('x2', state.x(state.currColOrder.length))
        .attr('y2', function(d) { return state.y(d); });

    // Then draw the inner lines.
    var xLine = matrixView.selectAll('.xLine')
        .data(colOrder, String);
    xLine.enter().append('svg:line')
        .attr('class', 'xLine')
        .attr('stroke', gridcolor)
        .attr('stroke-width', gridWidth)
        .attr('x1', function(d) {return state.x(state.currColOrder.indexOf(d)); })
        .attr('y1', state.y(-1))
        .attr('x2', function(d) {return state.x(state.currColOrder.indexOf(d)); })
        .attr('y2', state.y(rowOrder.length));
    xLine.transition()
        .duration(transdur)
        .attr('x1', function(d) {return state.x(state.currColOrder.indexOf(d)); })
        .attr('y1', state.y(-1))
        .attr('x2', function(d) {return state.x(state.currColOrder.indexOf(d)); })
        .attr('y2', state.y(rowOrder.length));
    xLine.exit().remove();

    var yLine = matrixView.selectAll('.yLine')
        .data(rowOrder, String);
    yLine.enter().append('svg:line')
        .attr('class', 'yLine')
        .attr('stroke', gridcolor)
        .attr('stroke-width', gridWidth)
        .attr('x1', state.x(-1))
        .attr('y1', function(d) { return state.y(rowOrder.indexOf(d)); })
        .attr('x2', state.x(state.currColOrder.length))
        .attr('y2', function(d) { return state.y(rowOrder.indexOf(d)); });
    yLine.transition()
        .duration(transdur)
        .attr('x1', state.x(-1))
        .attr('y1', function(d) { return state.y(rowOrder.indexOf(d)); })
        .attr('x2', state.x(state.currColOrder.length))
        .attr('y2', function(d) { return state.y(rowOrder.indexOf(d)); });
    yLine.exit().remove();
};

var getColIndexByX = function(xPos) {
    var index = Math.round(state.x.invert(xPos));
    return index < 0 ? 0 : (index >= state.colList.length ? state.colList.length - 1 : index);
};

// TODO: does this break with openGroup?
var getRowIndexByY = function(yPos) {
    var index = Math.round(state.y.invert(yPos));
    if (typeof(state.aggregatingBy) === 'undefined') {
        return index < 0 ? 0 : (index >= state.rowList.length ? state.rowList.length - 1 : index);
    } else {
        return index < 0 ? 0 : (index >= state.aggList.length ? state.aggList.length - 1 : index);
    }
};

var getR = function(datum) {
    var baseR = Math.sqrt(mvNS.areaScale(Math.abs(datum.prop)));
    return typeof(state.aggregatingBy) === 'undefined' ? baseR : aggSizeFactor*baseR;
};

var getCircleX = function(datum) {
    return state.x(state.currColOrder.indexOf(datum.col));
};

var getCircleY = function(datum) {
    if (typeof(state.groupData) === 'undefined') {
        if (typeof(state.aggregatingBy) === 'undefined') {
            return state.y(state.currRowOrder.indexOf(datum.row));
        } else {
            return state.y(state.currAggOrder.indexOf(datum.row));
        }
    } else {
        return state.y(state.groupRowOrder.indexOf(datum.row));
    }
};

/************************ CROSS VIEWS ***********************************/

// When brushing col, also brush the rowView
var brushCol = function(colNum) {
    matrixView.selectAll('.innerShape').select(function (d) { return d.col == colNum ? this : null; })
        .style('stroke-width', 2);
    matrixView.selectAll('.colLabel').select(function (d) { return d == colNum ? this : null; })
        .style('font-weight', 'bold');
    d3.selectAll('.topic_model_line_graph g.topic_' + colNum).classed('highlight-red',true);
    d3.selectAll('.topic_model_line_graph g.topic_' + colNum).classed('active',true);
    d3.selectAll('.tLabel').select(function(d) { return parseInt(d) == colNum ? this : null; })
        .style('font-weight', 'bold');
};

var unbrushCol = function(colNum) {
    matrixView.selectAll('.innerShape').select(function (d) { return d.col == colNum ? this : null; })
        .style('stroke-width', 1);
    matrixView.selectAll('.colLabel').select(function (d) { return d == colNum ? this : null; })
        .style('font-weight', 'normal');
    d3.selectAll('.topic_model_line_graph g.topic_' + colNum).classed('highlight-red',false);
    d3.selectAll('.topic_model_line_graph g.topic_' + colNum).classed('active',false);
    d3.selectAll('.tLabel').select(function(d) { return parseInt(d) == colNum ? this : null; })
        .style('font-weight', 'normal');
};

// When brushing row, also brush _____
var brushRow = function(rowNum) {
    matrixView.selectAll('.innerShape').select(function (d) { return d.row == rowNum ? this : null; })
        .style('stroke-width', 2);
    matrixView.selectAll('.rowLabel').select(function (d) { return d == rowNum ? this : null; })
        .style('font-weight', 'bold');
};

var unbrushRow = function(rowNum) {
    matrixView.selectAll('.innerShape').select(function (d) { return d.row == rowNum ? this : null; })
        .style('stroke-width', 1);
    matrixView.selectAll('.rowLabel').select(function (d) { return d == rowNum ? this : null; })
        .style('font-weight', 'normal');
};

var toggleColSelect = function(colNum) {
    selectCol(colNum);
    var colIndex = state.selectedCols.indexOf(colNum);
    if (colIndex === -1) {
        state.selectedCols.push(colNum);
    } else {
        state.selectedCols.splice(colIndex, 1);
    }
    updateColSelectDiv();
};

var updateColSelectDiv = function() {
    if (typeof(state.selectedCols) === 'undefined') {
        state.selectedCols = [];
    }
    if (state.selectedCols.length === 0) {
        d3.select('#selectedCols').html('No topics selected');
    } else {
        state.selectedCols.sort();
        var selectedColsList = d3.select('#selectedCols').html('');
        for (var i = 0; i < state.selectedCols.length; i++) {
            selectedColsList.append('a')
                .attr('class', 'selectedColLink')
                .attr('colNum', state.selectedCols[i])
                .style('cursor', 'pointer')
                .text(state.colList[state.selectedCols[i]]);
            selectedColsList.append('br');
        }
        d3.selectAll('.selectedColLink')
            .on('click', function() {
                selectCol(parseInt(d3.select(this).attr('colNum')));
            });
    }
    d3.selectAll('.colLabel')
        .style('fill', function(d) { return state.selectedCols.indexOf(d) === -1 ? 'black' : 'red'; });
};

var selectCol = function(colNum) {
    if (state.selectedCol != colNum) {
        localStorage[model_name + '_topic'] = colNum;
        state.selectedCol = colNum;
        renderTopicView(colNum);
    }
};

var unselectCol = function() {
    state.selectedCol = undefined;
    d3.select('#selectedTopicNum').html('');
    d3.select('#topicMetadataTab').html('No topic selected.');
    d3.select('#topicView').html('No topic selected.');
};

var toggleRowSelect = function(rowNum) {
    selectRow(rowNum);
    var rowIndex = state.selectedRows.indexOf(rowNum);
    if (rowIndex === -1) {
        state.selectedRows.push(rowNum);
    } else {
        state.selectedRows.splice(rowIndex, 1);
    }
    updateRowSelectDiv();
};

var updateRowSelectDiv = function() {
    if (typeof(state.selectedRows) === 'undefined') {
        state.selectedRows = [];
    }
    if (state.selectedRows.length === 0) {
        d3.select('#selectedRows').html('No documents selected');
    } else {
        state.selectedRows.sort();
        var selectedRowsList = d3.select('#selectedRows').html('');
        for (var i = 0; i < state.selectedRows.length; i++) {
            selectedRowsList.append('a')
                .attr('class', 'selectedRowLink')
                .attr('rowNum', state.selectedRows[i])
                .style('cursor', 'pointer')
                .text(state.rowList[state.selectedRows[i]]);
            selectedRowsList.append('br');
        }
        d3.selectAll('.selectedRowLink')
            .on('click', function() {
                selectRow(parseInt(d3.select(this).attr('rowNum')));
            });
    }
    d3.selectAll('.rowLabel')
        .style('fill', function(d) { return state.selectedRows.indexOf(d) === -1 ? 'black' : 'red'; });
};

var selectRow = function(rowNum) {
    if (state.selectedRow !== rowNum) {
        state.selectedRow = rowNum;
        renderDocView(rowNum);
    }
};

var unselectRow = function() {
    state.selectedRow = undefined;
    d3.select('#selectedDocNum').html('');
    d3.select('#docMetadataTab').html('No document selected.');
    d3.select('#aggregateListTab').html('No documents selected.');
    d3.select('#docTopicLayoutTab').html('No document selected.');
    d3.select('#topicCountsTab').html('No document selected.');
};

/************************************* SIDE BAR VIEWS ********************************************/
    // TODO: Make this look pretty and generate sizes dynamically
var renderTopicView = function(topicNum) {
    d3.select('#selectedTopicNum').html(topicNum);
    d3.select('#topicViewTitle')
        .on('dblclick', function() {
            $('#renameTopicModal').modal();
            $('#newTopicName').focus();
        })
        .on('mouseover', function() {
            brushCol(topicNum);
        })
        .on('mouseout', function() {
            unbrushCol(topicNum);
        });
    $('#topicViewTitle')
        .css('cursor','default')
        .css('user-select','none');
    var metadataStr = '';
    for (var fieldName in state.topicMetadata[topicNum]) {
        metadataStr += fieldName + ': ' + state.topicMetadata[topicNum][fieldName] + '<br />'
    }
    d3.select('#topicMetadataTab')
        .html('<h4>' + state.colList[topicNum] + '</h4>' + metadataStr);

    // Build tag representations in separate tabs using the TagRepresentations code
    //var buildTagRep = function(model_name, tag_name, tag_color, modelType, repType, repScope, svgContainerID, paramsObj)
    var boundRect = d3.select('#right_sidebar_top_content').node().getBoundingClientRect();
    buildTagRep(
        model_name,
        'topic_' + topicNum, 
        state.colsColored.indexOf(topicNum) === -1 ? undefined : state.colColors[topicNum],
        'topic',
        'bar',
        'corpus',
        '#topicView',
        {
            'ranking_type': state.rankingType
        }
    );
    buildTagRep(
        model_name,
        'topic_' + topicNum,
        state.colsColored.indexOf(topicNum) === -1 ? undefined : state.colColors[topicNum],
        'topic',
        'cloud',
        'corpus',
        '#topicCloudView',
        {
            'ranking_type': state.rankingType,
            'size': [Math.floor(.95*boundRect.width), Math.floor(.95*boundRect.height)]
        }
    );
};

var renderDocView = function(docNum) {
    var i;
    if (typeof(docNum) !== 'undefined') {
        d3.select('#selectedDocNum').html(docNum);

        d3.select('#docViewTitle')
            .on('mouseover', function() {
                brushRow(docNum);
            })
            .on('mouseout', function() {
                unbrushRow(docNum);
            });
        $('#docViewTitle')
            .css('cursor','default')
            .css('user-select','none');

        var thetaD = typeof(state.aggregatingBy) === 'undefined' ? state.theta[docNum] : state.aggTheta[docNum];
        var thetaDtopics = new Array(thetaD.length);
        var thetaDpercs = new Array(thetaD.length);
        i = 0;
        for (var topic in thetaD) {
            thetaDtopics[i] = topic;
            thetaDpercs[i] = thetaD[topic];
            i++;
        }

        thetaDtopics.sort(function(a,b) { return thetaD[b] - thetaD[a]; });
        thetaDpercs.sort(function(a,b) { return b - a; });

        var $docContainer = $('#right_sidebar_bottom_content');
        dvNS.w = $docContainer.width()-30;
        dvNS.h = $docContainer.height();

        var numTopics = thetaDtopics.length;
        if (dvNS.w < numTopics*dvNS.minBarWidth + (numTopics+1)*dvNS.barBuffer) {
            dvNS.barWidth = dvNS.minBarWidth;
        } else {
            dvNS.barWidth = Math.floor((dvNS.w - dvNS.barBuffer)/numTopics);
        }
        dvNS.xScale = d3.scale.linear()
            .domain([0, numTopics-1])
            .range([dvNS.barBuffer, (numTopics-1)*(dvNS.barBuffer + dvNS.barWidth)]);
        dvNS.yScale = d3.scale.linear()
            .domain([0,1])
            .range([0, dvNS.h - 2*dvNS.chartBuffer - dvNS.labelBuffer]);

        // Topic Counts tab - works the same for aggregating and not // TODO: clean this up, make it prettier
        var topicCountsTab = d3.select('#topicCountsTab')
            .html('')
            .append('svg:svg')
            .attr('width', dvNS.w)
            .attr('height', dvNS.h)
            .data([thetaDpercs]);

        var tLabels = topicCountsTab.selectAll('.tLabel')
            .data(thetaDtopics)
            .enter().append('svg:text')
            .attr('class', 'tLabel')
            .text(function(d) { return d; })
            .attr('x', function(d,i) { return dvNS.xScale(i) + .5*dvNS.barWidth; })
            .attr('y', dvNS.h - dvNS.labelBuffer + dvNS.barBuffer)
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'hanging')
            .on('click', function(d) {
                selectCol(d)
            });

        var tBars = topicCountsTab.selectAll('.tBar')
            .data(thetaDpercs)
            .enter().append('svg:rect')
            .attr('class', 'tBar')
            .attr('topic', function(d, i) { return thetaDtopics[i]; })
            .attr('x', function(d, i) { return dvNS.xScale(i)/* - .5*dvNS.barWidth*/; })
            .attr('y', function(d) { return dvNS.h - dvNS.labelBuffer - dvNS.yScale(d); })
            .attr('width', dvNS.barWidth)
            .attr('height', function(d) { return dvNS.yScale(d); })
            .style('stroke', dvNS.barBorder)
            .style('fill', function(d, i) { return state.colColors[thetaDtopics[i]]; })
            .style('fill-opacity', dvNS.barFillOpacity)
            .on('click', function(d, i) {
                selectCol(thetaDtopics[i]);
            })
            .on('mouseover', function(d, i) {
                brushCol(thetaDtopics[i]);
            })
            .on('mouseout', function(d, i) {
                unbrushCol(thetaDtopics[i]);
            });

        var pLabels = topicCountsTab.selectAll('.pLabel')
            .data(thetaDpercs)
            .enter().append('svg:text')
            .attr('class', 'pLabel')
            .text(function(d) { return d < .01 ? '<1%' : Math.floor(d*100).toString() + '%' })
            .attr('x', function(d,i) { return dvNS.xScale(i) + .5*dvNS.barWidth; })
            .attr('y', function(d) { return dvNS.h - dvNS.labelBuffer - dvNS.yScale(d) - 5; })
            .attr('text-anchor', 'middle');

        // If we're aggregating, do aggregateListTab and make the label open group
        if (typeof(state.aggregatingBy) !== 'undefined') {
            d3.select('#docViewTitle')
                .on('dblclick', function() {
                    openGroup(docNum);
                });

            // TODO: make this aggregate list way more informative
            var aggBtnGrp = d3.select('#aggregateListTab')
                .html('')
                .append('div')
                .attr('class', 'btn-group btn-group-vertical');
            for (i = 0; i < state.aggregates[docNum].length; i++) {
                aggBtnGrp.append('button')
                    .attr('class', 'btn')
                    .attr('docNum', state.aggregates[docNum][i])
                    .text(state.rowList[state.aggregates[docNum][i]])
                    .on('click', function() {
                        var docNum = parseInt(d3.select(this).attr('docNum'));
                        openDocInTextViewer(docNum);
                    });
            }
        }
        // If we're not aggregating, do metadata tab and topic layout tab
        else {
            d3.select('#docViewTitle')
                .on('dblclick', function() {
                    openDocInTextViewer(docNum);
                });

            // Metadata tab
            var docMetadataTab = d3.select('#docMetadataTab')
                .html('<h4>' + state.rowList[docNum] + '</h4>' + '<p>' + getMetadataString(docNum) + '</p>');

            // Topic Layout tab
            var tokensURL = flask_util.url_for('tv_get_tokens_json', {
                'model_name': model_name,
                'text_name': getFilename(docNum)
            });
            if (tokensURL !== '') {
                $("#docTopicLayoutTab")
                    .html('')
                    .addClass("withLoadingIndicator");

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
                                var rsbc = $('#right_sidebar_bottom_content');
                                buildLineGraph(
                                    e.data.tagLines, e.data.maxWindow, e.data.numWindows,
                                    '#docTopicLayoutTab', false, {
                                        'click': function(d) {
                                            selectCol(parseInt(d.tagName.split('_')[1]));
                                        },
                                        'mouseover': function(d) {
                                            brushCol(parseInt(d.tagName.split('_')[1]));
                                        },
                                        'mouseout': function(d) {
                                            unbrushCol(parseInt(d.tagName.split('_')[1]));
                                        }
                                    },
                                    rsbc.width(), rsbc.height());
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
                d3.select('#docTopicLayoutTab').html('Line graph not yet implemented.');
            }
        }
    }
};

var getMetadataString = function(docNum) {
    var m = state.metadata[docNum];
    var s = '';
    if ('Title' in m) {
        s += 'Title: ' + m['Title'] + '<br />';
    }
    if ('Author' in m) {
        s += 'Author: ' + m['Author'] + '<br />';
    }
    if ('Genre' in m) {
        s += 'Genre: ' + m['Genre'] + '<br />';
    }
    for (var field in m) {
        if (field !== 'Author' && field !== 'Title' && field !== 'Genre') {
            s += field + ': ' + m[field] + '<br />';
        }
    }
    return s == '' ? 'No metadata available' : s;
};

var getFilename = function(docNum) {
    var textName = state.metadata[docNum].filename.split('/').pop();
    if (textName.indexOf('.txt') !== -1) {
        textName = textName.substring(0, textName.indexOf('.txt'));
    }
    return textName;
};

var openDocInTextViewer = function(docNum) {
    window.open(flask_util.url_for('tv_view_by_name',
        { model_name: model_name,
            text_name: getFilename(docNum)
        }));
};

var openDocsInMesoViewer = function(docList) {
    var text_names = new Array(docList.length);
    for (var i = 0; i < docList.length; i++) {
        text_names[i] = getFilename(docList[i]);
    }
    window.open(flask_util.url_for("cv_mesoview",
        { model_name: model_name,
          included_text_names: text_names
        }));
};


/********************************* INITIALIZATION ******************************************/

initialize();
fetchTheta();

/********************************* Cross-browser tabs *************************************/
localStorage[model_name] = "";
window.addEventListener('storage', function() {
    updateLineGraphCSS();
    var i, topic;
    if (event.key === model_name) {
        var oldTopicAssignments = event.oldValue.split(';');
        var oldTopicColorObj = {};
        var temp;
        for (i = 0; i < oldTopicAssignments.length; i++) {
            if (oldTopicAssignments[i] != '') {
                temp = oldTopicAssignments[i].split(':');
                oldTopicColorObj[parseInt(temp[0].split('_')[1])] = temp[1];
            }
        }
        var newTopicAssignments = event.newValue.split(';');
        var newTopicColorObj = {};
        for (i = 0; i < newTopicAssignments.length; i++) {
            if (newTopicAssignments[i] != '') {
                temp = newTopicAssignments[i].split(':');
                newTopicColorObj[parseInt(temp[0].split('_')[1])] = temp[1];
            }
        }

        for (topic in oldTopicColorObj) {
            if (! (topic in newTopicColorObj)) {
                uncolorCols([parseInt(topic)]);
            }
        }
        for (topic in newTopicColorObj) {
            if (! (topic in oldTopicColorObj) || newTopicColorObj[topic] !== oldTopicColorObj[topic]) {
                colorCols([parseInt(topic)], newTopicColorObj[topic]);
            }
        }
    } else if (event.key === model_name + '_topic') {
        var topicNum = parseInt(event.newValue);
        if (topicNum >= 0 && topicNum < state.colList.length) {
            selectCol(topicNum);
        }
    }
}, false);