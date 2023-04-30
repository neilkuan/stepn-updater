const { awscdk, github } = require('projen');
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.23.0',
  defaultReleaseBranch: 'main',
  name: 'stepn-updater',
  deps: [
    'got@^12.6.0',
  ],
  devDeps: [
    'aws-sdk',
    'esbuild',
    '@types/got',
    'coingecko-api-v3',
  ],
  gitignore: ['venv', 'cdk.out'],
  depsUpgradeOptions: {
    workflowOptions: {
      labels: ['auto-approve'],
      projenCredentials: github.GithubCredentials.fromPersonalAccessToken({
        secret: 'AUTO_MACHINE_TOKEN',
      }),
    },
  },
  autoApproveOptions: {
    secret: 'PROJEN_GITHUB_TOKEN',
    allowedUsernames: ['auto-machine', 'neilkuan'],
  },
  typescriptVersion: '4.6',
});
project.synth();