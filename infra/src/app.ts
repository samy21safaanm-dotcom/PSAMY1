import * as cdk from "aws-cdk-lib";
import { AiLearningStack } from "./stack";

const app = new cdk.App();

new AiLearningStack(app, "AiLearningStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  description: "AI Learning App — EC2 + RDS + S3",
});
