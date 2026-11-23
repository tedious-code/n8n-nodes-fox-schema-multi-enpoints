import { resolveTemplateValue, evaluateTemplateString } from '../src/utils/expressionResolver';
import { PipelineRuntimeContext } from '../src/types';

describe('Expression Resolver', () => {
  const sampleContext: PipelineRuntimeContext = {
    json: {
      userId: 42,
      name: 'Alice',
      tags: ['admin', 'billing'],
    },
    pipeline: {
      auth: {
        alias: 'auth',
        statusCode: 200,
        success: true,
        data: {
          token: 'jwt-xyz-123',
          expiresIn: 3600,
        },
        durationMs: 45,
      },
      profile: {
        alias: 'profile',
        statusCode: 200,
        success: true,
        data: {
          role: 'director',
          departments: ['engineering', 'product'],
        },
        durationMs: 50,
      },
    },
    steps: [],
    prev: undefined,
    itemIndex: 0,
  };

  // Populate steps and prev
  sampleContext.steps = [sampleContext.pipeline.auth, sampleContext.pipeline.profile];
  sampleContext.prev = sampleContext.pipeline.profile;

  it('interpolates $json values in strings', () => {
    const template = 'https://api.example.com/users/{{ $json.userId }}';
    const result = evaluateTemplateString(template, sampleContext);
    expect(result).toBe('https://api.example.com/users/42');
  });

  it('interpolates pipeline step values in strings', () => {
    const template = 'Bearer {{ $pipeline.auth.data.token }}';
    const result = evaluateTemplateString(template, sampleContext);
    expect(result).toBe('Bearer jwt-xyz-123');
  });

  it('preserves underlying raw object when expression is the sole token', () => {
    const template = '{{ $pipeline.profile.data.departments }}';
    const result = resolveTemplateValue(template, sampleContext);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(['engineering', 'product']);
  });

  it('resolves $steps index and $prev', () => {
    expect(resolveTemplateValue('{{ $steps[0].data.token }}', sampleContext)).toBe('jwt-xyz-123');
    expect(resolveTemplateValue('{{ $prev.data.role }}', sampleContext)).toBe('director');
  });

  it('recursively resolves nested objects and arrays', () => {
    const payload = {
      user: '{{ $json.name }}',
      token: '{{ $pipeline.auth.data.token }}',
      meta: {
        departments: '{{ $pipeline.profile.data.departments }}',
      },
    };

    const resolved = resolveTemplateValue(payload, sampleContext);
    expect(resolved).toEqual({
      user: 'Alice',
      token: 'jwt-xyz-123',
      meta: {
        departments: ['engineering', 'product'],
      },
    });
  });
});
