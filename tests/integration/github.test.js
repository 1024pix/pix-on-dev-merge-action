const sinon = require('sinon')
const { expect } = require('chai')
const run = require('../../lib/server')

const prListCommit = require('./list-pr-commit')

const OWNER = 'pix'
const REPO_NAME = 'monRepo'
const GIT_SHA = 'master'

describe('Integration | notify-team-on-config-file-change', function () {
  let github
  let octokit

  let slack
  let slackClient

  let core

  beforeEach(async function () {
    octokit = {
      rest: {
        repos: {
          getCommit: sinon.stub(),
          listPullRequestsAssociatedWithCommit: sinon.stub()
        }
      }
    }

    github = {
      getOctokit: () => octokit,
      context: {
        repo: {
          owner: OWNER,
          repo: REPO_NAME
        },
        sha: GIT_SHA
      }
    }

    slackClient = {
      conversations: {
        list: sinon.stub()
      },
      chat: {
        postMessage: sinon.stub()
      }
    }

    slack = function() {
      this.conversations = slackClient.conversations
      this.chat = slackClient.chat
    }

    process.env.INPUT_INTEGRATION_ENV_URL = 'toto'
    process.env.INPUT_GITHUB_TOKEN = 'gh_token'
    process.env.INPUT_SLACK_BOT_TOKEN = 'slk_token'

    core = {
      debug: sinon.stub(),
      error: sinon.stub(),
      info: sinon.stub(),
      setFailed: sinon.stub(),
      getInput: sinon.stub()
    }
  })

  describe('#run', function () {
    context("if the configuration file was not updated", async function () {
      it("should log for debugging purpose 'No config file modification detected'", async function () {
        core.setFailed.returns()
        core.getInput.returns()
        octokit.rest.repos.getCommit.withArgs({
            owner: OWNER,
            repo: REPO_NAME,
            ref: GIT_SHA,
          }).returns(Promise.resolve({
              data: {
                files: [
                  {
                    filename: 'ca'
                  },
                  {
                    filename: 'marche'
                  }
                ]
              }
          }))

        await run({ github, SlackWebClient: undefined, configFilename: 'api/src/shared/config.js', core })

        expect(core.info.calledWith('No config file modification detected.')).to.be.true
      })
    })

    context("if the configuration file was updated", async function () {
      context("slack channel was found", async function () {
        context("slack works fine", function () {
          it("should send message to slack", async function () {
            // given
            core.setFailed.returns()
            core.getInput.returns()
            core.getInput.withArgs('INTEGRATION_ENV_URL').returns('toto');
            core.info.returns()
            octokit.rest.repos.getCommit.withArgs({
              owner: OWNER,
              repo: REPO_NAME,
              ref: GIT_SHA,
            }).returns(Promise.resolve({
                data: {
                  files: [
                    {
                      filename: 'api/lib/config.js'
                    },
                    {
                      filename: 'marche'
                    }
                  ]
                }
            }))
  
            octokit.rest.repos.listPullRequestsAssociatedWithCommit.withArgs({
              owner: OWNER,
              repo: REPO_NAME,
              commit_sha: GIT_SHA,
            }).returns(Promise.resolve({
              data: prListCommit
            }))
  
            slackClient.conversations.list.returns({
              channels: [
                {
                  name: 'team-captains',
                  id: 1
                }
              ]
            })
  
            slackClient.chat.postMessage.returns({ok: true})
  
            // when
            await run({ github, SlackWebClient: slack, configFilename: 'api/lib/config.js', core })
  
  
            // then 
            const expectedMessage =  `Le fichier de configuration api/lib/config.js a été modifié dans la PR *<https://github.com/octocat/Hello-World/commit/6dcb09b5b57875f334f61aebed695e2e4193db5e|The title of PR>*\n`
            + ` S'il est alimenté par une variable d'environnement, et que celle-ci n'a pas été alimentée en intégration, la fonctionnalité ne se comportera pas comme attendu.\n`
            + ` Vérifiez leur valeur sur <toto|intégration>`
  
            const message = slackClient.chat.postMessage.getCall(0).firstArg.text;
            const channelId = slackClient.chat.postMessage.getCall(0).firstArg.channel;
            expect(message).to.equal(expectedMessage);
            expect(channelId).to.equal(1);
  
            expect(core.info.getCall(0).args[0]).to.be.equal('GitHub labels team-captains found in PR.')
            expect(core.info.getCall(1).args[0]).to.be.equal('Slack team channel 1 found.')
            expect(core.info.getCall(2).args[0]).to.be.equal('Message sent to channel team-captains')
          })
        })

        context('slack return an error', function () {
          it("should log error 'An error occured while trying to post a Slack message.'", async function () {
            // given
            core.setFailed.returns()
            core.getInput.returns()
            core.info.returns()
            core.getInput.withArgs('INTEGRATION_ENV_URL').returns('toto');
          
            octokit.rest.repos.getCommit.withArgs({
              owner: OWNER,
              repo: REPO_NAME,
              ref: GIT_SHA,
            }).returns(Promise.resolve({
                data: {
                  files: [
                    {
                      filename: 'api/lib/config.js'
                    },
                    {
                      filename: 'marche'
                    }
                  ]
                }
            }))
          
            octokit.rest.repos.listPullRequestsAssociatedWithCommit.withArgs({
              owner: OWNER,
              repo: REPO_NAME,
              commit_sha: GIT_SHA,
            }).returns(Promise.resolve({
              data: prListCommit
            }))
          
            slackClient.conversations.list.returns({
              channels: [
                {
                  name: 'team-captains',
                  id: 1
                }
              ]
            })
          
            slackClient.chat.postMessage.returns({ok: false, message: 'error'})
          
            // when
            await run({ github, SlackWebClient: slack, configFilename: 'api/lib/config.js', core })
          
            // then
            const expectedMessage =  `Le fichier de configuration api/lib/config.js a été modifié dans la PR *<https://github.com/octocat/Hello-World/commit/6dcb09b5b57875f334f61aebed695e2e4193db5e|The title of PR>*\n`
               + ` S'il est alimenté par une variable d'environnement, et que celle-ci n'a pas été alimentée en intégration, la fonctionnalité ne se comportera pas comme attendu.\n`
               + ` Vérifiez leur valeur sur <toto|intégration>`
          
            const message = slackClient.chat.postMessage.getCall(0).firstArg.text;
            const channelId = slackClient.chat.postMessage.getCall(0).firstArg.channel;
            expect(message).to.equal(expectedMessage);
            expect(channelId).to.equal(1);
          
            expect(core.info.getCall(0).args[0]).to.be.equal('GitHub labels team-captains found in PR.')
            expect(core.info.getCall(1).args[0]).to.be.equal('Slack team channel 1 found.')
            expect(core.error.getCall(0).args[0]).to.be.equal('An error occured while trying to post a Slack message.')
          })
        })
      })

      context('slack channel was not found', function () {
        it("should log error 'Channel team-captains not found on slack!'", async function () {
          // given
          core.setFailed.returns()
          core.getInput.returns()
          core.getInput.withArgs('INTEGRATION_ENV_URL').returns('toto');
          core.info.returns()
          octokit.rest.repos.getCommit.withArgs({
            owner: OWNER,
            repo: REPO_NAME,
            ref: GIT_SHA,
          }).returns(Promise.resolve({
              data: {
                files: [
                  {
                    filename: 'api/lib/config.js'
                  },
                  {
                    filename: 'marche'
                  }
                ]
              }
          }))
    
          octokit.rest.repos.listPullRequestsAssociatedWithCommit.withArgs({
            owner: OWNER,
            repo: REPO_NAME,
            commit_sha: GIT_SHA,
          }).returns(Promise.resolve({
            data: prListCommit
          }))
    
          slackClient.conversations.list.returns({
            channels: [
            ]
          })
    
          // when
          await run({ github, SlackWebClient: slack, configFilename: 'api/lib/config.js', core })
          
          // then
          expect(core.info.getCall(0).args[0]).to.be.equal('GitHub labels team-captains found in PR.')
          expect(core.error.getCall(0).args[0]).to.be.equal('Channel team-captains not found on slack!')
        })
      })
    })   
  })
})
