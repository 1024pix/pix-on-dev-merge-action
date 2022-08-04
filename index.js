const core = require('@actions/core');
const github = require('@actions/github');
const { WebClient } = require('@slack/web-api');

const CONFIG_FILE_PATH = 'api/lib/config.js';

async function run() {
  try {
    const githubToken = core.getInput('GITHUB_TOKEN');
    const slackBotToken = core.getInput('SLACK_BOT_TOKEN');


    const octokit = github.getOctokit(githubToken);
    const { owner, repo } = github.context.repo;

    const commit = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: github.context.sha
    });

    const teams = [
      { githubLabel: 'team-prescription', slackLabel: 'team-dev-prescription' },
      { githubLabel: 'team-certif', slackLabel: 'team-dev-certification' },
      { githubLabel: 'team-captains', slackLabel: 'team-captains' },
      { githubLabel: 'team-acces', slackLabel: 'team-dev-accès' },
      { githubLabel: 'team-evaluation', slackLabel: 'team-dev-évaluation' },
      { githubLabel: 'team-contenu', slackLabel: 'team-dev-contenus' },
    ];

    const hasConfigFileBeenModified = !!commit.data.files.find((file) => file.filename === CONFIG_FILE_PATH);

    if (hasConfigFileBeenModified) {
      const pullRequests = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha: github.context.sha,
      });

      let pullRequest = pullRequests.data[0];
      const teamLabels = pullRequest.labels
        .filter((label) => label.name.startsWith('team-'))
        .map((label) => label.name);

      core.info(`Labels ${teamLabels} found.`);

      const slackClient = new WebClient(slackBotToken);
      for (const teamLabel of teamLabels) {
        const team = teams.find((team) => team.githubLabel === teamLabel);
        if (team) {
          const channel = team.slackLabel;
          const result = await slackClient.chat.postMessage({
            text: `Le fichier de configuration a été modifié dans la PR *${pullRequest.title}*\n Vérifiez les variables d'environnement `,
            channel,
          });

          if (result.ok) {
            core.info(`Message sent to channel ${teamLabel}`);
          }
        } else {
          core.error(`No team found with github label ${teamLabel}`);
        }
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
