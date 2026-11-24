export interface TemplateFieldSpec {
  column: string;
  required: boolean;
  example: string;
  notes: string;
}

export interface CsvTemplateDefinition {
  id: 'CDR' | 'IPDR';
  title: string;
  fileName: string;
  description: string;
  rowCount: number;
  fields: TemplateFieldSpec[];
  instructions: string[];
  csvContent: string;
}

export const STANDARD_CDR_TEMPLATE: CsvTemplateDefinition = {
  id: 'CDR',
  title: 'Standardized CDR CSV Template',
  fileName: 'trace_intel_cdr_template.csv',
  description:
    'Canonical Call Detail Record format with all required and optional normalized headers plus 5 synthetic example rows.',
  rowCount: 5,
  fields: [
    {
      column: 'caller_number',
      required: true,
      example: '+91-98290-10001',
      notes: 'Originating phone number (MSISDN)',
    },
    {
      column: 'receiver_number',
      required: true,
      example: '+91-98290-20011',
      notes: 'Terminating phone number (MSISDN)',
    },
    {
      column: 'call_type',
      required: false,
      example: 'OUTGOING',
      notes: 'OUTGOING, INCOMING, SMS_OUT, or SMS_IN (defaults to OUTGOING)',
    },
    {
      column: 'timestamp',
      required: true,
      example: '2026-11-20T09:15:30Z',
      notes: 'ISO-8601 UTC timestamp (rows with invalid timestamps are rejected)',
    },
    {
      column: 'duration_seconds',
      required: false,
      example: '185',
      notes: 'Non-negative integer duration in seconds (use 0 for SMS)',
    },
    {
      column: 'cell_id',
      required: false,
      example: 'TWR-JPR-04',
      notes: 'Cell tower identifier (matches synthetic tower reference list)',
    },
    {
      column: 'imei',
      required: false,
      example: '354829104412001',
      notes: '15-digit handset IMEI (leave blank if absent in operator export)',
    },
    {
      column: 'imsi',
      required: false,
      example: '404451009810001',
      notes: '15-digit SIM subscriber IMSI',
    },
    {
      column: 'operator',
      required: false,
      example: 'Airtel-Demo',
      notes: 'Telecom operator label',
    },
  ],
  instructions: [
    'Keep the first header row intact so TRACE INTEL auto-maps all 9 columns immediately on upload.',
    'Format timestamps in ISO-8601 UTC (YYYY-MM-DDTHH:MM:SSZ). Exact duplicate rows are automatically deduplicated.',
    'Leave optional cells blank rather than inventing values; missing IMEI or Cell ID fields are preserved and flagged for review.',
    'Use synthetic demonstration data only—never upload real personal telecom records.',
  ],
  csvContent: [
    'caller_number,receiver_number,call_type,timestamp,duration_seconds,cell_id,imei,imsi,operator',
    '+91-98290-10001,+91-98290-20011,OUTGOING,2026-11-20T09:15:30Z,185,TWR-JPR-04,358910224490882,404451009810001,Airtel-Demo',
    '+91-98290-20011,+91-98290-10002,INCOMING,2026-11-20T10:42:12Z,240,TWR-JPR-02,864209051120334,405854009810002,Jio-Demo',
    '+91-98290-10003,+91-98290-20013,OUTGOING,2026-11-20T14:08:55Z,96,TWR-JPR-07,359011882340559,404200009810003,Vi-Demo',
    '+91-98290-10004,+91-98290-30101,SMS_OUT,2026-11-20T22:35:04Z,0,TWR-JPR-03,357712009914228,404451009810004,Airtel-Demo',
    '+91-98290-20012,+91-98290-10001,SMS_IN,2026-11-20T23:48:19Z,0,TWR-JPR-07,358910224490882,404451009810001,Airtel-Demo',
  ].join('\n'),
};

export const STANDARD_IPDR_TEMPLATE: CsvTemplateDefinition = {
  id: 'IPDR',
  title: 'Standardized IPDR CSV Template',
  fileName: 'trace_intel_ipdr_template.csv',
  description:
    'Canonical IP Detail Record format with public NAT IP, ports, timestamps, protocol, and subscriber mapping plus 5 synthetic example rows.',
  rowCount: 5,
  fields: [
    {
      column: 'public_ip',
      required: true,
      example: '198.51.100.14',
      notes: 'Public NAT IPv4 address (RFC 5737 TEST-NET in demo data)',
    },
    {
      column: 'source_port',
      required: true,
      example: '48210',
      notes: 'Integer NAT source port (1–65535)',
    },
    {
      column: 'destination_ip',
      required: true,
      example: '192.0.2.44',
      notes: 'Remote destination IPv4 address',
    },
    {
      column: 'destination_port',
      required: false,
      example: '443',
      notes: 'Destination port (443, 5222, 3478, 8443, 53, etc.)',
    },
    {
      column: 'session_start',
      required: true,
      example: '2026-11-20T09:10:00Z',
      notes: 'ISO-8601 UTC session start timestamp (required for validation)',
    },
    {
      column: 'session_end',
      required: false,
      example: '2026-11-20T09:28:45Z',
      notes: 'ISO-8601 UTC session end timestamp (defaults to session_start)',
    },
    {
      column: 'subscriber_id',
      required: false,
      example: '+91-98290-10001',
      notes: 'ISP-mapped subscriber MSISDN or "Unmapped (CGNAT)"',
    },
    {
      column: 'protocol',
      required: false,
      example: 'TCP',
      notes: 'TCP, UDP, QUIC, or ICMP (defaults to TCP)',
    },
    {
      column: 'operator',
      required: false,
      example: 'Airtel-Demo',
      notes: 'ISP / telecom operator name',
    },
    {
      column: 'bytes_transferred',
      required: false,
      example: '1542800',
      notes: 'Total bytes transferred during session (integer)',
    },
  ],
  instructions: [
    'Keep the first header row intact so TRACE INTEL auto-detects IPDR format and maps all 10 columns automatically.',
    'Provide session_start and session_end in ISO-8601 UTC format; duplicate public_ip + source_port + destination_ip + session_start rows are deduplicated.',
    'Use "Unmapped (CGNAT)" or leave subscriber_id blank when ISP subscriber correlation is unavailable.',
    'Use synthetic TEST-NET IPs (192.0.2.x, 198.51.100.x, 203.0.113.x) for demonstration datasets.',
  ],
  csvContent: [
    'public_ip,source_port,destination_ip,destination_port,session_start,session_end,subscriber_id,protocol,operator,bytes_transferred',
    '198.51.100.14,48210,192.0.2.44,443,2026-11-20T09:10:00Z,2026-11-20T09:28:45Z,+91-98290-10001,TCP,Airtel-Demo,1542800',
    '198.51.100.42,51904,192.0.2.91,3478,2026-11-20T10:35:15Z,2026-11-20T10:51:02Z,+91-98290-10002,UDP,Jio-Demo,4920300',
    '203.0.113.19,39011,192.0.2.88,5222,2026-11-20T14:02:10Z,2026-11-20T14:16:30Z,+91-98290-10003,TCP,Vi-Demo,392400',
    '198.51.100.28,57420,192.0.2.120,443,2026-11-20T22:30:00Z,2026-11-20T22:55:18Z,+91-98290-10001,QUIC,Airtel-Demo,3180400',
    '203.0.113.77,60114,192.0.2.53,53,2026-11-20T23:44:05Z,2026-11-20T23:44:12Z,Unmapped (CGNAT),UDP,Jio-Demo,18420',
  ].join('\n'),
};
