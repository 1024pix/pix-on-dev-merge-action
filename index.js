const github = require('@actions/github')
const { WebClient : SlackWebClient  } = require('@slack/web-api')
const run = require('./lib/server')
const core = require('@actions/core')

run({ github, SlackWebClient, configFilename: 'api/src/shared/config.js', core })
