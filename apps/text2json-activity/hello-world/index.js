import { mount } from '../runner.js';

mount({
  title: 'Hello World',
  subtitle: 'Extract who is coming and when.',
  messages: [
    { name: 'Amir', id: 'u1', message: 'hey, are we still on for saturday?' },
    { name: 'Priya', id: 'u2', message: 'yes! what time works?' },
    { name: 'Amir', id: 'u1', message: "let's say 7pm at the usual spot" },
    { name: 'Priya', id: 'u2', message: 'sounds good, see you then' },
  ],
  dataBlocks: [
    { label: 'today', content: '2026-09-04' },
  ],
});
