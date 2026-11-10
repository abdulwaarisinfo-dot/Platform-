import { serve } from 'inngest/next';
import { inngest } from '../../../lib/inngest';
import { processBatch, processUrl, usageReset } from '../../../lib/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processBatch, processUrl, usageReset],
});
