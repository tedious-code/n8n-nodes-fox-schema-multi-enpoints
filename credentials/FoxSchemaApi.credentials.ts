import {
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class FoxSchemaApi implements ICredentialType {
  name = 'foxSchemaApi';
  displayName = 'FoxSchema Multi-Endpoint API';
  documentationUrl = 'https://github.com/tedious-code/n8n-nodes-fox-schema-multi-enpoints';
  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: '',
      placeholder: 'https://api.example.com/v1',
      description: 'Default Base URL prepended to relative endpoint URLs',
    },
    {
      displayName: 'API Token / Secret Key',
      name: 'apiToken',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      description: 'Bearer token or secret key to include in API calls',
    },
    {
      displayName: 'Header Name',
      name: 'headerName',
      type: 'string',
      default: 'Authorization',
      description: 'HTTP Header used to send authentication',
    },
    {
      displayName: 'Prefix',
      name: 'headerPrefix',
      type: 'string',
      default: 'Bearer ',
      description: 'Prefix added to the token (e.g. "Bearer " or empty)',
    },
  ];
}
