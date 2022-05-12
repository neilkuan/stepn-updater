import { App, Stack, StackProps, CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as sftasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
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

    // use step function to async invoke lambda.
    const scanTable = new sftasks.CallAwsService(this, 'ScanTable', {
      service: 'dynamodb',
      action: 'scan',
      parameters: {
        TableName: table.tableName,
      },
      iamResources: [table.tableArn],
      timeout: Duration.seconds(10),
      resultSelector: {
        'count.$': '$.Count',
        'inputForMap.$': '$.Items'
      },
    });

    const choice = new stepfunctions.Choice(this, 'Need to send message?!', {
      inputPath: '$',
      outputPath: '$.inputForMap',
    });

    const mapItems = new stepfunctions.Map(this, 'mapItems', {
      maxConcurrency: 100,
      itemsPath: '$',
    });

    mapItems.iterator(new sftasks.LambdaInvoke(this, 'Notify', {
      payload: {
        type: stepfunctions.InputType.OBJECT,
        value: {
          'source': 'aws.statemachine', 
          'CronJob.$': '$' 
        },
      },
      lambdaFunction: fn,
    }));

    choice.when(stepfunctions.Condition.numberLessThan('$.count', 1), new stepfunctions.Succeed(this, 'Not need send message, Done'))
      .when(stepfunctions.Condition.numberGreaterThanEquals('$.count', 1), mapItems);

    const definition = stepfunctions.Chain.start(scanTable)
      .next(choice);

    const machine = new stepfunctions.StateMachine(this, 'StateMachine', {
      definition,
    });

    new events.Rule(this, 'ScheduleRule', {
      schedule: events.Schedule.rate(Duration.minutes(2)),
      targets: [new targets.SfnStateMachine(machine)],
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