// JSON schemas for every tool the leadership chatbot can call.
//
// These follow the OpenAI / Groq function-calling spec. Gemini uses a
// slightly trimmed flavour (no `additionalProperties`); the provider
// adapter handles that conversion. Keep the parameter set small — each
// tool should answer a clear class of question.

export const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'query_tickets',
      description:
        'Fetch matching tickets, ordered newest first, up to 50 rows. Use when the user wants a specific list of tickets.',
      parameters: {
        type: 'object',
        properties: {
          module:     { type: 'string', description: 'SCM module name, e.g. PO, SOW, Contract.' },
          function:   { type: 'string', description: 'Business function name, e.g. Network, ToCo.' },
          priority:   { type: 'string', enum: ['P0','P1','P2','P3'] },
          status:     { type: 'string', enum: ['Submitted','Triaged','POC Assigned','In Progress','Pending Validation','Closed','Reopened'] },
          compliance: { type: 'string', enum: ['Yes','No'] },
          since:      { type: 'string', description: 'ISO date to filter submitted_at >=' },
          limit:      { type: 'integer', minimum: 1, maximum: 50, default: 25 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'aggregate',
      description:
        'Group tickets by one field and compute a metric. Use for totals / breakdowns.',
      parameters: {
        type: 'object',
        required: ['group_by'],
        properties: {
          group_by: { type: 'string', enum: ['module','function','priority','status','category','compliance_risk'] },
          metric:   { type: 'string', enum: ['count','sum_savings','avg_days_open'], default: 'count' },
          filters: {
            type: 'object',
            properties: {
              module:   { type: 'string' },
              function: { type: 'string' },
              status:   { type: 'string' },
              priority: { type: 'string' },
            },
          },
          time_range: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'ISO date' },
              to:   { type: 'string', description: 'ISO date' },
            },
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'top_n',
      description:
        'Return the top N tickets ranked by a metric. Use for "highest impact", "longest open", etc.',
      parameters: {
        type: 'object',
        properties: {
          metric:  { type: 'string', enum: ['composite','cost_savings','days_open','people'], default: 'composite' },
          n:       { type: 'integer', minimum: 1, maximum: 10, default: 5 },
          filters: {
            type: 'object',
            properties: {
              module:   { type: 'string' },
              priority: { type: 'string' },
              status:   { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_periods',
      description: 'Compare a metric between two date ranges. Use for "Q1 vs Q2", "this month vs last".',
      parameters: {
        type: 'object',
        required: ['period_a','period_b'],
        properties: {
          metric:   { type: 'string', enum: ['count','sum_savings','avg_days_open'], default: 'count' },
          period_a: { type: 'object', required: ['from','to'], properties: { from: { type:'string' }, to: { type:'string' } } },
          period_b: { type: 'object', required: ['from','to'], properties: { from: { type:'string' }, to: { type:'string' } } },
          filters: {
            type: 'object',
            properties: { module:{type:'string'}, function:{type:'string'}, priority:{type:'string'} },
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forecast',
      description: 'Simple submission-volume forecast per module for the next N weeks.',
      parameters: {
        type: 'object',
        properties: { weeks: { type: 'integer', minimum: 1, maximum: 12, default: 4 } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'chart',
      description:
        'Return a Recharts-compatible spec the UI will render inline. Use when a visual makes the answer clearer.',
      parameters: {
        type: 'object',
        required: ['type','data'],
        properties: {
          type:   { type: 'string', enum: ['bar','line','pie'] },
          title:  { type: 'string' },
          data:   {
            type: 'array',
            description: 'Array of {name, value} or {name, series1, series2, ...}',
            items: { type: 'object' },
          },
          x_key:  { type: 'string', default: 'name' },
          y_keys: { type: 'array', items: { type: 'string' }, default: ['value'] },
        },
      },
    },
  },
];
