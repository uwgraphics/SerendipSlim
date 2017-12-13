/**
 * Created by ealexand on 8/23/2016.
 */

var cv_colView = (function() {
    
    // Pointers giving access to the relevant other pieces of code, and the DOM
    var model;
    var controller;
    var htmlIDs;
    
    var currCol;
    
    var init = function(m, c, ids) {
        model = m;
        controller = c;
        htmlIDs = ids;
    };
    
    var selectCol = function(col, forceRedraw) {
        // If this col is already selected, shouldn't need to do anything
        if (col === currCol && !forceRedraw) {
            return;
        } else {
            currCol = col;
        }

        // Update the selected col
        d3.select('#' + htmlIDs['selectedCol']).html(col);
        
        // Update title functionality
        d3.select('#' + htmlIDs['titleDiv'])
            .style('cursor', 'pointer')
            .style('user-select', 'none')
            .on('click', function() {
                $('#' + htmlIDs['renameModal']).modal();
                $('#' + htmlIDs['renameInput']).focus();
            })
            .on('mouseover', function() {
                controller.brushCol(col);
            })
            .on('mouseout', function() {
                controller.unbrushCol(col);
            });
        
        // Build the subviews
        buildColMeta(col);
        buildBarRep(col);
        buildCloudRep(col);
    };

    // Build metadata view (currently just text)
    var buildColMeta = function(col) {
        var metadataStr = '';
        var colMeta = model.getColMetaAsObj(col);
        for (var fieldName in colMeta) {
            metadataStr += fieldName + ': ' + colMeta[fieldName] + '<br />';
        }
        d3.select('#' + htmlIDs['metadataContainer'])
            .html('<h4>' + model.getColName(col) + '</h4>' + metadataStr);
    };

    // Build bar graph representation of column (uses Representations.js)
    // TODO: very topic model specific right now
    var buildBarRep = function(col) {
        // Signature from Representations.js:
        // buildTagRep(model_name, tag_name, tag_color, modelType, repType, repScope, svgContainerID, paramsObj)
        buildTagRep(
            model_name,
            'topic_' + col,
            controller.getColColor(col),
            'topic',
            'bar',
            'corpus',
            '#' + htmlIDs['barRepContainer'],
            {
                'ranking_type': controller.getRankingType()
            }
        );
    };

    // Build word cloud representation of column (uses Representations.js)
    // TODO: very topic model specific right now
    var buildCloudRep = function(col) {
        // Signature from Representations.js:
        // buildTagRep(model_name, tag_name, tag_color, modelType, repType, repScope, svgContainerID, paramsObj)
        var boundRect = d3.select('#' + htmlIDs['parentContainer']).node().getBoundingClientRect();
        buildTagRep(
            model_name,
            'topic_' + col,
            controller.getColColor(col),
            'topic',
            'cloud',
            'corpus',
            '#' + htmlIDs['cloudRepContainer'],
            {
                'ranking_type': controller.getRankingType(),
                'size': [Math.floor(.95*boundRect.width), Math.floor(.95*boundRect.height)]
            }
        );
    };

    // If ranking type is changed, and there is a selected column, redraw the view
    var updateRankingType = function() {
        if (typeof(currCol) !== 'undefined') {
            selectCol(currCol, true);
        }
    };

    var colorBy = function(rowsOrCols) {
        if (typeof(currCol) !== 'undefined') {
            selectCol(currCol, true);
        }
    };

    return {
        init: init,
        updateRankingType: updateRankingType,
        selectCol: selectCol,
        colorBy: colorBy
    }
})();