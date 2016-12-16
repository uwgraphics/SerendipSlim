import os

#############################
#### Flask Configuration ####
#############################
class Config(object):
    DEBUG = False
    TESTING = False
    DEFAULT_MODEL_NAME = "Shake_50"
    NAME = u"Serendip[Slim]"
    WEB_ROOT = "/"
    SERENDIP_ROOT = os.path.abspath(os.path.dirname(__file__))
    METADATA_ROOT = os.path.join(SERENDIP_ROOT, 'Data', 'Metadata')
    CORPUS_ROOT = os.path.join(SERENDIP_ROOT, 'Data', 'Corpora')
    STOPWORDS_ROOT = os.path.join(SERENDIP_ROOT, 'Data', 'Stopwords')


class ProductionConfig(Config):
    pass

class DevelopmentConfig(Config):
    DEBUG = True
    NAME = u"Serendip[Slim]"

class TestingConfig(DevelopmentConfig):
    TESTING = True
    NAME = "u\"Ser\\xb7\\u0259n\\u02c8\\xb7dip[\\xb7it\\u0113]\" (Testing)"
