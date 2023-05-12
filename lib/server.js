
async function foundChannel(slackClient, channelName, core) {
  const channels = await slackClient.conversations.list({
    types: 'public_channel,private_channel'
  }).channels

  let result = channels.filter(chan => chan.name === channelName)
  let channelId = undefined

  if (result.length === 0) {
    core.error(`Channel ${channelName} not found on slack!`)
  } else if (result.length > 1) {
    core.error(`More than one channel found on slack : ${result}`)
  } else {
    channelId = result[0].id
    core.info(`Slack team channel ${channelId} found.`)
  }

  return channelId
}

async function sendMessage(slackClient, channel, pullRequest, teamLabel, integrationEnvUrl, configFilename, core) {
  const message = `Le fichier de configuration ${configFilename} a été modifié dans la PR *<${pullRequest.html_url}|${pullRequest.title}>*`
      +  `\n S'il est alimenté par une variable d'environnement, et que celle-ci n'a pas été alimentée en intégration, la fonctionnalité ne se comportera pas comme attendu.`
      +  `\n Vérifiez leur valeur sur <${integrationEnvUrl}|intégration>`

  const slackPostMessageParams = {
    text: message,
    channel,
  }

  core.debug(
    `Using slackClient.chat.postMessage: ${JSON.stringify(slackPostMessageParams)}`
  )

  const result = await slackClient.chat.postMessage(
    slackPostMessageParams
  )

  if (result.ok) {
    core.info(`Message sent to channel ${teamLabel}`)
  } else {
    core.error('An error occured while trying to post a Slack message.')
    core.debug(result)
  }
}

async function run({ github, SlackWebClient, configFilename, core }) {
  try {
    const githubToken = core.getInput('GITHUB_TOKEN', { required: true })
    const slackBotToken = core.getInput('SLACK_BOT_TOKEN', { required: true })
    const integrationEnvUrl = core.getInput('INTEGRATION_ENV_URL', { required: true })

    const octokit = github.getOctokit(githubToken)
    const { owner, repo } = github.context.repo

    const commit = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: github.context.sha,
    })

    const teams = [
      { githubLabel: 'team-prescription', slackLabel: 'team-dev-prescription' },
      { githubLabel: 'team-certif', slackLabel: 'team-dev-certification' },
      { githubLabel: 'team-captains', slackLabel: 'team-captains' },
      { githubLabel: 'team-acces', slackLabel: 'team-dev-accès' },
      { githubLabel: 'team-evaluation', slackLabel: 'team-dev-évaluation' },
      { githubLabel: 'team-contenu', slackLabel: 'team-dev-contenus' },
    ]

    const hasConfigFileBeenModified = !!commit.data.files.find(
      (file) => file.filename === configFilename
    )

    if (hasConfigFileBeenModified) {
      const pullRequests =
        await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
          owner,
          repo,
          commit_sha: github.context.sha,
        })

      const pullRequest = pullRequests.data[0]
      const teamLabels = pullRequest.labels
        .filter((label) => label.name.startsWith('team-'))
        .map((label) => label.name)

      core.info(`GitHub labels ${teamLabels} found in PR.`)

      const slackClient = new SlackWebClient(slackBotToken)

      for (const teamLabel of teamLabels) {
        const team = teams.find((team) => team.githubLabel === teamLabel)

        if (team) {
          const channel = await foundChannel(slackClient, team.slackLabel, core)

          if (channel) {
            sendMessage(slackClient, channel, pullRequest, teamLabel, integrationEnvUrl, configFilename, core)
          }
        } else {
          core.error(`${teamLabel} has been found in pull-request, but has not been setup in code (https://github.com/1024pix/notify-team-on-config-file-change/blob/master/index.js)`)
        }
      }
    } else {
      core.info(`No config file modification detected.`)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

module.exports = run
