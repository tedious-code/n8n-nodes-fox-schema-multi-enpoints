import { buildTargetUrl, executeSingleEndpoint } from '../src/utils/httpClient';
import { EndpointDefinition, PipelineRuntimeContext } from '../src/types';

describe('HTTP Client & Target URL', () => {
  it('builds target URLs correctly with or without base URL', () => {
    expect(buildTargetUrl('https://api.external.com/test', 'https://api.internal.com')).toBe(
      'https://api.external.com/test'
    );
    expect(buildTargetUrl('/users/list', 'https://api.internal.com/v1/')).toBe(
      'https://api.internal.com/v1/users/list'
    );
    expect(buildTargetUrl('users/list', 'https://api.internal.com/v1')).toBe(
      'https://api.internal.com/v1/users/list'
    );
  });

  it('executes single endpoint using mock httpHelper', async () => {
    const mockContext: PipelineRuntimeContext = {
      json: { customerId: 99 },
      pipeline: {},
      steps: [],
      itemIndex: 0,
    };

    const endpoint: EndpointDefinition = {
      alias: 'fetchCustomer',
      method: 'GET',
      url: 'https://api.test.com/customers/{{ $json.customerId }}',
      dataPath: 'data',
    };

    const mockHelper = jest.fn().mockResolvedValue({
      statusCode: 200,
      body: {
        data: { id: 99, name: 'Sample Customer' },
      },
      headers: { 'content-type': 'application/json' },
    });

    const result = await executeSingleEndpoint(endpoint, mockContext, {}, mockHelper);

    expect(mockHelper).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.test.com/customers/99',
        method: 'GET',
      })
    );
    expect(result.success).toBe(true);
    expect(result.alias).toBe('fetchCustomer');
    expect(result.data).toEqual({ id: 99, name: 'Sample Customer' });
  });

  it('handles JSON body with expressions and custom fields', async () => {
    const mockContext: PipelineRuntimeContext = {
      json: { userId: 'usr_123', age: 30 },
      pipeline: {
        auth: {
          alias: 'auth',
          statusCode: 200,
          success: true,
          data: { token: 'jwt-abc' },
          durationMs: 10,
        },
      },
      steps: [],
      itemIndex: 0,
    };

    const endpoint: EndpointDefinition = {
      alias: 'createUser',
      method: 'POST',
      url: 'https://api.test.com/users',
      sendBody: true,
      bodyContentType: 'json',
      bodyInputMethod: 'fields',
      bodyFields: [
        { key: 'id', value: '{{ $json.userId }}', type: 'string' },
        { key: 'age', value: '{{ $json.age }}', type: 'number' },
        { key: 'isActive', value: 'true', type: 'boolean' },
      ],
    };

    const mockHelper = jest.fn().mockResolvedValue({
      statusCode: 201,
      body: { success: true },
      headers: {},
    });

    await executeSingleEndpoint(endpoint, mockContext, {}, mockHelper);

    expect(mockHelper).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: {
          id: 'usr_123',
          age: 30,
          isActive: true,
        },
        json: true,
      })
    );
  });

  it('handles form-urlencoded body correctly', async () => {
    const mockContext: PipelineRuntimeContext = {
      json: { clientSecret: 'sec_xyz' },
      pipeline: {},
      steps: [],
      itemIndex: 0,
    };

    const endpoint: EndpointDefinition = {
      alias: 'oauthToken',
      method: 'POST',
      url: 'https://api.test.com/oauth/token',
      sendBody: true,
      bodyContentType: 'formUrlencoded',
      formFields: [
        { key: 'grant_type', value: 'client_credentials' },
        { key: 'client_secret', value: '{{ $json.clientSecret }}' },
      ],
    };

    const mockHelper = jest.fn().mockResolvedValue({
      statusCode: 200,
      body: { access_token: 'tok_123' },
      headers: {},
    });

    await executeSingleEndpoint(endpoint, mockContext, {}, mockHelper);

    expect(mockHelper).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
        body: 'grant_type=client_credentials&client_secret=sec_xyz',
      })
    );
  });
});
