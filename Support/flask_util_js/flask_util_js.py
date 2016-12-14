#!/usr/bin/env python
# -*- coding: utf-8 -*-

'''
#=============================================================================
#
#     FileName: flask_util_js.py
#         Desc: provide flask_util.js
#               在 app.config 中可以配置:
#                   FLASK_UTIL_JS_PATH: flask_util.js 的url路径
#                   FLASK_UTIL_JS_ENDPOINT: flask_util.js 的endpoint
#
#       Author: dantezhu
#        Email: zny2008@gmail.com
#     HomePage: http://www.vimer.cn
#
#      Created: 2012-07-09 17:23:51
#      History:
#               0.0.1 | dantezhu | 2012-07-09 17:23:51 | initialization
#               0.1   | dantezhu | 2012-08-30 22:54:33 | 正式版本
#               0.2.0 | dantezhu | 2012-10-22 21:53:14 | 优化为实例的方式
#               0.2.3 | dantezhu | 2012-11-20 11:13:22 | 增加no cache
#               0.2.4 | dantezhu | 2012-11-30 10:58:13 | content-type
#               0.2.5 | dantezhu | 2012-12-04 11:41:15 | defaults不需要，缺少params报异常
#
#=============================================================================
'''

__version__ = (0, 2, 5)

from flask import Response
from flask import render_template_string, json

FLASK_UTIL_JS_PATH = '/flask_util.js'

FLASK_UTIL_JS_TPL_STRING = '''
{% autoescape false %}

var flask_util = function() {
    var url_map = {{ json_url_map }};

    function url_for(endpoint, params) {
        if (!params) {
            params = {};
        }
        if (!url_map[endpoint]) {
            return '';
        }
        var rule = url_map[endpoint]['rule'];

        var used_params = {};


        var rex = /\<\s*(\w+:)*(\w+)\s*\>/ig;

        var path = rule.replace(rex, function(_i, _0, _1) {
            if (params[_1]) {
                used_params[_1] = params[_1];
                return encodeURIComponent(params[_1]);
            } else {
                throw(_1 + ' does not exist in params');
            }
        });

        var query_string = '';

        for(var k in params) {
            if (used_params[k]) {
                continue;
            }

            var v = params[k];
            if(query_string.length > 0) {
                query_string += '&';
            }
            query_string += encodeURIComponent(k)+'='+encodeURIComponent(v);
        }

        var url = path;
        if (query_string.length > 0) {
            url += '?'+query_string;
        }

        return url;
    }

    return {
        url_for: url_for
    }
}();

{% endautoescape %}
'''

class FlaskUtilJs(object):
    """FlaskUtilJs"""

    def __init__(self, app=None):
        """init with app

        :app: Flask instance

        """
        self._app = None

        if app:
            self.init_app(app)
        
    def init_app(self, app):
        """
        安装到app上
        """
        if self._app is not None:
            raise Exception('Flask-Admin is already associated with an application.')

        self._app = app
            
        path = app.config.get('FLASK_UTIL_JS_PATH', FLASK_UTIL_JS_PATH)
        endpoint = app.config.get('FLASK_UTIL_JS_ENDPOINT', None)

        @app.route(path, endpoint=endpoint)
        def flask_util_js():
            org_url_map = app.url_map._rules_by_endpoint

            #把重的逻辑还是放到python代码里
            url_map = dict()

            for k,v in org_url_map.items():
                url_map[k] = dict(
                    rule=app.config["WEB_ROOT"] + (v[0].rule)[1:],
                    )

            json_url_map = json.dumps(url_map, indent=4, ensure_ascii=False)

            rv = render_template_string(
                FLASK_UTIL_JS_TPL_STRING, 
                json_url_map=json_url_map
                )

            return Response(
                rv,
                content_type='text/javascript; charset=UTF-8',
                headers={
                    'Cache-Control':'no-cache',
                }
            )
        
        # 最后把数据写到实例里
        self._path = path
        self._endpoint = endpoint or flask_util_js.__name__
            
    @property
    def path(self):
        return self._path

    @property
    def endpoint(self):
        return self._endpoint
