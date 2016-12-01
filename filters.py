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

import hashlib
import re

def add_hash(path):
    """Generates a hash from a file.
    Args:
      path: (string) The path to the file to generate the hash from.
    Returns:
      Returns a hash digest (string) of the file.
    """
    if re.search(r"^/.+", path):
        path = path[1:]

    # If a story, fix the path.
    is_story = False
    original_path = path
    if re.search(r"^\d{4}\-\d{2}\-\d{2}", path):
        path = "static/stories/%s.json" % path
        is_story = True

    blocksize = 32768
    file_hash = hashlib.sha256()
    file_path = "dist/%s" % path

    with open(file_path) as file_to_hash:
        file_buffer = file_to_hash.read(blocksize)
        while (len(file_buffer) > 0):
            file_hash.update(file_buffer)
            file_buffer = file_to_hash.read(blocksize)

    if is_story:
        hashed_path = "%s.%s" % (original_path, file_hash.hexdigest())
    else:
        hashed_path = re.sub(r'(.*?)\.(.*)$', ("\\1.%s.\\2" % file_hash.hexdigest()), path)

    return hashed_path