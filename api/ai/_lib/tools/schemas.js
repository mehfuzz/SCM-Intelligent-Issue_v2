// JSON schemas for every tool the leadership chatbot can call.
//
// We deliberately type all integer params as `oneOf:[integer,string]` and
// the handlers coerce. Reason: Llama 3.3 on Groq sometimes emits numbers
// as strings (e.g. `"n": "5"`), and Groq's strict tool validator hard-
// rejects the call before we ever see it — collapsing the whole tool
// loop with `tool_use_failed`. Accepting the string at the schema level
// avoids the rejection without losing intent.

const numberOrString = (extra = {}) => ({
  oneOf: [
    { type: 'integer', ...extra },
    { type: 'string',  pattern: '^[0-9]+$' },
  ],
});

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
          limit:      numberOrString({ minimum: 1, maximum: 50 }),
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
          metric:   { type: 'string', enum: ['count','sum_savings','avg_days_open'] },
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
          metric:  { type: 'string', enum: ['composite','cost_savings','days_open','people'] },
          n:       numberOrString({ minimum: 1, maximum: 10 }),
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
          metric:   { type: 'string', enum: ['count','sum_savings','avg_days_open'] },
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
        properties: { weeks: numberOrString({ minimum: 1, maximum: 12 }) },
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
          x_key:  { type: 'string' },
          y_keys: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
];
