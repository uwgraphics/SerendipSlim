import numpy as np
import scipy.spatial.distance as sciD
import scipy.sparse as sciS
import random
import time

numTopics = 100
numDocs = 100000

print 'SPARSE MATRIX:'

# Test with sparse doc-topic matrix
print 'Building sparse doc-topic matrix...'
start = time.time()
sparsity = .2
spTheta = sciS.dok_matrix((numDocs, numTopics), dtype=float)
for i in range(numDocs):
    for j in range(numTopics):
        if random.random() < sparsity:
            spTheta[i,j] = random.random()
spTheta = spTheta.todense()
print 'Done. (%.2f s)' % (time.time() - start)

print 'Testing distance computations with sparse matrix...'
numRuns = 100;
totalTime = 0.0;
docOrder = range(numDocs)
for i in range(numRuns):
    docToSortBy = random.choice(range(numDocs))
    start = time.time()
    docOrder.sort(key=lambda v: sciD.cosine(spTheta[docToSortBy], spTheta[v]))
    #docOrder.sort(key=lambda v: spTheta[docToSortBy].dot(spTheta[v]) / ( * ))
    totalTime += time.time() - start
avgTime = totalTime / numRuns
print 'Average time for sorting docs by similarity to given doc (SPARSE MATRIX): %.2f s' % avgTime

# print 'Building sparse similarity matrix...'
# start = time.time()
# m = sciD.cdist(spTheta, spTheta, 'cosine')
# print 'Done. (%.2f s)' % (time.time() - start)

# Test with fully dense doc-topic matrix
print 'DENSE MATRIX:'

print 'Building bigTheta (%d x %d)...' % (numDocs, numTopics)
start = time.time()
bigTheta = np.matrix([ [ random.random() for i in range(numTopics) ] for j in range(numDocs) ])
print 'Done. (%.2f s)' % (time.time() - start)

print 'Testing distance computations with dense matrix...'
numRuns = 100;
totalTime = 0.0;
docOrder = range(numDocs)
for i in range(numRuns):
    docToSortBy = random.choice(range(numDocs))
    start = time.time()
    docOrder.sort(key=lambda v: sciD.cosine(bigTheta[docToSortBy], bigTheta[v]))
    totalTime += time.time() - start
avgTime = totalTime / numRuns
print 'Average time for sorting docs by similarity to given doc (DENSE MATRIX): %.2f s' % avgTime

# print 'Building similarity matrix...'
# start = time.time()
# m = sciD.cdist(bigTheta, bigTheta, 'cosine')
# print 'Done. (%.2f s)' % (time.time() - start)