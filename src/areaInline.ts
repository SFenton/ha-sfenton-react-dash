/**
 * Per-area inline content configuration.
 * Defines what sections appear directly on each area page
 * (not just in popups), matching the HA dashboard layout.
 */
import type { AreaRoute } from './routes';

interface InlineButton {
  label: string;
  /** Entity to toggle, or popup hash to open (prefix with #) */
  action: string;
  icon?: string;
}

interface InlineSection {
  title: string;
  buttons?: InlineButton[];
  /** For media/device sections with a popup */
  popupHash?: string;
  popupTitle?: string;
}

export interface AreaInlineConfig {
  sections: InlineSection[];
}

export const AREA_INLINE: Partial<Record<AreaRoute, AreaInlineConfig>> = {
  'living-room': {
    sections: [
      {
        title: 'Climate',
        buttons: [
          { label: 'Vents', action: '#living-room-vents', icon: '🌀' },
          { label: 'Air Purifier', action: '#living-room-aqi', icon: '🌬' },
        ],
      },
      {
        title: 'Devices',
        buttons: [
          { label: 'Robot Vacuum', action: '#living-room-vacuum', icon: '🤖' },
        ],
      },
      {
        title: 'SHIELD',
        buttons: [
          { label: 'SHIELD Remote', action: '#living-room-shield', icon: '🎮' },
        ],
      },
    ],
  },

  'master-bedroom': {
    sections: [
      {
        title: 'Climate',
        buttons: [
          { label: 'Vents', action: '#master-bedroom-vents', icon: '🌀' },
          { label: 'Air Purifier', action: '#master-bedroom-aqi', icon: '🌬' },
          { label: 'Humidifier', action: '#master-bedroom-humidifier', icon: '💧' },
        ],
      },
      {
        title: 'Beds',
        buttons: [
          { label: "Stephen's Bed", action: '#stephens-bed', icon: '🛏' },
          { label: "Steph's Bed", action: '#stephs-bed', icon: '🛏' },
        ],
      },
      {
        title: 'Media',
        buttons: [
          { label: 'Apple TV', action: '#master-bedroom-apple-tv', icon: '📺' },
        ],
      },
    ],
  },

  'theater-room': {
    sections: [
      {
        title: 'Climate',
        buttons: [
          { label: 'Vents', action: '#theater-room-vents', icon: '🌀' },
          { label: 'Air Purifier', action: '#theater-room-aqi', icon: '🌬' },
        ],
      },
      {
        title: 'Media Controls',
        buttons: [
          { label: 'SHIELD Remote', action: '#theater-room-shield', icon: '🎮' },
          { label: 'Nintendo Switch', action: '#theater-room-switch', icon: '🕹' },
        ],
      },
      {
        title: 'Theater Room PCs',
        buttons: [
          { label: 'Theater Room PC', action: '#theater-room-pc', icon: '💻' },
        ],
      },
      {
        title: 'Devices',
        buttons: [
          { label: 'Robot Vacuum', action: '#theater-room-vacuum', icon: '🤖' },
        ],
      },
    ],
  },

  'music-room': {
    sections: [
      {
        title: 'Climate',
        buttons: [
          { label: 'Vents', action: '#music-room-vents', icon: '🌀' },
          { label: 'Air Purifier', action: '#music-room-aqi', icon: '🌬' },
        ],
      },
      {
        title: 'Devices',
        buttons: [
          { label: 'Robot Vacuum', action: '#music-room-vacuum', icon: '🤖' },
        ],
      },
    ],
  },

  'back-deck': {
    sections: [
      {
        title: 'Grill',
        buttons: [
          { label: 'Bear Grills', action: '#bear-grills', icon: '🔥' },
        ],
      },
    ],
  },

  office: {
    sections: [
      {
        title: 'Climate',
        buttons: [
          { label: 'Vent', action: '#office-vents', icon: '🌀' },
          { label: 'Air Purifier', action: '#office-aqi', icon: '🌬' },
        ],
      },
      {
        title: 'Office PCs',
        buttons: [
          { label: "Stephen's PC", action: '#stephens-pc', icon: '💻' },
          { label: "Steph's PC", action: '#stephs-pc', icon: '💻' },
        ],
      },
    ],
  },

  kitchen: {
    sections: [
      {
        title: 'Climate',
        buttons: [
          { label: 'Vent', action: '#kitchen-vents', icon: '🌀' },
        ],
      },
    ],
  },

  'guest-room': {
    sections: [
      {
        title: 'Climate',
        buttons: [
          { label: 'Vent', action: '#guest-room-vents', icon: '🌀' },
          { label: 'Air Purifier', action: '#guest-room-aqi', icon: '🌬' },
        ],
      },
    ],
  },

  gym: {
    sections: [
      {
        title: 'Climate',
        buttons: [
          { label: 'Vent', action: '#gym-vents', icon: '🌀' },
        ],
      },
    ],
  },

  'dining-room': {
    sections: [
      {
        title: 'Climate',
        buttons: [
          { label: 'Vent', action: '#dining-room-vents', icon: '🌀' },
        ],
      },
    ],
  },

  garage: {
    sections: [
      {
        title: 'Garage Doors',
        buttons: [
          { label: 'Left Door', action: 'cover.left_door', icon: '🚗' },
          { label: 'Right Door', action: 'cover.right_door', icon: '🚗' },
        ],
      },
    ],
  },
};
