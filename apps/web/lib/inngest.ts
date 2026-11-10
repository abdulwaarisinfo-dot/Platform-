import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'flintel',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export type BatchProcessEvent = {
  name: 'batch/process';
  data: {
    batch_job_id: string;
    user_id: string;
  };
};

export type UrlProcessEvent = {
  name: 'url/process';
  data: {
    batch_url_id: string;
    batch_job_id: string;
    user_id: string;
    url: string;
  };
};

export type Events = BatchProcessEvent | UrlProcessEvent;
