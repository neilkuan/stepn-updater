import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { MyStack } from '../src/main';

test('Snapshot', () => {
  const app = new App();
  const stack = new MyStack(app, 'test');

  Template.fromStack(stack).findResources('AWS::Lambda::Function');
  Template.fromStack(stack).findResources('AWS::Events::Rule');
  Template.fromStack(stack).findResources('AWS::DynamoDB::Table');
  Template.fromStack(stack).findResources('AWS::Lambda::Url');


});