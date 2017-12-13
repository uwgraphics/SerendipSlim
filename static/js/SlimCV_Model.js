/**
 * Created by ealexand on 8/15/2016.
 */

var cv_model = (function() {
    
    var theta, phi; // Variables for storing the raw distributions. Theta is indexed by row, phi is indexed by col
    var data;       // A list that stores each data point as a single object
    var rowMetadata, rowMetaTypes, rowMetaNames;
    var colMetadata, colMetaTypes, colMetaNames;
    var validMetaTypes = ['str', 'cat', 'int', 'float'];
    var rowNames, colNames;
    var rowOrder, colOrder;
    var oldRowOrder, oldColOrder;

    // These variables will be pointers to the unaggregated data so we can go back
    var unaggTheta, unaggPhi, unaggRowNames, unaggData, unaggRowOrder;
    var aggLists;

    // This function loads all of the model data from the server, including theta, metadata, etc.
    // Note: can split callbacks into separate fxns later if we want
    var loadModel = function(callbackFxn) {
        fetchTheta(function() {
            fetchMetadata(callbackFxn);
        });
    };

    // Fxn for grabbing model data from server and building other data as needed
    var fetchTheta = function(callbackFxn) {
        d3.json($THETA_URL, function(json) {
            var i;
            theta = json.theta;
            colMetadata = json.topicMetadata;
            colMetaNames = json.topicMetadataFields;

            // Populate name lists
            if (typeof json.rowList === 'undefined') {
                rowNames = new Array(json.numDocs);
                for (i = 0; i < json.numDocs; i++) {
                    rowNames[i] = 'Document ' + i;
                }
            } else {
                rowNames = json.rowList;
            }
            if (typeof json.colList === 'undefined') {
                colNames = new Array(json.numTopics);
                for (i = 0; i < json.numTopics; i++) {
                    colNames[i] = 'Topic ' + i;
                }
            } else {
                colNames = json.colList;
            }

            // Populate order lists
            rowOrder = new Array(rowNames.length);
            for (i = 0; i < rowNames.length; i++) {
                rowOrder[i] = i;
            }
            colOrder = new Array(colNames.length);
            for (i = 0; i < colNames.length; i++) {
                colOrder[i] = i;
            }
            oldOrderSnapshot();

            // Build phi (which is the same as theta, except indexed by col instead of by row
            phi = buildPhi(theta, colNames.length);

            // TODO: initialize colors? see initColors() from SlimCV.js

            // Build data points: objects of the form {row: #, col: #, prop: #}
            data = [];
            var r, c, v;
            for (r = 0; r < theta.length; r++) {
                for (c in theta[r]) {
                    v = theta[r][c];
                    data.push({'row': r, 'col': parseInt(c), 'prop': v});
                }
            }

            // Run the callback fxn after everything else has gone
            if (typeof(callbackFxn) === 'function') {
                callbackFxn();
            }
        });
    };

    // Fxn for grabbing model metadata
    var fetchMetadata = function(callbackFxn) {
        d3.json($METADATA_URL, function(json) {
            rowMetaTypes = json.dataTypes;
            rowMetaNames = json.fieldNames;
            rowMetadata = json.metadata;

            // Run the callback fxn after everything else has run
            if (typeof(callbackFxn) === 'function') {
                callbackFxn();
            }
        });
    };

    // Helper fxn for building phi, which is theta except indexed by cols rather than rows
    var buildPhi = function(theta, numCols) {
        var i;
        var phi = new Array(numCols);
        for (i = 0; i < theta.length; i++) {
            for (var col in theta[i]) {
                if (typeof phi[col] === 'undefined') {
                    phi[col] = {};
                    phi[col][i] = theta[i][col];
                }
                else {
                    phi[col][i] = theta[i][col];
                }
            }
        }
        for (i = 0; i < phi.length; i++) {
            if (typeof phi[i] === 'undefined') {
                phi[i] = {};
            }
        }
        return phi;
    };

    // TODO: implement numerical aggregation
    var aggregateRowsBy = function(fieldName, chunkSize, startingFrom) {
        // First, loop through metadata to find aggregate groups
        var aggNames = [];
        aggLists = {};
        if (typeof(chunkSize) === 'undefined') { // Categorical or String metadata has no chunkSize
            var rowNum, rowVal;
            for (rowNum = 0; rowNum < rowMetadata.length; rowNum++) {
                rowVal = rowMetadata[rowNum][fieldName];
                if (rowVal in aggLists) {
                    aggLists[rowVal].push(rowNum);
                } else {
                    aggLists[rowVal] = [rowNum];
                    aggNames.push(rowVal);
                }
            }
        } else { // If there's a chunkSize, it's for numerical metadata

        }

        // Next, build aggTheta by looping through the theta values for each agg
        var aggTheta = new Array(aggNames.length);
        var aggNum, aggName, aggList, aggVec, rowVals;
        var i, col;
        for (aggNum = 0; aggNum < aggNames.length; aggNum++) {
            aggName = aggNames[aggNum];
            aggList = aggLists[aggName];
            aggVec = {};

            // Loop through each row in the agg, and add all theta values for that row to aggVec
            for (i = 0; i < aggList.length; i++) {
                rowVals = theta[aggList[i]];
                for (col in rowVals) {
                    if (col in aggVec) {
                        aggVec[col] += rowVals[col];
                    } else {
                        aggVec[col] = rowVals[col];
                    }
                }
            }

            // Normalize aggVec
            for (col in aggVec) {
                aggVec[col] /= aggList.length;
            }

            // Finally, add it to aggTheta
            aggTheta[aggNum] = aggVec;
        }

        // Next, build aggData
        var aggData = [];
        var r, c, v;
        for (r = 0; r < aggTheta.length; r++) {
            for (c in aggTheta[r]) {
                v = aggTheta[r][c];
                aggData.push({'row': r, 'col': parseInt(c), 'prop': v});
            }
        }

        // Next, build aggPhi
        var aggPhi = buildPhi(aggTheta, colNames.length);

        // Create new rowOrder
        var aggOrder = new Array(aggNames.length);
        for (i = 0; i < aggNames.length; i++) {
            aggOrder[i] = i;
        }

        // Store all of the old model vars in unagg variables and swap in agg model vars
        unaggTheta = theta;
        unaggPhi = phi;
        unaggRowNames = rowNames;
        unaggData = data;
        unaggRowOrder = rowOrder;

        theta = aggTheta;
        phi = aggPhi;
        rowNames = aggNames;
        data = aggData;
        rowOrder = aggOrder;
    };

    var unaggregateRows = function() {
        theta = unaggTheta;
        phi = unaggPhi;
        rowNames = unaggRowNames;
        data = unaggData;
        rowOrder = unaggRowOrder;
    };

    /*************** BEGIN SORTING FXNS ******************/

    // Store snapshots of row and col orders so that we can change them and animate the change
    var oldOrderSnapshot = function() {
        oldRowOrder = rowOrder.slice();
        oldColOrder = colOrder.slice();
    };

    // Fxn that sorts rows by a selection of cols
    // TODO: add aggregation support
    var sortRowsBy = function(selection, callbackFxn) {
        if (typeof selection === 'undefined' || selection.length === 0) {
            return;
        }

        oldOrderSnapshot();

        // Sort by the combined value for each selected col
        rowOrder.sort(function(r1, r2) {
            var r1Score = 0;
            var r2Score = 0;
            var c;
            for (var i = 0; i < selection.length; i++) {
                c = selection[i];
                if (typeof(theta[r1][c]) !== 'undefined') {
                    r1Score += theta[r1][c];
                }
                if (typeof(theta[r2][c]) !== 'undefined') {
                    r2Score += theta[r2][c];
                }
            }
            return r2Score - r1Score;
        });

        if (typeof(callbackFxn) !== 'undefined') {
            callbackFxn();
        }
    };
    
    // Fxn that sorts cols by a selection of rows
    var sortColsBy = function(selection, callbackFxn) {
        if (typeof(selection) === 'undefined' || selection.length === 0) {
            return;
        }

        oldOrderSnapshot();

        // Sort by the combined value for each selected col
        colOrder.sort(function(c1, c2) {
            var c1Score = 0;
            var c2Score = 0;
            var r;
            for (var i = 0; i < selection.length; i++) {
                r = selection[i];
                if (typeof(theta[r][c1]) !== 'undefined') {
                    c1Score += theta[r][c1];
                }
                if (typeof(theta[r][c2]) !== 'undefined') {
                    c2Score += theta[r][c2];
                }
            }
            return c2Score - c1Score;
        });

        if (typeof(callbackFxn) !== 'undefined') {
            callbackFxn();
        }
    };

    // Sort rows by their distance from the MEAN vector of the given selection of rows
    var sortRowsByDistanceFrom = function(selection, callbackFxn) {
        if (typeof(selection) === 'undefined' || selection.length === 0) {
            return;
        }

        oldOrderSnapshot();

        var tmpSelection = selection.slice(); // Going to be messing with the selection, don't want to break other refs to it
        sortVectorsByDistFrom(tmpSelection, rowOrder, theta, colOrder.length);

        if (typeof(callbackFxn) !== 'undefined') {
            callbackFxn();
        }
    };

    // Sort cols by their distance from the MEAN vector of the given selection of cols
    var sortColsByDistanceFrom = function(selection, callbackFxn) {
        if (typeof(selection) === 'undefined' || selection.length === 0) {
            return;
        }

        oldOrderSnapshot();

        var tmpSelection = selection.slice(); // Going to be messing with the selection, don't want to break other refs to it
        sortVectorsByDistFrom(tmpSelection, colOrder, phi, rowOrder.length);

        if (typeof(callbackFxn) !== 'undefined') {
            callbackFxn();
        }
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
                vecObj = theta[vectorSelection[i]];
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

    // Sort rows by the size of their nth biggest col value
    var sortRowsByNth = function(n, callbackFxn) {
        var nthVals = new Array(rowOrder.length);
        for (var i = 0; i < rowOrder.length; i++) {
            nthVals[i] = getNthFromObj(n, theta[i]);
        }
        rowOrder.sort(function(a,b) {
            return nthVals[b] - nthVals[a];
        });

        if (typeof(callbackFxn) === 'function') {
            callbackFxn();
        }
    };
    // Helper fxn for sortRowsByNth - returns rowObj's nth highest col
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

    // Move given row to new index in rowOrder
    var updateRowIndex = function(row, newI, callbackFxn) {
        oldOrderSnapshot();

        var oldI = rowOrder.indexOf(row);
        if (newI < oldI) {
            rowOrder.splice(newI, 0, rowOrder.splice(oldI, 1)[0]);
        } else if (newI > oldI) {
            rowOrder.splice(newI, 0, rowOrder[oldI]);
            rowOrder.splice(oldI, 1);
        }

        if (typeof(callbackFxn) === 'function') {
            callbackFxn();
        }
    };

    // Move given col to new index in colOrder
    var updateColIndex = function(col, newI, callbackFxn) {
        oldOrderSnapshot();

        var oldI = colOrder.indexOf(col);
        if (newI < oldI) {
            colOrder.splice(newI, 0, colOrder.splice(oldI, 1)[0]);
        } else if (newI > oldI) {
            colOrder.splice(newI, 0, colOrder[oldI]);
            colOrder.splice(oldI, 1);
        }

        if (typeof(callbackFxn) === 'function') {
            callbackFxn();
        }
    };

    // Move selected rows to the beginning, maintaining relative order within selection
    var moveRowsToTop = function(selection, callbackFxn) {
        oldOrderSnapshot();

        moveSelectionToFront(selection, rowOrder);

        if (typeof(callbackFxn) === 'function') {
            callbackFxn();
        }
    };

    // Move selected rows to the beginning, maintaining relative order within selection
    var moveColsToLeft = function(selection, callbackFxn) {
        oldOrderSnapshot();

        moveSelectionToFront(selection, colOrder);

        if (typeof(callbackFxn) === 'function') {
            callbackFxn();
        }
    };

    // Helper fxn for moveRowsToTop and moveColsToLeft
    var moveSelectionToFront = function(selection, order) {
        if (typeof(selection) !== 'undefined' && selection.length !== 0) {
            var indices = new Array(selection.length);
            var i;
            for (i = 0; i < selection.length; i++) {
                indices[i] = order.indexOf(selection[i]);
            }
            indices.sort(function(a,b) { return a - b; });
            for (i = 0; i < indices.length; i++) {
                order.splice(i, 0, order.splice(indices[i], 1)[0]);
            }
        }
    };

    // Sort rows by given metadata field
    var sortRowsByMeta = function(fieldName, callbackFxn) {
        // Make sure this fieldName exists
        var fieldNum = rowMetaNames.indexOf(fieldName);
        if (fieldNum === -1) {
            return;
        }

        oldOrderSnapshot();

        var fieldType = rowMetaTypes[fieldNum];
        // Only sort if we actually know HOW to for this fieldType
        if (validMetaTypes.indexOf(fieldType) === -1) {
            return;
        }

        // Pick a comparing fxn based on the data type of the metadata field
        var fieldComparer;
        if (fieldType === 'str' || fieldType === 'cat') {
            fieldComparer = function(s1, s2) {
                s1 = s1.toLowerCase();
                s2 = s2.toLowerCase();
                if (s1 > s2) {
                    return 1;
                } else if (s2 > s1) {
                    return -1;
                }
                return 0;
            }
        } else if (fieldType === 'int') {
            fieldComparer = function(n1, n2) {
                return parseInt(n1) - parseInt(n2);
            }
        } else if (fieldType === 'float') {
            fieldComparer = function(n1, n2) {
                return parseFloat(n1) - parseFloat(n2);
            }
        }

        // Sort with the appropriate comparing fxn
        rowOrder.sort(function(r1, r2) {
            if (rowMetadata[r1].hasOwnProperty(fieldName) && rowMetadata[r1][fieldName] !== '') {
                if (rowMetadata[r2].hasOwnProperty(fieldName) && rowMetadata[r2][fieldName] !== '') {
                    return fieldComparer(rowMetadata[r1][fieldName], rowMetadata[r2][fieldName])
                } else {
                    return -1;
                }
            } else {
                if (rowMetadata[r2].hasOwnProperty(fieldName) && rowMetadata[r2][fieldName] !== '') {
                    return 1;
                } else {
                    return 0;
                }
            }
        });

        if (typeof(callbackFxn) === 'function') {
            callbackFxn();
        }
    };

    // Sort cols by given metadata field
    var sortColsByMeta = function(fieldName, callbackFxn) {
        // Make sure this fieldName exists
        var fieldNum = colMetaNames.indexOf(fieldName);
        if (fieldNum === -1) {
            return;
        }

        oldOrderSnapshot();

        // Sort in descending order, making sure the cols have values for the field
        colOrder.sort(function(c1, c2) {
            if (typeof(colMetadata[c1]) !== 'undefined' && colMetadata[c1].hasOwnProperty(fieldName) && colMetadata[c1][fieldName] !== '') {
                if (typeof(colMetadata[c2]) !== 'undefined' && colMetadata[c2].hasOwnProperty(fieldName) && colMetadata[c2][fieldName] !== '') {
                    return parseFloat(colMetadata[c2][fieldName]) - parseFloat(colMetadata[c1][fieldName]);
                } else {
                    return 1;
                }
            } else {
                if (typeof(colMetadata[c2]) !== 'undefined' && colMetadata[c2].hasOwnProperty(fieldName) && colMetadata[c2][fieldName] !== '') {
                    return -1;
                } else {
                    return 0;
                }
            }
        });

        if (typeof(callbackFxn) === 'function') {
            callbackFxn();
        }
    };

    // Change rowOrder to match specific order provided (usually by user)
    var setRowOrder = function(order, callbackFxn) {
        // First, check to make sure the provided order is valid
        if (order.length !== rowOrder.length) {
            alert('Invalid row order. Length does not match.');
            return;
        }
        var testOrder = order.slice();
        testOrder.sort(function(a, b) { return a - b; });
        for (var i = 0; i < testOrder.length; i++) {
            if (testOrder[i] !== i) {
                alert('Invalid row order. Row ' + i + ' not present.');
                return;
            }
        }

        // If so, change the order
        oldOrderSnapshot();
        rowOrder = order;

        if (typeof(callbackFxn) === 'function') {
            callbackFxn();
        }
    };

    // Change colOrder to match specific order provided (usually by user)
    var setColOrder = function(order, callbackFxn) {
        // First, check to make sure the provided order is valid
        if (order.length !== colOrder.length) {
            alert('Invalid col order. Length does not match.');
            return;
        }
        var testOrder = order.slice();
        testOrder.sort(function(a, b) { return a - b; });
        for (var i = 0; i < testOrder.length; i++) {
            if (testOrder[i] !== i) {
                alert('Invalid row order. Col ' + i + ' not present.');
                return;
            }
        }

        // If so, change the order
        oldOrderSnapshot();
        colOrder = order;

        if (typeof(callbackFxn) === 'function') {
            callbackFxn();
        }
    };

    // Reset rowOrder to be in the original order
    var resetRowOrder = function(callbackFxn) {
        oldOrderSnapshot();

        rowOrder = new Array(rowNames.length);
        for (var i = 0; i < rowNames.length; i++) {
            rowOrder[i] = i;
        }

        if (typeof(callbackFxn) === 'function') {
            callbackFxn();
        }
    };

    // Reset colOrder to the original order
    var resetColOrder = function(callbackFxn) {
        oldOrderSnapshot();

        colOrder = new Array(colNames.length);
        for (var i = 0; i < colNames.length; i++) {
            colOrder[i] = i;
        }

        if (typeof(callbackFxn) === 'function') {
            callbackFxn();
        }
    };

    // Reset both rowOrder and colOrder
    var resetOrders = function(callbackFxn) {
        oldOrderSnapshot();

        var i;
        rowOrder = new Array(rowNames.length);
        for (i = 0; i < rowNames.length; i++) {
            rowOrder[i] = i;
        }
        colOrder = new Array(colNames.length);
        for (i = 0; i < colNames.length; i++) {
            colOrder[i] = i;
        }

        if (typeof(callbackFxn) === 'function') {
            callbackFxn();
        }
    };

    /**************** END SORTING FXNS *******************/

    var renameCol = function(col, newName, callbackFxn) {
        var $SET_COL_NAME_URL = flask_util.url_for('utils_set_topic_name', {
            model_name: model_name,
            topic_num: zTest(col),
            topic_name: newName,
            num_topics: colOrder.length
        });
        d3.json($SET_COL_NAME_URL, function(json) {
            if (json['topicNames'].length === colOrder.length) {
                colNames = json['topicNames'];

                console.log('Renaming success!');

                if (typeof(callbackFxn) === 'function') {
                    callbackFxn();
                }
            } else {
                console.log('Failure! Got bad response from topic renaming.')
            }
        });
    };

    /***************** BEGIN GETTING FXNS *******************/
    /* Many more getters are defined directly in return obj */
    
    // Function for getting a window's worth of rows and columns
    var getOrdersAndData = function(rowMin, rowMax, colMin, colMax, dataThreshold, forceSnapshot) {
        // If we want to ensure that old and curr orders match (e.g., when scrolling), force a snapshot
        if (forceSnapshot) {
            oldOrderSnapshot();
        }

        // Put orders and data into return object
        var returnObj = {};
        returnObj.rowOrder = rowOrder.slice(rowMin, rowMax);
        returnObj.colOrder = colOrder.slice(colMin, colMax);
        returnObj.data = data.filter(function(d) {
            return (returnObj.rowOrder.indexOf(d.row) !== -1 &&
                    returnObj.colOrder.indexOf(d.col) !== -1 &&
                    d.prop > dataThreshold);
        });

        return returnObj;
    };

    var getRowFilename = function(row) {
        var filename = rowMetadata[row]['filename'].split('/').pop();
        if (filename.indexOf('.txt') !== -1) {
            filename = filename.substring(0, filename.indexOf('.txt'));
        }
        return filename;
    };
    
    /***************** END GETTING FXNS ********************/
    
    // noinspection JSUnusedGlobalSymbols
    return {
        load: loadModel,
        sortRowsBy: sortRowsBy,
        sortColsBy: sortColsBy,
        sortRowsByDistanceFrom: sortRowsByDistanceFrom,
        sortColsByDistanceFrom: sortColsByDistanceFrom,
        sortRowsByMeta: sortRowsByMeta,
        sortColsByMeta: sortColsByMeta,
        sortRowsByNth: sortRowsByNth,
        moveRowsToTop: moveRowsToTop,
        moveColsToLeft: moveColsToLeft,
        updateRowIndex: updateRowIndex,
        updateColIndex: updateColIndex,
        setRowOrder: setRowOrder,
        setColOrder: setColOrder,
        resetRowOrder: resetRowOrder,
        resetColOrder: resetColOrder,
        resetOrders: resetOrders,
        getOrdersAndData: getOrdersAndData,
        getRowFilename: getRowFilename,
        getNumRows: function() { return rowOrder.length; },
        getNumCols: function() { return colOrder.length; },
        getRowName: function(row) { return rowNames[row] === '' ? '[EMPTY]' : rowNames[row]; },
        getColName: function(col) { return colNames[col] === '' ? '[EMPTY]' : colNames[col]; },
        getMaxRowLabelLength: function() { return Math.max.apply(Math, rowNames.map(function(e) { return typeof(e) === 'undefined' ? 0 : e.length; })) },
        getMaxColLabelLength: function() { return Math.max.apply(Math, colNames.map(function(e) { return typeof(e) === 'undefined' ? 0 : e.length; })) },
        getMaxRowMetaLength: function(fieldName) {
            return Math.max.apply(Math, rowMetadata.map(function(e) { return typeof(e[fieldName]) === 'undefined' ? 0 : e[fieldName].length; }))
        }, // TODO: Use this function to get the proper rowLabelWidth for updating the matrixView when we label rows with metadata (8/26/2016)
        getMaxColMetaLength: function(fieldName) {
            return Math.max.apply(Math, colMetadata.map(function(e) { return typeof(e[fieldName]) === 'undefined' ? 0 : e[fieldName].length; }))
        },
        getRowOrderRange: function(start, end) { return rowOrder.slice(start, end); },
        getColOrderRange: function(start, end) { return colOrder.slice(start, end); },
        getOldRowIndex: function(row) { return oldRowOrder.indexOf(row); },
        getOldColIndex: function(col) { return oldColOrder.indexOf(col); },
        getRowIndex: function(row) { return rowOrder.indexOf(row); },
        getColIndex: function(col) { return colOrder.indexOf(col); },
        getRowAsObj: function(row) { return theta[row]; },
        getColAsObj: function(col) { return phi[col]; },
        getRowMetaAsObj: function(row) { return rowMetadata[row]; },
        getColMetaAsObj: function(col) { return colMetadata[col]; },
        getRowMetaNames: function(metaTypes) { // Return all rowMetaNames, or only those of specified types
            if (typeof(metaTypes) === 'undefined') {
                return rowMetaNames.slice();
            } else {
                var namesToReturn = [];
                for (var i = 0; i < rowMetaTypes.length; i++) {
                    if (metaTypes.indexOf(rowMetaTypes[i]) !== -1) {
                        namesToReturn.push(rowMetaNames[i]);
                    }
                }
                return namesToReturn;
            }
        },
        getRowMetaTypes: function() { return rowMetaTypes.slice(); },
        getColMetaNames: function() { return colMetaNames.slice(); },
        getColMetaTypes: function() { return colMetaTypes.slice(); },
        aggregateRowsBy: aggregateRowsBy,
        unaggregateRows: unaggregateRows,
        getAggList: function(aggName) { return aggLists[aggName]; },
        renameCol: renameCol
    }
})();