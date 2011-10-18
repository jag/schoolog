#!/usr/bin/env python
#
# Copyright 2007 Google Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
from google.appengine.ext import webapp
from google.appengine.ext.webapp import util
from google.appengine.ext.webapp import template
from google.appengine.api import urlfetch

import logging
import os
import urllib

class MainHandler(webapp.RequestHandler):
    def get(self):
		path = os.path.join(os.path.dirname(__file__), 'index.html')
		template_values = {}
		self.response.out.write(template.render(path, template_values))

class NytSearch(webapp.RequestHandler):
    def get(self):
        logging.error("searching!")
        name = self.request.get('name')
        facet= self.request.get('facet')
        api_key = 'eff3c0f44b1a4de66bdf58dccff8bbf4:12:61430921'
        url = 'http://api.nytimes.com/svc/search/v1/article?format=json&query=' + name.replace(' ','%20') 
        if facet !='':
            url = url + '%20' + facet + ':[' + name.replace(' ','%20').upper() + ']'
        url = url + '&rank=newest&api-key=' + api_key
        result = urlfetch.fetch(url)
        self.response.headers.add_header("Content-Type", 'application/json')
        logging.error(result.content)
        self.response.out.write(result.content)

def main():
    application = webapp.WSGIApplication([('/', MainHandler),
                                          ('/api/search', NytSearch)],
                                         debug=True)
    util.run_wsgi_app(application)


if __name__ == '__main__':
    main()
