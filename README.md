# SerendipSlim
SerendipSlim is a visualization tool designed to help researchers explore large collections of text documents through the use of [probabilistic topic modeling](https://en.wikipedia.org/wiki/Topic_model). SerendipSlim is an updated version of an earlier tool called [Serendip](http://vep.cs.wisc.edu/serendip/), which first appeared in a [publication at IEEE Vis in 2014](http://graphics.cs.wisc.edu/Papers/2014/AKVWG14/). Serendip was created by Eric Alexander, working as part of the [Visualizing English Print project](http://vep.cs.wisc.edu), a cross-disciplinary collaboration of computer scientists and literature scholars interested in bringing the practices of data visualization and statistical analysis to the study of historical documents.

Describe the tools involved in development, give some shoutouts (D3, cloud library, Bootstrap, maybe Mallet and Gensim). Mention Flask, the idea of local server.

##Running SerendipSlim

Describe the installation, what libraries are required, and how to point it at a directory containing models. (Link down to the "model format" section if that's possible in Markdown.)

##Example models

Link to Shakespeare, plays, and science

##SlimCV

Describe the functionality of CorpusViewer

##SlimTV

Describe the functionality of TextViewer
Perhaps mention (and link to) SlimTVFlat

##SerendipSlim model format

Serendip requires models in a specific format:

```
modelsDir/
    model1_name/
        TopicModel/
            HTML/
                doc1_name/
                    tokens.csv
                    rules.json
                doc2_name/
                ...
            topics_freq/
            topics_sal/
            topics_ig/
            theta.csv
            metadata.csv
    model2_name/
    ...
```

Describe all of the above files, and link to an example model. (Or tell them where they can find one, in their initial download.)

##Updates, requests, and contact:

SerendipSlim offers many new features not available in the original Serendip, along with a huge upgrade in speed, scale, and ease of use. However, some rarely used features were dropped. If you have requests for the return of certain features, or suggestions for other features, improvements, or bug fixes, let me know! CONTACT INFO.
