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
});
