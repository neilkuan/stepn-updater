const { awscdk } = require('projen');
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.23.0',
  defaultReleaseBranch: 'main',
  name: 'stepn-updater',
  devDeps: [
    'got',
    'aws-sdk',
    'esbuild',
    '@types/got',
    'coingecko-api-v3',
  ],
  gitignore: ['venv', 'cdk.out'],
  depsUpgradeOptions: {
    workflowOptions: {
      labels: ['auto-approve'],
    },
  },
  autoApproveOptions: {
    secret: 'GITHUB_TOKEN',
    allowedUsernames: ['neilkuan'],
  },
});
project.synth();