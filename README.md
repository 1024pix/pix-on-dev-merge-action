# Notify team on config file change

## Présentation
Github action qui notifie sur Slack les équipes concernées lorsque le fichier de config de l'API a été modifié.

## Développement
Le code de l'action se trouve dans le fichier `index.js` et la description dans le fichier `action.yml`.
Plus d'info sur comment développer une github action : https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action.

### Créer une nouvelle version
A chaque modification du fichier `index.js`, il faut recompiler l'action à l'aide de cette commande : 
```bash
  npx @vercel/ncc build index.js --license licenses.txt
```

Le résultat dans le dossier `dist` doit être commité avec les modifications.

Créer un tag :
```bash
  git tag -a -m 'v.1.0.0' v1.0.0
```

Pusher le code, avec le nouveau tag :
```bash
  git push --follow-tags
```

## Utiliser l'action
```yml
name: Merge on Dev
on:
  push:
    branches:
      - dev
jobs:
  call-notify-team-on-config-file-change-action:
    runs-on: ubuntu-latest
    steps:
      - name: Call notify team on config file change action
        uses: 1024pix/notify-team-on-config-file-change@v1.0.0
        with:
          GITHUB_TOKEN: ${{ github.token }}
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
          INTEGRATION_ENV_URL: ${{ secrets.INTEGRATION_ENV_URL }}
```

