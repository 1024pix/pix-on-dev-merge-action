const core = require('@actions/core');
const github = require('@actions/github');
const { WebClient } = require('@slack/web-api');

const CONFIG_FILE_PATH = 'api/lib/config.js';

const teams = [
  { githubLabel: 'team-prescription', slackChannel: 'team-dev-prescription' },
  { githubLabel: 'team-certif', slackChannel: 'team-dev-certification' },
  { githubLabel: 'team-captains', slackChannel: 'team-captains' },
  { githubLabel: 'team-acces', slackChannel: 'team-dev-accès' },
  { githubLabel: 'team-evaluation', slackChannel: 'team-dev-évaluation' },
  { githubLabel: 'team-contenu', slackChannel: 'team-dev-contenus' },
];

async function postSlackMessage(teamLabels, pullRequest) {
  const slackBotToken = core.getInput('SLACK_BOT_TOKEN');
  const integrationEnvUrl = core.getInput('INTEGRATION_ENV_URL');

  const slackClient = new WebClient(slackBotToken);
  const slackChannels = teamLabels
        .map((teamLabel) => {
          return teams.find((team) => team.githubLabel === teamLabel);
        })
        .filter(v => v)
        .map((team) => team.slackChannel);

  if (slackChannels.length > 0) {
    for (const channel of slackChannels) {
      const result = await slackClient.chat.postMessage({
        text: `Le fichier de configuration a été modifié dans la PR *${pullRequest.title}*\n Vérifiez les variables d'environnement d' <${integrationEnvUrl}|intégration>`,
        channel,
      });

      if (result.ok) {
        core.info(`Message sent to channel ${channel}`);
      }
    }
  }
}

async function run() {
  try {
    const githubToken = core.getInput('GITHUB_TOKEN');

    const octokit = github.getOctokit(githubToken);
    const { owner, repo } = github.context.repo;

    const commit = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: github.context.sha
    });

    const hasConfigFileBeenModified = !!commit.data.files.find((file) => file.filename === CONFIG_FILE_PATH);

    if (hasConfigFileBeenModified) {
      const pullRequests = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha: github.context.sha,
      });

      const pullRequest = pullRequests.data[0];
      const teamLabels = pullRequest.labels
        .filter((label) => label.name.startsWith('team-'))
        .map((label) => label.name);

      core.info(`Labels ${teamLabels} found.`);

      await postSlackMessage(teamsLabels, pullRequest);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
