import os
import csv
from flask import jsonify, current_app

# Returns list of models contained within metadata directory
# TODO: filter so that it only returns folders that have a theta.csv or something
def get_models_list():
    return os.listdir(current_app.config['METADATA_ROOT'])

# Old versions of Serendip stored data in a "TopicModel" directory.
# This helper function checks for that directory to retreive the proper root.
def get_model_root(model_name):
    metadata_root = current_app.config['METADATA_ROOT']
    if os.path.exists(os.path.join(metadata_root, model_name, 'TopicModel')):
        return os.path.join(metadata_root, model_name, 'TopicModel')
    else:
        return os.path.join(metadata_root, model_name)

# A helper function for Serendip to know which ranking types to enable
def get_ranking_types(model_name):
    model_root = get_model_root(model_name)
    filelist = os.listdir(model_root)
    rankingTypes = []
    for name in filelist:
        if name.startswith('topics_') and os.path.isdir(os.path.join(model_root, name)):
            rankingTypes.append(name[name.find('_') + 1 :])
    return jsonify({'rankingTypes': rankingTypes})

# Get the distribution for a given topic
def get_topic(model_name, topic_num, num_words, ranking_type='freq'):
    num_words = int(num_words)
    model_root = get_model_root(model_name)
    topicCSV = os.path.join(model_root, 'topics_%s' % ranking_type, 'topic_%s.csv' % topic_num)
    if not os.path.exists(topicCSV):
        topicCSV = os.path.join(current_app.config['METADATA_ROOT'],
                                model_name.split("/")[0],
                                'topics_%s' % ranking_type,
                                'topic_%s.csv' % topic_num)
    with open(topicCSV, 'rb') as topicF:
        reader = csv.reader(topicF)
        i = 0
        topicWords = []
        for row in reader:
            if i >= num_words:
                break
            if row[0] == 'word' and row[1] == 'weight':
                continue
            topicWords.append({
                'word': row[0],
                'weight': row[1]
            })
            i += 1
    return jsonify({'wordObjs': topicWords})

# Get the user-defined names for topics within a model
def get_topic_names(model_name):
    topicNames = _get_topic_names(model_name)
    if len(topicNames) == 0:
        return jsonify({})
    else:
        return jsonify({'topicNames': topicNames})

def _get_topic_names(model_name):
    try:
        topicNameFile = os.path.join(get_model_root(model_name), 'topicNames.csv')
        with open(topicNameFile, 'rb') as f:
            reader = csv.reader(f)
            for row in reader:
                topicNames = row
                break
        return topicNames
    except IOError:
        return []

# Change a user-defined name for a topic with a model
def set_topic_name(model_name, topic_num, topic_name, num_topics):
    topic_num = int(topic_num)
    num_topics = int(num_topics)
    topicNameFile = os.path.join(get_model_root(model_name), 'topicNames.csv')
    try:
        with open(topicNameFile, 'rb') as f:
            reader = csv.reader(f)
            for row in reader:
                topicNames = row
                break
    except IOError:
        topicNames = ['Topic %d' % i for i in range(num_topics)]

    topicNames[topic_num] = topic_name
    with open(topicNameFile, 'wb') as f:
        writer = csv.writer(f)
        writer.writerow(topicNames)
    return jsonify({'topicNames': topicNames})
