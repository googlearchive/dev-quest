#!/usr/bin/env python
#
# Copyright 2016 Google Inc.
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
import os
import jinja2
import webapp2
import random
import re
import json
import mimetypes
import hashlib
import filters
import glob

_SERVICE_WORKER_PATH = 'dist/sw.js'

# Grab the version from the package.json.
version = None
with open('./package.json') as f:
    data = json.load(f)
    version = data["version"]

stories = sorted(glob.glob('./dist/static/stories/*.json'), reverse=True)
stories = map(lambda s: re.sub(r'\./dist/static/stories/([^\.]+).json', '\\1', s), stories)

# Set up the environment.
JINJA_ENVIRONMENT = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)),
    extensions=['jinja2.ext.autoescape'],
    autoescape=True)

JINJA_ENVIRONMENT.filters["add_hash"] = filters.add_hash

class MainHandler(webapp2.RequestHandler):

    def get_template_info(self, url):
        # Get the template based on the path the person is visiting.
        if re.search(r"/$", url):
            url = url + "index.html"

        if re.search(r"^/.+", url):
            url = url[1:]

        template_info = {
            "path": ("dist/%s" % url),
            "mimetype": (None, None),
            # Static files can be cached for a year, since there are hashes to
            # track changes to files, and so on. And we don't cache HTML.
            "cache": "public, max-age=31536000"
        }

        if re.search(r"^static/", url) is None:
            template_info["path"] = "dist/templates/%s" % url
            template_info["cache"] = "public, max-age=0"

        # Strip off the hash from the path we're looking for.
        template_info["path"] = re.sub(r'[a-f0-9]{64}.', '', template_info["path"])

        # Make a special exception for the Service Worker, since we serve it
        # from ./src/sw.js, even though the file lives elsewhere.
        if re.search("sw.js$", url) is not None:
            template_info["path"] = _SERVICE_WORKER_PATH
            template_info["cache"] = "public, max-age=0"

        template_info["mimetype"] = mimetypes.guess_type(template_info["path"])

        return template_info


    def get(self, url):
        debug = self.request.get('debug', None) is not None
        template_info = self.get_template_info(url)
        content_type = "text/plain"
        response = {
            "code": 404,
            "content": "URL not found."
        }

        if template_info["mimetype"][0]:
            content_type = "%s; charset=utf-8" % template_info["mimetype"][0]

        try:
            template = JINJA_ENVIRONMENT.get_template(template_info["path"])
            response["code"] = 200
            response["content"] = template.render(
                stories=stories,
                version=version,
                url=url,
                debug=debug
            )
        except jinja2.TemplateNotFound as template_name:
            print ("Template not found: %s (requested by %s)" %
                  (str(template_name), template_info["path"]))

        # Make an ETag for the content.
        etag = hashlib.sha256()
        etag.update(response["content"].encode('utf-8'))

        self.response.status = response["code"]
        self.response.headers["Content-Type"] = content_type
        self.response.headers["ETag"] = etag.hexdigest()
        self.response.headers["Cache-Control"] = template_info["cache"]
        self.response.write(response["content"])

app = webapp2.WSGIApplication([
    ('(.*)', MainHandler)
], debug=True)
