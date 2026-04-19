import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import * as fs from "fs";
import * as path from "path";

export class AiLearningStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // ── VPC ──────────────────────────────────────────────────────────────
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: "Public",  subnetType: ec2.SubnetType.PUBLIC,           cidrMask: 24 },
        { name: "Private", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
      ],
    });

    // ── S3 bucket ─────────────────────────────────────────────────────────
    const bucket = new s3.Bucket(this, "FilesBucket", {
      bucketName: `ai-learning-files-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
    });

    // ── RDS — PostgreSQL ──────────────────────────────────────────────────
    const dbSecret = new secretsmanager.Secret(this, "DbSecret", {
      secretName: "ai-learning/db-credentials",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "appuser" }),
        generateStringKey: "password",
        excludePunctuation: true,
        passwordLength: 24,
      },
    });

    const dbSg = new ec2.SecurityGroup(this, "DbSg", {
      vpc,
      description: "RDS security group",
      allowAllOutbound: false,
    });

    const db = new rds.DatabaseInstance(this, "Database", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSg],
      credentials: rds.Credentials.fromSecret(dbSecret),
      databaseName: "ailearning",
      multiAz: false,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageEncrypted: true,
      deletionProtection: false,           // set true for production
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      backupRetention: cdk.Duration.days(7),
    });

    // ── EC2 security group ────────────────────────────────────────────────
    const ec2Sg = new ec2.SecurityGroup(this, "Ec2Sg", {
      vpc,
      description: "EC2 app server",
      allowAllOutbound: true,
    });
    ec2Sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80),  "HTTP");
    ec2Sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "HTTPS");
    ec2Sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22),  "SSH — restrict to your IP in production");

    // Allow EC2 → RDS
    dbSg.addIngressRule(ec2Sg, ec2.Port.tcp(5432), "EC2 to RDS");

    // ── IAM role for EC2 ──────────────────────────────────────────────────
    const ec2Role = new iam.Role(this, "Ec2Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
      ],
    });

    // S3 access
    bucket.grantReadWrite(ec2Role);

    // Translate + Bedrock
    ec2Role.addToPolicy(new iam.PolicyStatement({
      actions: ["translate:TranslateText"],
      resources: ["*"],
    }));
    ec2Role.addToPolicy(new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel"],
      resources: ["*"],
    }));

    // Read DB secret
    dbSecret.grantRead(ec2Role);

    // ── User data — bootstrap script ──────────────────────────────────────
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      // System updates
      "yum update -y",
      "yum install -y git nginx",

      // Node.js 20 via NodeSource
      "curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -",
      "yum install -y nodejs",

      // PM2 process manager
      "npm install -g pm2",

      // App directory
      "mkdir -p /opt/app",
      "chown ec2-user:ec2-user /opt/app",

      // Nginx config
      `cat > /etc/nginx/conf.d/app.conf << 'NGINX'
server {
    listen 80;
    server_name _;

    # Serve React build
    root /opt/app/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API to Express
    location ~ ^/(upload|files|extract|translate|generate-lesson|generate-images|generate-simulation) {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 15M;
    }
}
NGINX`,

      "systemctl enable nginx",
      "systemctl start nginx",

      // Signal that instance is ready
      "echo 'Bootstrap complete' > /var/log/bootstrap.log"
    );

    // ── EC2 instance ──────────────────────────────────────────────────────
    const instance = new ec2.Instance(this, "AppServer", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: ec2Sg,
      role: ec2Role,
      userData,
      keyName: "ai-learning-key",
      blockDevices: [
        {
          deviceName: "/dev/xvda",
          volume: ec2.BlockDeviceVolume.ebs(20, { encrypted: true }),
        },
      ],
    });

    // Elastic IP so the address survives stop/start
    const eip = new ec2.CfnEIP(this, "AppEip", { instanceId: instance.instanceId });

    // ── Outputs ───────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, "AppPublicIp",    { value: eip.ref,                        description: "EC2 Elastic IP" });
    new cdk.CfnOutput(this, "AppUrl",         { value: `http://${eip.ref}`,             description: "Application URL" });
    new cdk.CfnOutput(this, "BucketName",     { value: bucket.bucketName,               description: "S3 bucket name" });
    new cdk.CfnOutput(this, "DbEndpoint",     { value: db.dbInstanceEndpointAddress,    description: "RDS endpoint" });
    new cdk.CfnOutput(this, "DbSecretArn",    { value: dbSecret.secretArn,              description: "DB credentials secret ARN" });
    new cdk.CfnOutput(this, "SshCommand",     { value: `ssh ec2-user@${eip.ref}`,       description: "SSH command" });
  }
}
