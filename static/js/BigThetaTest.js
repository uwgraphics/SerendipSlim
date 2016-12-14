/**
 * Created by ealexand on 7/20/2016.
 */


// Dot product of two arrays of numbers
var dot = function(v1, v2) {
    if (v1.length != v2.length) {
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

// Set up the arrays and matrix to be sorting
var i, j;
var numTopics = 100;
var numDocs = 10000;
var topicOrder = new Array(numTopics);
for (i = 0; i < numTopics; i++) {
    topicOrder[i] = i;
}
var docOrder = new Array(numDocs);
for (i = 0; i < numDocs; i++) {
    docOrder[i] = i;
}
var bigTheta = new Array(numDocs);
var bigPhi = new Array(numTopics);
for (i = 0; i < numDocs; i++) {
    bigTheta[i] = new Array(numTopics);
    for (j = 0; j < numTopics; j++) {
        bigTheta[i][j] = Math.random();
        if (i == 0) {
            bigPhi[j] = new Array(numDocs);
        }
        bigPhi[j][i] = bigTheta[i][j];
    }
}
console.log('numTopics: ' + numTopics + '; numDocs: ' + numDocs);

// Get average time for sorting topics
var numRuns = 100;
var totalTime = 0;
var docToSortBy, start;
for (i = 0; i < numRuns; i++) {
    docToSortBy = Math.floor(Math.random() * numDocs);
    start = new Date().getTime();
    topicOrder.sort(function(a,b) {
        return bigTheta[docToSortBy][b] - bigTheta[docToSortBy][a];
    });
    totalTime += new Date().getTime() - start;
}
var avgTime = totalTime / numRuns;
console.log('Average time for sorting topics by given doc: ' + avgTime);

// Get average time for sorting docs
numRuns = 100;
totalTime = 0;
var topicToSortBy;
for (i = 0; i < numRuns; i++) {
    topicToSortBy = Math.floor(Math.random() * numTopics);
    start = new Date().getTime();
    docOrder.sort(function(a,b) {
        return bigTheta[b][topicToSortBy] - bigTheta[a][topicToSortBy];
    });
    totalTime += new Date().getTime() - start;
}
avgTime = totalTime / numRuns;
console.log('Average time for sorting docs by given topic: ' + avgTime);

// Get average time for sorting topics by similarity to one
numRuns = 100;
totalTime = 0;
var refMag;
for (i = 0; i < numRuns; i++) {
    topicToSortBy = Math.floor(Math.random() * numTopics);
    start = new Date().getTime();
    refMag = mag(bigPhi[topicToSortBy]);
    topicOrder.sort(function(a,b) {
        return dot(bigPhi[b], bigPhi[topicToSortBy]) / (refMag * mag(bigPhi[b]))
            - dot(bigPhi[a], bigPhi[topicToSortBy]) / (refMag * mag(bigPhi[a]));
    });
    totalTime += new Date().getTime() - start;
}
avgTime = totalTime / numRuns;
console.log('Average time for sorting topics by similarity to given topic: ' + avgTime);

// Get average time for sorting docs by similarity to one
numRuns = 100;
totalTime = 0;
for (i = 0; i < numRuns; i++) {
    docToSortBy = Math.floor(Math.random() * numDocs);
    start = new Date().getTime();
    refMag = mag(bigTheta[docToSortBy]);
    docOrder.sort(function(a,b) {
        return dot(bigTheta[b], bigTheta[docToSortBy]) / (refMag * mag(bigTheta[b]))
            - dot(bigTheta[a], bigTheta[docToSortBy]) / (refMag * mag(bigTheta[a]));
    });
    totalTime += new Date().getTime() - start;
}
avgTime = totalTime / numRuns;
console.log('Average time for sorting docs by similarity to given doc: ' + avgTime);

// Get time for building doc similarity matrix
start = new Date().getTime();
var docMags = new Array(numDocs);
for (i = 0; i < numDocs; i++) {
    docMags[i] = mag(bigTheta[i]);
}
var docSim = new Array(numDocs);
for (i = 0; i < numDocs; i++) {
    docSim[i] = new Array(numDocs);
    for (j = 0; j < numDocs; j++) {
        docSim[i][j] = dot(bigTheta[i], bigTheta[j]) / (docMags[i] * docMags[j]);
    }
}
totalTime = new Date().getTime() - start;
console.log('Time to build doc similarity matrix: ' + totalTime);

// Get time for building topic similarity matrix
start = new Date().getTime();
var topicMags = new Array(numTopics);
for (i = 0; i < numTopics; i++) {
    topicMags[i] = mag(bigPhi[i]);
}
var topicSim = new Array(numTopics);
for (i = 0; i < numTopics; i++) {
    topicSim[i] = new Array(numTopics);
    for (j = 0; j < numTopics; j++) {
        topicSim[i][j] = dot(bigPhi[i], bigPhi[j]) / (topicMags[i] * topicMags[j]);
    }
}
totalTime = new Date().getTime() - start;
console.log('Time to build topic similarity matrix: ' + totalTime);

// Get average time for sorting docs by similarity to one WITH A SIM MATRIX
numRuns = 100;
totalTime = 0;
for (i = 0; i < numRuns; i++) {
    docToSortBy = Math.floor(Math.random() * numDocs);
    start = new Date().getTime();
    docOrder.sort(function(a,b) {
        return docSim[docToSortBy][b] - docSim[docToSortBy][a];
    });
    totalTime += new Date().getTime() - start;
}
avgTime = totalTime / numRuns;
console.log('Average time for sorting docs by similarity WITH A SIM MATRIX: ' + avgTime);

// Get average time for sorting docs by similarity to one WITH A SIM MATRIX
numRuns = 100;
totalTime = 0;
for (i = 0; i < numRuns; i++) {
    topicToSortBy = Math.floor(Math.random() * numTopics);
    start = new Date().getTime();
    topicOrder.sort(function(a,b) {
        return topicSim[topicToSortBy][b] - topicSim[topicToSortBy][a];
    });
    totalTime += new Date().getTime() - start;
}
avgTime = totalTime / numRuns;
console.log('Average time for sorting topics by similarity WITH A SIM MATRIX: ' + avgTime);
