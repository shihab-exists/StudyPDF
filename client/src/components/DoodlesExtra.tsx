import React from 'react';

type P = React.SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 24) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none' });

export const WhatsAppIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path
      d="M12 2.6a9.3 9.3 0 00-8 14.1L2.8 21.4l4.8-1.2A9.3 9.3 0 1012 2.6z"
      fill="#25D366"
      stroke="#0d6b4e"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path
      d="M8.6 8.2c.2-.5.4-.5.6-.5h.5c.2 0 .4 0 .5.4l.6 1.5c.1.2 0 .4-.1.5l-.4.5c-.1.2-.2.3 0 .6.2.4.7 1.2 1.5 1.9 1 .9 1.8 1.1 2.1 1.3.3.1.5.1.6-.1l.6-.7c.2-.2.3-.2.6-.1l1.4.7c.3.1.4.2.4.4 0 .2 0 .8-.3 1.2-.3.4-1.2.9-1.7.9-.5.1-1 .2-3.2-.7-2.7-1.1-4.4-3.9-4.5-4.1-.1-.2-1.1-1.5-1.1-2.9 0-1.3.7-2 .9-2.3z"
      fill="#fff"
    />
  </svg>
);
