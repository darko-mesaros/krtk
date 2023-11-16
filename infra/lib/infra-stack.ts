import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    

    
    // DYNAMODB TABLE
    const urlTable = new ddb.Table(this, 'urlTable',{
      tableName: 'krtkUrls',
      partitionKey: {
        name: 'UrlId',
        type: ddb.AttributeType.STRING,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    // COGNITO

    // PERMISSIONS
    const getPolicy = new iam.Policy(this, 'getPolicy',{
      statements: [
        new iam.PolicyStatement({
          actions: ['dynamodb:GetItem'],
          effect: iam.Effect.ALLOW,
          resources: [urlTable.tableArn]
        }),
      ],
    });

    const scanPolicy = new iam.Policy(this, 'scanPolicy',{
      statements: [
        new iam.PolicyStatement({
          actions: ['dynamodb:Scan'],
          effect: iam.Effect.ALLOW,
          resources: [urlTable.tableArn]
        }),
      ],
    });

    const deletePolicy = new iam.Policy(this, 'deletePolicy',{
      statements: [
        new iam.PolicyStatement({
          actions: ['dynamodb:DeleteItem'],
          effect: iam.Effect.ALLOW,
          resources: [urlTable.tableArn]
        }),
      ],
    });
    const putPolicy = new iam.Policy(this, 'putPolicy',{
      statements: [
        new iam.PolicyStatement({
          actions: ['dynamodb:PutItem'],
          effect: iam.Effect.ALLOW,
          resources: [urlTable.tableArn]
        }),
      ],
    });

    const getRole = new iam.Role(this, 'getRole',{
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com')
    });
    getRole.attachInlinePolicy(getPolicy);

    const scanRole = new iam.Role(this, 'scanRole',{
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com')
    });
    scanRole.attachInlinePolicy(scanPolicy);

    const deleteRole = new iam.Role(this, 'deleteRole',{
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com')
    });
    deleteRole.attachInlinePolicy(deletePolicy);
    
    const putRole = new iam.Role(this, 'putRole',{
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com')
    });
    putRole.attachInlinePolicy(putPolicy);

    // API GATEWAY
    const api = new apigateway.RestApi(this, 'urlApi',{
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
      },
      restApiName: 'krtkUrls'
    });
    const urls = api.root.addResource('{urls}');

    // INTEGRATIONS

    const errorResponses = [
      {
        selectionPattern: '400',
        statusCode: '400',
        responseTemplates: {
          'application/json': `{
            "error": "Bad input!"
          }`,
        },
      },
      {
        selectionPattern: '5\\d{2}',
        statusCode: '500',
        responseTemplates: {
          'application/json': `{
            "error": "Internal Service Error!"
          }`,
        },
      },
    ];

    const integrationResponses = [
      {
        statusCode: '200',
      },
      ...errorResponses,
    ];

    const getAllIntegration = new apigateway.AwsIntegration({
      action: 'Scan',
      options: {
        credentialsRole: scanRole,
        integrationResponses,
        requestTemplates: {
          'application/json': `{
            "TableName": "krtkUrls"
          }`,
        }
      },
      service: 'dynamodb',

    });

    const createIntegration = new apigateway.AwsIntegration({
      action: 'PutItem',
      options: {
        credentialsRole: putRole,
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': `{
                "requestId": "$context.requestId"
              }`,
            },
          },
          ...errorResponses,
        ],
        requestTemplates: {
          'application/json': `{
            "Item": {
              "UrlId":{
                "S": "$context.requestId"
              },
              "url":{
                "S": "$input.params('url')"
              }
            },
            "TableName": "${urlTable.tableName}"
          }`,
        },
      },
      service: 'dynamodb'
    });
    
    const getIntegration = new apigateway.AwsIntegration({
      action: 'GetItem',
      options: {
        credentialsRole: getRole,
        integrationResponses,
        requestTemplates: {
          'application/json': `{
            "Key": {
              "UrlId": {
                "S": "$method.request.path.id"
              }
            },
            "TableName": "${urlTable.tableName}"
          }`,
        },
      },
      service: 'dynamodb'
    });

    const methodOptions = { methodResponses: [
      { statusCode: '200'},
      { statusCode: '400'},
      { statusCode: '500'}
    ]};

    api.root.addMethod('GET', getAllIntegration,methodOptions)
    api.root.addMethod('POST', createIntegration ,methodOptions)

    urls.addMethod('GET', getIntegration, methodOptions)


  }
}
