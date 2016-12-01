#!/usr/bin/env node

/*!
 *
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/* eslint-env es6 */

const fs = require('fs');
const cheerio = require('cheerio');
const glob = require('glob');

// if (process.argv.length < 3) {
//   console.log('Expected story to parse');
//   process.exit(0);
// }
const convertToObject = data => {
  const action = /\[\[([^\]]+)\]\]/gi;
  const actionInfo = data.match(action);
  const text = data.replace(action, '').trim();

  if (!actionInfo) {
    return {
      text,
      actions: []
    };
  }

  return {
    text,
    actions: actionInfo.map(a => {
      const arrow = a.indexOf('->');
      let title = a.substring(2, arrow);
      let action = a.substring(arrow + 2, a.length - 2);

      if (arrow === -1) {
        title = action = a.substring(2, a.length - 2);
      }

      return {
        title, action
      }
    })
  };
}

const onFiles = (err, files) => {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  files.forEach(src => {
    const textSrc = fs.readFileSync(src);
    const $ = cheerio.load(textSrc);
    const storyJSON = {};
    const startNode = $('tw-storydata').attr('startnode');

    $('tw-passagedata').each((i, elem) => {
      const passage = $(elem);
      const data = convertToObject(passage.text());

      if (passage.attr('pid') === startNode) {
        storyJSON['__start'] = passage.attr('name');
      }
      storyJSON[passage.attr('name')] = data;
    });

    const file = src.toLowerCase().replace(/\s/ig, '-').replace(/\.html$/, '');

    fs.writeFileSync(`../src/static/stories/${file}.json`,
        JSON.stringify(storyJSON));

  });
}

glob('**/*.html', onFiles);
console.log('Stories written.');