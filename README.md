# SerendipSlim
SerendipSlim is a visualization tool designed to help researchers explore large collections of text documents through the use of [probabilistic topic modeling](https://en.wikipedia.org/wiki/Topic_model). SerendipSlim is an updated version of an earlier tool called [Serendip](http://vep.cs.wisc.edu/serendip/), which first appeared in a [publication](http://graphics.cs.wisc.edu/Papers/2014/AKVWG14/) at [IEEE VAST 2014](http://ieeevis.org/year/2014/info/vis-welcome/welcome). Serendip was created by Eric Alexander and Joe Kohlmann, working as part of the [Visualizing English Print project](http://vep.cs.wisc.edu), a cross-disciplinary collaboration of computer scientists and literature scholars interested in bringing the practices of data visualization and statistical analysis to the study of historical documents.

SerendipSlim is a web-app built to run in a web-browser (preferably [Google Chrome](https://www.google.com/chrome/)). Its front-end is written in Javascript, with heavy use of the [D3](https://d3js.org/) and [jQuery](https://jquery.com/) libraries, along with the [Bootstrap](http://getbootstrap.com/) framework. The back-end is written in [Python](https://www.python.org/), running a server implemented using the [Flask](http://flask.pocoo.org/) library.

## Running SerendipSlim

#### Required software
SerendipSlim's back-end is written in [Python](https://www.python.org/) [version 2.7](https://docs.python.org/2.7/). Python 2.7 must therefore be installed to operate it. We suggest using a Python installation like [Anaconda](https://www.continuum.io/downloads), as this comes with the necessary additional libraries required by our scripts, such as [Flask](http://flask.pocoo.org/) (along with some other useful ones like [Scipy](https://www.scipy.org/) and [NLTK](http://www.nltk.org/)).

#### Running the local server
With Python and Flask installed, SerendipSlim can be run simply by running the `__init__.py` file from within the SerendipSlim directory:

```
> python __init__.py
```

This should show information indicating that the server is running, like this:

```
> python __init__.py
 * Restarting with stat
 * Debugger is active!
 * Debugger pin code: 544-249-008
 * Running on http://127.0.0.1:5001/ (Press CTRL+C to quit)
```

Running the program with no other arguments will start a local server that will serve up any models contained within the directory `/SerendipSlim/Data/Metadata/` (including the sample model `ShakeINF_ch50` built on Shakespeare's First Folio). To serve up models located in other directories, simply pass the directory's path as a command-line argument:

```
> python __init__.py "C:\path\to\directory\containing\topic\models"
```

To be valid for Serendip, models have to be formatted in a very specific way, described [below]().

#### Interacting with SerendipSlim
Once the local server is running, researchers can view the corpus-level visualization by navigating to [localhost:5001](localhost:5001) within a web browser. From there, individual models can be selected from the dropdown menu in the top navigation bar, or controlled using the URL.


## Example models

We have built a number of models on sample corpora curated by the [Visualizing English Print project](http://vep.cs.wisc.edu). Though they have better performance when being run from a local server, rather than using our server, they can be interacted with here:
- [Shakespeare's First Folio](http://vep.cs.wisc.edu/serendipSlim/model:Shake_50/matrix) 
- [Early Modern Drama](http://vep.cs.wisc.edu/serendipSlim/model:EMDrama_50_long_chunked/matrix) ([corpus](http://graphics.cs.wisc.edu/WP/vep/vep-early-modern-drama-collection/))
- [Early Modern Science](http://vep.cs.wisc.edu/serendipSlim/model:EMScience_50_chunked/matrix) ([corpus](http://graphics.cs.wisc.edu/WP/vep/vep-early-modern-science-collection/))

## SlimCV

SlimCV (originally "CorpusViewer") is meant to help researchers explore collections of documents at the corpus level. At its heart is a reorderable matrix plotting topics (along the horizontal axis) against documents (along the horizontal axis). The proportions of individual topics within each document are indicated by the size of circular glyphs located at the vertices.

Controls for (re-)ordering, labeling, selecting, and coloring the topics and documents can be found in the control panels on the left.

Views for examining metadata and distributions from individual topics and documents can be found in the panels on the right.

## SlimTV

SlimTV (originally "TextViewer") is meant to help researchers examine topic modeling data in a lower level of abstraction. By connecting the high level patterns of a topic model down to individual passages, researchers can combine the practices of close and distant reading, helping them build explanations for the trends they observe.

SlimTV is centered around a tagged-text view of a single document. Individual words are highlighted with a color corresponding to the topic the model has associated with them (after the topic has been toggled on using one of the buttons in the list on the left).

On the right, a line graph visualization graphs topic density (along the horizontal axis) against position within the document (along the vertical axis). By looking for peaks and valleys for individual topic lines and clicking on the corresponding places within the visualizations, researchers can navigate directly to relevant passages of text.

## SerendipSlim model format

Serendip requires models to be laid out in a specific directory format:

```
NAME_OF_YOUR_MODEL_DIR/
    NAME_OF_FIRST_MODEL/
        TopicModel/
            HTML/
                NAME_OF_FIRST_DOC/
                    tokens.csv
                    rules.json
                NAME_OF_SECOND_DOC/
                ...
            topics_freq/
                topic_0.csv
                topic_1.csv
                ...
            topics_sal/
                topic_0.csv
                topic_1.csv
                ...
            topics_ig/
                topic_0.csv
                topic_1.csv
                ...
            theta.csv
            metadata.csv
    NAME_OF_SECOND_MODEL/
    ...
```

These files should be structured thus:
- **theta.csv**: A CSV file containing a single row per document. Each row contains cells indicating the *topics* present in the document and the *proportion* of these topics, in successive order. For example, the row for a document containing 60% of topic 3, 25% of topic 4, and 15% of topic 6 would look like `3,.6,4,.25,6,.15`. [(example)](Data/Metadata/Shake_50/TopicModel/theta.csv)
- **metadata.csv**: A CSV file containing columns for each piece of human-curated metadata for the corpus. The first row of this file should contain the field names for the metadata. **The first column must be _id_ and the second column must be _filename_.** The second row of the file should be the data type of each column, chosen from `int` for numerical data (e.g., "year"), `cat` for categorical data (e.g., "genre"), and `str` for arbitrary string data (e.g., "title" or "author"). The rest of the rows correspond to the values individual documents. [(example)](Data/Metadata/Shake_50/TopicModel/metadata.csv)
- **topic_X.csv**: These topic CSV files contain `word, proportion` pairs for each word in each topic, in descending order. Only the `topics_freq` distributions are required. The other directories are for the alternative orderings of *saliency* and *information gain* (as described in the [paper](http://graphics.cs.wisc.edu/Papers/2014/AKVWG14/)). [(example)](Data/Metadata/Shake_50/TopicModel/topics_freq/topic_0.csv)
- **tokens.csv**: There is a tokens CSV file for each document containing the tokens of the document and their corresponding tags. Each line of these files looks like `token, tokenToMatch, endReason, topic_X`. [(example)](Data/Metadata/Shake_50/TopicModel/HTML/Hamlet/tokens.csv)
    - `token` is simply the unchanged token from the document.
    - `tokenToMatch` is the _simplified_ token used to match it to corresponding tokens during modeling. Generally, this is done through lowercasing, but can include more complex things like lemmatizing.
    - `endReason` is the event that cut off the token, and can have values of `s` for a space, `c` for a character like punctuation, and `n` for a newline.
    - `topic_X` (replacing `x` for the number of the topic) indicates the topic that this word is tagged with. This value is optional, as not every word will necessarily get tagged (e.g., stopwords will not).
- **rules.json**: A JSON object telling SlimTV details about the distribution of topic tags in this document. [(example)](Data/Metadata/Shake_50/TopicModel/HTML/Hamlet/rules.json)

## Building new models
Serendip can display a variety of models, so long as they conform to the above format. Sample scripts that build models using [Mallet](http://mallet.cs.umass.edu/topics.php) and [Gensim](https://radimrehurek.com/gensim/) can be found in our [VEP_TMScripts](https://github.com/uwgraphics/VEP_TMScripts) repository. These scripts are provided **AS IS** and may need to be tuned/updated to create models in certain environment on certain documents.


## Updates, requests, and contact:

SerendipSlim offers many new features not available in the original Serendip, along with a huge upgrade in speed, scale, and ease of use. However, some rarely used features were dropped. If you have requests for the return of certain features, or suggestions for other features, improvements, or bug fixes, let me know!
