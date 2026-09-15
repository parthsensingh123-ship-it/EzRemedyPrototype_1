/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAFAF8',
        ink: '#1C1C1A',
        muted: '#63635C',
        faint: '#928F84',
        hairline: '#DEDBD3',
        panel: '#F2F0EA',
        accent: {
          DEFAULT: '#2F4A52',
          dark: '#22363C',
          light: '#3F6169'
        },
        status: {
          approved: '#3F6B4F',
          approvedBg: '#E9F0EA',
          pending: '#8A6D3B',
          pendingBg: '#F3ECDD',
          cancelled: '#8C3A3A',
          cancelledBg: '#F4E6E4',
          neutral: '#63635C',
          neutralBg: '#EEEDE8'
        }
      },
      fontFamily: {
        display: ['"Newsreader"', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        none: '0px',
        sm: '2px',
        DEFAULT: '4px',
        md: '6px'
      },
      maxWidth: {
        content: '1120px'
      },
      transitionTimingFunction: {
        calm: 'cubic-bezier(0.16, 1, 0.3, 1)'
      }
    }
  },
  plugins: []
};
