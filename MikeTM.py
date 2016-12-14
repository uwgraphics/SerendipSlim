__author__ = 'Mike Gleicher'

"""
Utilities for dealing with Serendipity Topic Models
"""

# warning! you need to set these correctly from outside
# these are the defaults for me!
defaultMetadataDir = "C:/Users/Eric/Documents/Madison/VEP_Core/vep_core/Data/Metadata"
defaultModel = "ShakespeareChunkedOptimized_50"

# external libraries
import numpy as N
import scipy.stats as SS

# python stuffs
import csv
from collections import Counter, defaultdict

def buildPath(metadataDir=defaultMetadataDir, modelName=defaultModel, filename=""):
    return "%s/%s/TopicModel/%s" % (metadataDir, modelName, filename)

def readMatrix(metadataDir=defaultMetadataDir, model=defaultModel, file="theta.csv"):
    """
    read a full matrix - tricky part, we don't know how big
    also keeps a bunch of stats handy - so it returns multiple things

    as a DICTIONARY so you can remember what it is
    :param file:
    :return:
    """
    with open(buildPath(metadataDir, model, file)) as fi:
        spm = []
        maxc = -1
        nz = 0
        maxV = 0
        minV = 1
        sread = csv.reader(fi)
        for row in sread:
            srow = []
            for i in range(len(row)/2):
                c = int(row[i*2])
                v = float(row[i*2+1])
                if c>maxc:
                    maxc = c
                if v > maxV:
                    maxV = v
                if v < minV:
                    minV = v
                srow.append( (c,v) )
                nz += 1
            spm.append(srow)

        nrows = len(spm)
        ncols = maxc + 1
        print "%s: %d rows, %d columns, %d non-zeros (%4.1f%%) range[%g %g]" % \
              (file, nrows, ncols,nz, 100.0*float(nz)/float(ncols*nrows),maxV,minV)

        matr = N.zeros( (nrows,ncols) )
        for row,spr in enumerate(spm):
            for sv in spr:
                matr[row,sv[0]] = sv[1]

        return {"matrix":matr, "sparse-matrix":spm, "non-zeros":nz, "nz-range":(minV,maxV) }

class TopicModel:
    def __init__(self, metadataDir=defaultMetadataDir, model=defaultModel):
        self.name = model
        self.thetaD = readMatrix(metadataDir, model, "theta.csv")
        self.theta = self.thetaD["matrix"]
        self.thetaKD = None

        # we need a more robust parser, so we can't use recfromcsv (doesn't handle quotes)
        # need to skip 2nd line
        # trick - we need to skip the 2nd line! so we have to grab the names ourselves
        metadatafname = buildPath(metadataDir, model, "metadata.csv")
        with open(metadatafname) as mf:
            r = csv.reader(mf, skipinitialspace=True)
            self.metadatacols = r.next()
            skipline = r.next()         # skip types
            datalines = [i for i in r]

        self.metadata = N.core.records.fromrecords(datalines, names = self.metadatacols)

        # for each column, generate some stats
        self.metadatacounts = dict()
        for k in self.metadatacols:
            self.metadatacounts[k] = Counter(self.metadata.field(k))
        '''
        # for each column with a reasonable number of items, generate a default color set
        self.metadatacolors = dict()
        for k in self.metadatacounts:
            if len(self.metadatacounts[k]) <= 12:
                colors = cbrewer.getHexScheme("Set3",len(self.metadatacounts[k]),"qual")
                colord = dict()
                for val,col in zip(self.metadatacounts[k],colors):
                    colord[val] = col
                self.metadatacolors[k] = colord
                #print "colors for %s:" % k, colord
        '''
    def groupByCol(self, colName):
        """
        returns a dictionary of all values of the column, each with a list of which rows have that value
        :param colName:
        :return:
        """
        lst = self.metadata.field(colName)
        groups = defaultdict(list)
        for i,r in enumerate(lst):
            groups[r].append(i)
        return groups

    def matricesByCol(self, colName, matrix=None):
        """
        returns a dictionary of matrices, one matrix per group in the column

        :param colName:
        :return:
        """
        if matrix == None:
            matrix = self.theta
        groups = self.groupByCol(colName)
        matrs = dict()
        for k in groups:
            matrs[k] = matrix[groups[k]]

        return matrs

    def colorRows(self, colName):
        """
        generates the javascript that re-colors the rows according to a data column

        prints it to the console
        :param colName:
        :return: nothing
        """
        groups = self.groupByCol(colName)
        for k in groups:
            print "colorRows(",groups[k], ', "%s");' % self.metadatacolors[colName][k]

    def anovaCols(self, colName, excludes=[]):
        """
        does the annova hueristic to order the columns to seperate ALL classes in a column
        returns the ordering list

        :param colName:
        :return:
        """
        matrs = self.matricesByCol(colName)
        matrsEx = [matrs[m] for m in matrs if m not in excludes]
        anovas = [SS.f_oneway(* [ m[:,i] for m in matrsEx ]) for i in range(self.theta.shape[1])]
        return anovas

    def anovaColsRanks(self, colName, excludes=[]):
        avals = self.anovaCols(colName,excludes)
        fvals = [v[0] for v in avals]
        return list(N.argsort(fvals))

    def contrastCols(self,colName, yes,no = []):
        # if you give 1 element, turn it into a list
        if not(isinstance(yes,list)):
            yes = [ yes ]
        # empty no list means ALL
        if len(no) == 0:
            no = [x for x in self.metadatacounts[colName] if x not in yes]


        yesI = [i for i,v in enumerate(self.metadata.field(colName)) if v in yes]
        noI  = [i for i,v in enumerate(self.metadata.field(colName)) if v in no]
        print "contrast %s (%d) with %s (%d)" % (yes,len(yesI),no,len(noI))

        yesM = self.theta[yesI]
        noM = self.theta[noI]

        anovas = [SS.f_oneway(yesM[:,i], noM[:,i]) for i in range(self.theta.shape[1])]
        return anovas

    def contrastColsRanks(self,colName, yes,no = []):
        avals = self.contrastCols(colName,yes,no)
        fvals = [v[0] for v in avals]
        return list(N.argsort(fvals))

    def sortColsByDistance(self, listOfCols):
        if isinstance(listOfCols,int):
            listOfCols = [listOfCols]
        dst = [
                 #min([1-SS.spearmanr(self.theta[:,col],self.theta[:,i]) for col in listOfCols])
                 #(1-SS.spearmanr(self.theta[:,0],self.theta[:,i]))
                 min([(1-SS.spearmanr(self.theta[:,c], self.theta[:,i])[0]) for c in listOfCols])
                 for i in range(self.theta.shape[1])
                ]
        return list(N.argsort(dst))
