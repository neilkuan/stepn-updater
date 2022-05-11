import { App, Stack, StackProps, CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { TelegrambotFunction } from './telegrambot-function';
export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);
    const table = new dynamodb.Table(this, 'table', {
      tableName: 'stepn-notify-user',
      partitionKey: {
        name: 'chat_id',
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const fn = new TelegrambotFunction(this, 'TelegrambotFunction', {
      environment: {
        API_KEY: `${process.env.TELEGRAM_NOTIFY}`,
        TABLE: table.tableName,
      },
      logRetention: logs.RetentionDays.THREE_DAYS,
      timeout: Duration.seconds(60),
      memorySize: 512,
    });

    table.grantFullAccess(fn);

    const url = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    new CfnOutput(this, 'url', {
      value: `${url.url}`,
    });

    const schedule = events.Schedule.rate(Duration.minutes(2));
    new events.Rule(this, 'scheduleRule', {
      schedule,
      targets: [new eventsTargets.LambdaFunction(fn)],
    });
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};

const app = new App();

new MyStack(app, 'tg-notify-dev', { env: devEnv });
// new MyStack(app, 'my-stack-prod', { env: prodEnv });

app.synth();