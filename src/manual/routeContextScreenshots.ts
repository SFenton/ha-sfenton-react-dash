import { TODO_PAGES } from '../constants/portedDashboard'
import { DASHBOARD_ROUTES } from '../constants/routes'
import { roomCardFamilyArticleId, roomCardFamilySurfaceId } from './roomCardFamilies'
import type { ManualScreenshotConfig } from './screenshots'

export interface ManualRouteContextTodoItem {
  due?: string
  status: 'completed' | 'needs_action'
  summary: string
  uid: string
}

export interface ManualRouteContextInventoryItem {
  expiry_date?: string | null
  id: number
  location: string
  name: string
  product_id?: number
  quantity?: number
  unit?: string
  vacuum_sealed?: boolean
}

export interface ManualRouteContextFixture {
  entityStates?: Record<string, string>
  inventoryByLocation?: Record<string, ManualRouteContextInventoryItem[]>
  todoItemsByEntity?: Record<string, ManualRouteContextTodoItem[]>
}

export interface ManualRouteContextScreenshotConfig extends ManualScreenshotConfig {
  focusBottomPadding?: number
  focusSelector?: string
  fixture?: ManualRouteContextFixture
  routePath: string
}

type ManualRouteContextInput = Omit<
  ManualRouteContextScreenshotConfig,
  'articleId' | 'id' | 'role' | 'scenarioId' | 'surfaceId'
>

function defineRouteContext(input: ManualRouteContextInput): ManualRouteContextScreenshotConfig {
  const route = DASHBOARD_ROUTES.find((candidate) => candidate.path === input.routePath)
  if (!route) throw new Error(`Unknown dashboard route context: ${input.routePath}`)
  const id = `${input.routePath}-page-context`
  return {
    ...input,
    articleId: route.manualArticleId,
    id,
    role: 'context',
    scenarioId: id,
    surfaceId: `route:${input.routePath}`,
  }
}

function syntheticTodoItem(summary: string, uid: string): ManualRouteContextTodoItem {
  return { status: 'needs_action', summary, uid }
}

function syntheticTodoFixture(
  configPath: keyof typeof TODO_PAGES,
  selectedEntityId?: string,
  selectedItems: ManualRouteContextTodoItem[] = [],
): ManualRouteContextFixture {
  const config = TODO_PAGES[configPath]
  return {
    todoItemsByEntity: Object.fromEntries(
      config.lists.map((list) => [
        list.entityId,
        list.entityId === selectedEntityId ? selectedItems : [],
      ]),
    ),
  }
}

function syntheticInventoryItem(
  id: number,
  location: string,
  name: string,
  quantity = 2,
): ManualRouteContextInventoryItem {
  return {
    expiry_date: '2030-01-15',
    id,
    location,
    name,
    product_id: 90_000 + id,
    quantity,
    unit: 'items',
    vacuum_sealed: false,
  }
}

export const MANUAL_ROUTE_CONTEXT_FORBIDDEN_FIXTURE_TEXT = [
  'Mock task one',
  'Mock task two',
  'Mock task description',
  'Almond Flour',
  'Canned Beans',
  'Cumin',
  'Frozen Peas',
  'Greek Yogurt',
  'Milk',
  'Paper Plates',
  'Paprika',
  'Salsa',
  'Tea Bags',
  'Waffles',
  'Ziti',
] as const

export const MANUAL_ROUTE_CONTEXT_SCREENSHOTS: ManualRouteContextScreenshotConfig[] = [
  defineRouteContext({
    routePath: 'all-food',
    cropSelector: '[data-app-shell="true"]',
    requiredTargets: ['All Food', 'Synthetic All-Food Item', 'Synthetic Fridge Item', 'Quantity 2', 'Search inventory', 'Sort', 'Filter', 'Scan Item'],
    coveredSurfaceIds: [
      'floating-action.inventory-search',
      'floating-action.inventory-sort',
      'floating-action.inventory-filter',
      'floating-action.scan-item',
    ],
    surfaceTargetEvidence: {
      'route:all-food': ['All Food', 'Synthetic All-Food Item', 'Synthetic Fridge Item', 'Quantity 2'],
      'floating-action.inventory-search': ['Search inventory'],
      'floating-action.inventory-sort': ['Sort'],
      'floating-action.inventory-filter': ['Filter'],
      'floating-action.scan-item': ['Scan Item'],
    },
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    desktopCaptureWidth: 820,
    mobileMaxWidth: 393,
    maxViewportHeightRatio: 1,
    fixture: {
      inventoryByLocation: {
        all: [
          syntheticInventoryItem(601, 'dispensa', 'Synthetic All-Food Item'),
          syntheticInventoryItem(602, 'frigo', 'Synthetic Fridge Item', 1),
        ],
      },
    },
    alsoUsedByArticleIds: ['food-inventory', 'food-scanning'],
    alt: 'All Food route showing two synthetic inventory rows and the Search, Sort, Filter, and Scan Item dock.',
    caption: 'What is on the All Food page? It combines every storage location with the real inventory and scanning action dock.',
  }),
  defineRouteContext({
    routePath: 'back-deck',
    cropSelector: '[data-route-path="back-deck"]',
    requiredTargets: ['Back Deck', 'Lights', 'Occupancy', 'Clear', 'Doors', 'All Closed', 'Grill', 'Bear Grills', 'cooking'],
    coveredSurfaceIds: [roomCardFamilySurfaceId('contact'), roomCardFamilySurfaceId('grill')],
    surfaceTargetEvidence: {
      'route:back-deck': ['Back Deck', 'Lights', 'Occupancy', 'Doors', 'Grill', 'Bear Grills'],
      [roomCardFamilySurfaceId('contact')]: ['Doors', 'All Closed'],
      [roomCardFamilySurfaceId('grill')]: ['Grill', 'Bear Grills', 'cooking'],
    },
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 320,
    desktopCropHeight: 330,
    maxViewportHeightRatio: 0.9,
    fixture: {
      entityStates: {
        'light.back_deck': 'on',
        'binary_sensor.upper_deck_camera_person_occupancy': 'off',
        'binary_sensor.back_deck_doors': 'off',
        'sensor.d8478fa2ad0a_grill_state': 'cooking',
      },
    },
    alsoUsedByArticleIds: [roomCardFamilyArticleId('contact'), roomCardFamilyArticleId('grill')],
    alt: 'Back Deck route showing synthetic light and occupancy summaries above the active Grill card.',
    caption: 'Where are Back Deck controls? The header holds light and occupancy status, while the Grill section opens Bear Grills.',
  }),
  defineRouteContext({
    routePath: 'cabinet',
    cropSelector: '[data-route-path="cabinet"]',
    requiredTargets: ['Cabinet', 'Synthetic Cabinet Item', 'Quantity 2'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 180,
    desktopCropHeight: 180,
    maxViewportHeightRatio: 0.9,
    fixture: {
      inventoryByLocation: {
        cabinet: [syntheticInventoryItem(603, 'cabinet', 'Synthetic Cabinet Item')],
      },
    },
    alt: 'Cabinet route showing an explicitly synthetic inventory row and its stock summary.',
    caption: 'What does Cabinet show? It lists privacy-safe synthetic cabinet stock with quantity and expiration status.',
  }),
  defineRouteContext({
    routePath: 'custom-lights',
    cropSelector: '[data-route-path="custom-lights"]',
    requiredTargets: ['Custom Lights', 'Front Yard', 'Manually Control Front Yard Lights', 'Reset All Lights'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 720,
    desktopCropHeight: 720,
    maxViewportHeightRatio: 0.92,
    fixture: {
      entityStates: {
        'input_boolean.manually_control_front_yard_lights': 'on',
        'input_select.front_yard_custom_lights': 'Custom',
        'light.front_door_exterior_left_light': 'on',
        'light.front_door_exterior_light_v2': 'off',
        'light.front_door_bollard_1': 'on',
        'light.front_door_bollard_2': 'off',
      },
    },
    alt: 'Custom Lights route showing synthetic manual mode and the first front-yard light controls.',
    caption: 'How do I begin using Custom Lights? Enable manual control, then adjust the individual Front Yard fixtures shown below it.',
  }),
  defineRouteContext({
    routePath: 'dining-room',
    cropSelector: '[data-route-path="dining-room"]',
    requiredTargets: ['Dining Room', 'Light', 'Climate', 'Occupancy', 'Vent'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 340,
    desktopCropHeight: 360,
    maxViewportHeightRatio: 0.9,
    fixture: {
      entityStates: {
        'light.dining_room_dimmer_switch': 'on',
        'input_text.dining_room_climate_range': '69°F - 71°F',
        'binary_sensor.dining_room_presence_sensor_presence': 'off',
        'binary_sensor.dining_room_door_contact_sensor_contact': 'off',
        'cover.dining_room_vent_vent': 'open',
      },
    },
    alt: 'Dining Room route showing synthetic header summaries and the room Vent card.',
    caption: 'Where is Dining Room comfort information? The header summarizes the room, and the Climate section opens its Vent.',
  }),
  defineRouteContext({
    routePath: 'downstairs-hallway',
    cropSelector: '[data-route-path="downstairs-hallway"]',
    requiredTargets: ['Downstairs Hallway', 'Light', 'Climate', 'Nothing Here Yet!', 'Once some devices are added to this room'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 660,
    desktopCropHeight: 660,
    maxViewportHeightRatio: 0.92,
    fixture: {
      entityStates: {
        'light.downstairs_hallway_light': 'off',
        'input_text.downstairs_hallway_climate_range': '68°F - 70°F',
        'binary_sensor.downstairs_hallway_presence_sensor_presence': 'off',
        'binary_sensor.garage_door_contact_sensor_contact': 'off',
      },
    },
    alt: 'Downstairs Hallway route showing synthetic header summaries and the intentional Nothing Here Yet explanation.',
    caption: 'Why is the Downstairs Hallway body empty? Its header summaries still work; there are simply no additional configured cards yet.',
  }),
  defineRouteContext({
    routePath: 'entryway',
    cropSelector: '[data-route-path="entryway"]',
    requiredTargets: ['Entryway', 'Light', 'Occupancy', 'Nothing Here Yet!', 'Once some devices are added to this room'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 660,
    desktopCropHeight: 660,
    maxViewportHeightRatio: 0.92,
    fixture: {
      entityStates: {
        'switch.upper_entryway_light_switch_top': 'on',
        'binary_sensor.entryway_presence_sensors': 'off',
        'input_text.front_door_climate_range': '67°F - 70°F',
        'binary_sensor.front_door_contact_sensor_contact': 'off',
      },
    },
    alt: 'Entryway route showing synthetic header summaries and the intentional Nothing Here Yet explanation.',
    caption: 'Why does Entryway say Nothing Here Yet? The header is the complete current control surface, with no extra body cards configured.',
  }),
  defineRouteContext({
    routePath: 'freezer',
    cropSelector: '[data-route-path="freezer"]',
    requiredTargets: ['Freezer', 'Synthetic Freezer Item', 'Quantity 2'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 180,
    desktopCropHeight: 180,
    maxViewportHeightRatio: 0.9,
    fixture: {
      inventoryByLocation: {
        freezer: [syntheticInventoryItem(604, 'freezer', 'Synthetic Freezer Item')],
      },
    },
    alt: 'Freezer route showing an explicitly synthetic inventory row and its stock summary.',
    caption: 'What does Freezer show? It lists privacy-safe synthetic freezer stock with quantity and expiration status.',
  }),
  defineRouteContext({
    routePath: 'fridge',
    cropSelector: '[data-route-path="fridge"]',
    requiredTargets: ['Fridge', 'Synthetic Fridge Item', 'Quantity 2'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 180,
    desktopCropHeight: 180,
    maxViewportHeightRatio: 0.9,
    fixture: {
      inventoryByLocation: {
        frigo: [syntheticInventoryItem(605, 'frigo', 'Synthetic Fridge Item')],
      },
    },
    alt: 'Fridge route showing an explicitly synthetic inventory row and its stock summary.',
    caption: 'What does Fridge show? It lists privacy-safe synthetic refrigerated stock with quantity and expiration status.',
  }),
  defineRouteContext({
    routePath: 'garage',
    cropSelector: '[data-route-path="garage"]',
    requiredTargets: ['Garage', 'Doors', 'Appliances', 'Washing Machine', 'On', 'Dryer', 'Off'],
    coveredSurfaceIds: [roomCardFamilySurfaceId('laundry')],
    surfaceTargetEvidence: {
      'route:garage': ['Garage', 'Doors', 'Appliances', 'Washing Machine', 'Dryer'],
      [roomCardFamilySurfaceId('laundry')]: ['Washing Machine', 'On', 'Dryer', 'Off'],
    },
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 680,
    desktopCropHeight: 570,
    maxViewportHeightRatio: 0.9,
    fixture: {
      entityStates: {
        'binary_sensor.garage_doors': 'off',
        'input_boolean.washer_started_helper': 'on',
        'input_boolean.dryer_started_helper': 'off',
        'cover.left_door': 'closed',
        'cover.right_door': 'closed',
      },
    },
    alsoUsedByArticleIds: [roomCardFamilyArticleId('laundry')],
    alt: 'Garage route showing a synthetic Doors summary and washer and dryer status cards.',
    caption: 'Where do I check Garage equipment? The header summarizes doors, and Appliances shows the washer and dryer states.',
  }),
  defineRouteContext({
    routePath: 'groceries',
    cropSelector: '[data-app-shell="true"]',
    requiredTargets: ['Groceries', 'Grocery List', 'Synthetic grocery item', 'Add Groceries'],
    coveredSurfaceIds: ['floating-action.add-groceries'],
    surfaceTargetEvidence: {
      'route:groceries': ['Groceries', 'Grocery List', 'Synthetic grocery item'],
      'floating-action.add-groceries': ['Add Groceries'],
    },
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    desktopCaptureWidth: 820,
    mobileMaxWidth: 393,
    maxViewportHeightRatio: 1,
    fixture: syntheticTodoFixture(
      'groceries',
      'todo.shopping_list',
      [syntheticTodoItem('Synthetic grocery item', 'manual-groceries-1--None')],
    ),
    alsoUsedByArticleIds: ['task-manage-grocery-item'],
    alt: 'Groceries route showing one synthetic shopping-list row and the Add Groceries floating action.',
    caption: 'Where do chore groceries appear? The shared Grocery List keeps its privacy-safe row and Add Groceries action together.',
  }),
  defineRouteContext({
    routePath: 'grocery-list',
    cropSelector: '[data-route-path="grocery-list"]',
    requiredTargets: ['Groceries', 'Grocery List', 'Synthetic pantry restock'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 200,
    desktopCropHeight: 200,
    maxViewportHeightRatio: 0.9,
    fixture: syntheticTodoFixture(
      'groceries',
      'todo.shopping_list',
      [syntheticTodoItem('Synthetic pantry restock', 'manual-grocery-list-1--None')],
    ),
    alt: 'Grocery List route showing one explicitly synthetic restock row.',
    caption: 'Where does the Food area open its grocery list? This route presents the shared list with a privacy-safe synthetic restock item.',
  }),
  defineRouteContext({
    routePath: 'guest-bathroom',
    cropSelector: '[data-route-path="guest-bathroom"]',
    requiredTargets: ['Guest Bathroom', 'Light', 'Climate', 'Vent', 'Open', 'Fan', 'On', 'Towel Rack'],
    coveredSurfaceIds: [roomCardFamilySurfaceId('fan')],
    surfaceTargetEvidence: {
      'route:guest-bathroom': ['Guest Bathroom', 'Light', 'Climate', 'Vent', 'Fan', 'Towel Rack'],
      [roomCardFamilySurfaceId('fan')]: ['Fan', 'On'],
    },
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 580,
    desktopCropHeight: 500,
    maxViewportHeightRatio: 0.9,
    fixture: {
      entityStates: {
        'light.guest_bathroom_dimmer_switch': 'off',
        'input_text.all_climate_range': '68°F - 72°F',
        'binary_sensor.guest_bathroom_occupancy_sensors': 'off',
        'cover.guest_bathroom_vent_vent': 'open',
        'switch.guest_bathroom_fan_switch_top': 'on',
        'switch.guest_bathroom_towel_rack_switch_top': 'off',
      },
    },
    alsoUsedByArticleIds: [roomCardFamilyArticleId('fan')],
    alt: 'Guest Bathroom route showing synthetic light and climate summaries with Vent, Fan, and Towel Rack cards.',
    caption: 'What can I control in the Guest Bathroom? Its Climate section groups the Vent, Fan, and Towel Rack below the header summaries.',
  }),
  defineRouteContext({
    routePath: 'guest-room',
    cropSelector: '[data-route-path="guest-room"]',
    requiredTargets: ['Guest Room', 'Lights', 'Climate', '69°F - 71°F', 'Occupancy', 'Clear', 'Vent', 'Open', 'Air Purifier', 'Auto • On'],
    coveredSurfaceIds: [
      roomCardFamilySurfaceId('air'),
      roomCardFamilySurfaceId('climate'),
      roomCardFamilySurfaceId('vent'),
    ],
    surfaceTargetEvidence: {
      'route:guest-room': ['Guest Room', 'Lights', 'Climate', 'Occupancy', 'Vent', 'Air Purifier'],
      [roomCardFamilySurfaceId('air')]: ['Air Purifier', 'Auto • On'],
      [roomCardFamilySurfaceId('climate')]: ['Climate', '69°F - 71°F'],
      [roomCardFamilySurfaceId('vent')]: ['Vent', 'Open'],
    },
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 540,
    desktopCropHeight: 400,
    maxViewportHeightRatio: 0.9,
    fixture: {
      entityStates: {
        'light.guest_room': 'on',
        'input_text.guest_room_climate_range': '69°F - 71°F',
        'binary_sensor.guest_room_occupancy_sensors': 'off',
        'binary_sensor.guest_room_window_contact_sensor_contact': 'off',
        'sensor.guest_room_air_purifier_pm2_5': '3',
        'cover.guest_room_vent_vent': 'open',
        'select.guest_room_air_purifier_fan_mode': 'Auto',
        'fan.guest_room_air_purifier_levoit_purifier': 'on',
      },
    },
    alsoUsedByArticleIds: [
      roomCardFamilyArticleId('air'),
      roomCardFamilyArticleId('climate'),
      roomCardFamilyArticleId('vent'),
    ],
    alt: 'Guest Room route showing synthetic header summaries with Vent and Air Purifier cards.',
    caption: 'Where are Guest Room comfort controls? The header summarizes the room, while Climate opens the Vent and Air Purifier.',
  }),
  defineRouteContext({
    routePath: 'gym',
    cropSelector: '[data-route-path="gym"]',
    requiredTargets: ['Gym', 'Light', 'Climate', 'Occupancy', 'Detected', 'Vent', 'Open'],
    coveredSurfaceIds: [roomCardFamilySurfaceId('occupancy')],
    surfaceTargetEvidence: {
      'route:gym': ['Gym', 'Light', 'Climate', 'Occupancy', 'Vent'],
      [roomCardFamilySurfaceId('occupancy')]: ['Occupancy', 'Detected'],
    },
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 370,
    desktopCropHeight: 360,
    maxViewportHeightRatio: 0.9,
    fixture: {
      entityStates: {
        'light.gym_light': 'on',
        'input_text.gym_climate_range': '68°F - 70°F',
        'binary_sensor.gym_presence_sensor_presence': 'on',
        'binary_sensor.gym_window_contact_sensor_contact': 'off',
        'cover.gym_vent_vent': 'open',
      },
    },
    alsoUsedByArticleIds: [roomCardFamilyArticleId('occupancy')],
    alt: 'Gym route showing synthetic light, climate, and occupancy summaries above its Vent card.',
    caption: 'What is on the Gym page? Four header summaries provide the room check, and Climate contains the single Vent.',
  }),
  defineRouteContext({
    routePath: 'hallway',
    cropSelector: '[data-route-path="hallway"]',
    requiredTargets: ['Hallway', 'Lights', 'Climate', 'Nothing Here Yet!', 'Once some devices are added to this room'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 660,
    desktopCropHeight: 660,
    maxViewportHeightRatio: 0.92,
    fixture: {
      entityStates: {
        'light.hallway_lights': 'on',
        'input_text.hallway_climate_range': '68°F - 71°F',
        'binary_sensor.hallway_occupancy_sensors': 'off',
      },
    },
    alt: 'Hallway route showing synthetic header summaries and the intentional Nothing Here Yet explanation.',
    caption: 'Why does Hallway say Nothing Here Yet? Its header summaries remain usable; only the body has no additional configured cards.',
  }),
  defineRouteContext({
    routePath: 'home-improvement-chores',
    cropSelector: '[data-route-path="home-improvement-chores"]',
    requiredTargets: ['Home Improvement Tasks', 'Due Today', 'Synthetic project task'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 200,
    desktopCropHeight: 200,
    maxViewportHeightRatio: 0.9,
    fixture: syntheticTodoFixture(
      'home-improvement-chores',
      'todo.home_improvement_s_due_today',
      [syntheticTodoItem('Synthetic project task', 'manual-home-project-1--None')],
    ),
    alt: 'Home Improvement Tasks route showing one explicitly synthetic Due Today task.',
    caption: 'Where are active home projects listed? Home Improvement Tasks groups privacy-safe synthetic work by due bucket.',
  }),
  defineRouteContext({
    routePath: 'kitchen',
    cropSelector: '[data-route-path="kitchen"]',
    focusSelector: '#section-appliances',
    requiredTargets: ['Kitchen', 'Lights', 'Climate', 'Appliances', 'Dishwasher', 'Not Running'],
    coveredSurfaceIds: [roomCardFamilySurfaceId('appliance')],
    surfaceTargetEvidence: {
      'route:kitchen': ['Kitchen', 'Lights', 'Climate', 'Appliances', 'Dishwasher'],
      [roomCardFamilySurfaceId('appliance')]: ['Appliances', 'Dishwasher', 'Not Running'],
    },
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 500,
    desktopCropHeight: 540,
    maxViewportHeightRatio: 0.9,
    fixture: {
      entityStates: {
        'light.kitchen': 'on',
        'input_text.kitchen_climate_range': '69°F - 72°F',
        'binary_sensor.kitchen_presence_sensor_presence': 'on',
        'binary_sensor.kitchen_door_contact_sensor_contact': 'off',
        'select.dishwasher_selected_program': 'dishcare_dishwasher_program_eco_50',
        'sensor.dishwasher_operation_state': 'ready',
        'sensor.dishwasher_program_progress': '0',
        'input_boolean.dishwasher_clean_unopened': 'off',
        'cover.kitchen_vent_vent': 'open',
      },
    },
    alsoUsedByArticleIds: [roomCardFamilyArticleId('appliance')],
    alt: 'Kitchen route showing synthetic header summaries and a not-running Dishwasher card in Appliances.',
    caption: 'Where is the Kitchen dishwasher? Scroll past Groceries to Appliances, where its current synthetic status appears.',
  }),
  defineRouteContext({
    routePath: 'master-bathroom',
    cropSelector: '[data-route-path="master-bathroom"]',
    requiredTargets: ['Master Bathroom', 'Light', 'Climate', 'Vent', 'Fan', 'Towel Rack'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 570,
    desktopCropHeight: 500,
    maxViewportHeightRatio: 0.9,
    fixture: {
      entityStates: {
        'light.master_bathroom_dimmer_switch': 'on',
        'input_text.all_climate_range': '68°F - 72°F',
        'binary_sensor.master_bathroom_presence_sensor_presence': 'off',
        'cover.master_bathroom_vent_vent': 'closed',
        'switch.master_bathroom_fan_switch_top': 'off',
        'switch.master_bathroom_towel_rack_switch_top': 'on',
      },
    },
    alt: 'Master Bathroom route showing synthetic light and climate summaries with Vent, Fan, and Towel Rack cards.',
    caption: 'What can I control in the Master Bathroom? Climate groups the Vent, Fan, and Towel Rack below the header summaries.',
  }),
  defineRouteContext({
    routePath: 'master-bedroom',
    cropSelector: '[data-route-path="master-bedroom"]',
    focusBottomPadding: 520,
    focusSelector: '#section-climate',
    requiredTargets: ['Master Bedroom', 'Climate', 'Vents', 'Open', 'Air Purifier', 'Auto • On', 'Humidifier', 'Humidifying • 46%'],
    coveredSurfaceIds: [roomCardFamilySurfaceId('humidifier')],
    surfaceTargetEvidence: {
      'route:master-bedroom': ['Master Bedroom', 'Climate', 'Vents', 'Air Purifier', 'Humidifier'],
      [roomCardFamilySurfaceId('humidifier')]: ['Humidifier', 'Humidifying • 46%'],
    },
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 750,
    desktopCropHeight: 700,
    maxViewportHeightRatio: 1,
    excludeSelectors: [
      '[data-modal-opener-exception="floating-action"]',
      'nav[aria-label="Dashboard sections"]',
    ],
    fixture: {
      entityStates: {
        'light.master_bedroom': 'off',
        'input_text.master_bedroom_climate_range': '69°F - 72°F',
        'binary_sensor.master_bedroom_occupancy_sensors': 'off',
        'binary_sensor.master_bedroom_street_window_contact_sensor_contact': 'off',
        'sensor.master_bedroom_air_purifier_pm2_5': '2',
        'climate.sleepypod_eight_pod_left_side': 'heat',
        'climate.sleepypod_eight_pod_right_side': 'off',
        'cover.master_bedroom_vents': 'open',
        'select.master_bedroom_air_purifier_fan_mode': 'Auto',
        'fan.master_bedroom_air_purifier_levoit_purifier': 'on',
        'switch.lv600s_humidifier_power': 'on',
        'sensor.lv600s_humidifier_current_humidity': '46',
      },
    },
    alsoUsedByArticleIds: [roomCardFamilyArticleId('humidifier')],
    alt: 'Master Bedroom route focused on synthetic Vent, Air Purifier, and Humidifier cards without personal schedule data.',
    caption: 'Where is the Master Bedroom humidifier? The Climate section keeps it beside the room vents and air purifier.',
  }),
  defineRouteContext({
    routePath: 'music-room',
    cropSelector: '[data-route-path="music-room"]',
    focusSelector: '#section-devices',
    requiredTargets: ['Music Room', 'Lights', 'Climate', 'Devices', 'Docked', '82%'],
    coveredSurfaceIds: [roomCardFamilySurfaceId('vacuum')],
    surfaceTargetEvidence: {
      'route:music-room': ['Music Room', 'Lights', 'Climate', 'Devices', 'Docked', '82%'],
      [roomCardFamilySurfaceId('vacuum')]: ['Devices', 'Docked', '82%'],
    },
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 700,
    desktopCropHeight: 560,
    maxViewportHeightRatio: 0.9,
    fixture: {
      entityStates: {
        'light.music_room': 'on',
        'input_text.music_room_climate_range': '68°F - 71°F',
        'binary_sensor.music_room_occupancy_sensors': 'off',
        'binary_sensor.music_room_door_contact_sensor_contact': 'off',
        'sensor.air_purifier_pm2_5': '4',
        'cover.music_room_vent_vent': 'open',
        'select.air_purifier_fan_mode': 'Auto',
        'fan.air_purifier_levoit_purifier': 'on',
        'vacuum.valetudo_elatedusedram': 'docked',
        'sensor.valetudo_elatedusedram_battery_level': '82',
      },
    },
    alsoUsedByArticleIds: [roomCardFamilyArticleId('vacuum')],
    alt: 'Music Room route showing synthetic header summaries and a docked robot in Devices.',
    caption: 'Where is the Music Room robot? The Devices section shows its current synthetic dock and battery status.',
  }),
  defineRouteContext({
    routePath: 'office',
    cropSelector: '[data-route-path="office"]',
    focusSelector: '#section-office-pcs',
    requiredTargets: ['Office', 'Light', 'Climate', 'Office PCs', "Stephen's PC", 'Off', "Steph's PC", 'On'],
    coveredSurfaceIds: [roomCardFamilySurfaceId('power')],
    surfaceTargetEvidence: {
      'route:office': ['Office', 'Light', 'Climate', 'Office PCs', "Stephen's PC", "Steph's PC"],
      [roomCardFamilySurfaceId('power')]: ['Office PCs', "Stephen's PC", 'Off', "Steph's PC", 'On'],
    },
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 700,
    desktopCropHeight: 560,
    maxViewportHeightRatio: 0.9,
    fixture: {
      entityStates: {
        'light.office_light': 'on',
        'input_text.office_climate_range': '69°F - 72°F',
        'binary_sensor.office_occupancy_sensors': 'on',
        'binary_sensor.office_windows': 'off',
        'sensor.office_air_purifier_pm2_5': '3',
        'cover.office_vent_vent': 'open',
        'select.office_air_purifier_fan_mode': 'Auto',
        'fan.office_air_purifier_levoit_purifier': 'on',
        'input_boolean.stephen_s_pc_power': 'off',
        'input_boolean.steph_s_pc_power': 'on',
        'input_text.stephen_s_pc_power_state': 'Off',
        'input_text.steph_s_pc_power_state': 'On',
      },
    },
    alsoUsedByArticleIds: [roomCardFamilyArticleId('power'), 'task-run-pc-power-command'],
    alt: 'Office route showing synthetic room summaries and the two state-aware PC power cards.',
    caption: 'Where are Office computer commands? Office PCs shows each machine separately so its current state selects the intended power branch.',
  }),
  defineRouteContext({
    routePath: 'pantry',
    cropSelector: '[data-route-path="pantry"]',
    requiredTargets: ['Pantry', 'Synthetic Pantry Item', 'Quantity 2'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 180,
    desktopCropHeight: 180,
    maxViewportHeightRatio: 0.9,
    fixture: {
      inventoryByLocation: {
        dispensa: [syntheticInventoryItem(606, 'dispensa', 'Synthetic Pantry Item')],
      },
    },
    alt: 'Pantry route showing an explicitly synthetic inventory row and its stock summary.',
    caption: 'What does Pantry show? It lists privacy-safe synthetic pantry stock with quantity and expiration status.',
  }),
  defineRouteContext({
    routePath: 'spice-rack',
    cropSelector: '[data-route-path="spice-rack"]',
    requiredTargets: ['Spice Rack', 'Synthetic Spice-Rack Item', 'Quantity 2'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 180,
    desktopCropHeight: 180,
    maxViewportHeightRatio: 0.9,
    fixture: {
      inventoryByLocation: {
        spice_rack: [syntheticInventoryItem(607, 'spice_rack', 'Synthetic Spice-Rack Item')],
      },
    },
    alt: 'Spice Rack route showing an explicitly synthetic inventory row and its stock summary.',
    caption: 'What does Spice Rack show? It lists privacy-safe synthetic spice-rack stock with quantity and expiration status.',
  }),
  defineRouteContext({
    routePath: 'stephens-chores',
    cropSelector: '[data-route-path="stephens-chores"]',
    requiredTargets: ["Stephen's Chores", 'Due Today', 'Synthetic due-today chore'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 200,
    desktopCropHeight: 200,
    maxViewportHeightRatio: 0.9,
    fixture: syntheticTodoFixture(
      'stephens-chores',
      'todo.stephen_s_due_today',
      [syntheticTodoItem('Synthetic due-today chore', 'manual-stephens-1--None')],
    ),
    alsoUsedByArticleIds: ['task-complete-household-task'],
    alt: "Stephen's Chores route showing one explicitly synthetic Due Today completion row.",
    caption: "Where are Stephen's current chores? The page groups privacy-safe synthetic tasks by due bucket.",
  }),
  defineRouteContext({
    routePath: 'stephs-chores',
    cropSelector: '[data-route-path="stephs-chores"]',
    requiredTargets: ["Steph's Chores", 'Due Today', 'Synthetic assigned chore'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 200,
    desktopCropHeight: 200,
    maxViewportHeightRatio: 0.9,
    fixture: syntheticTodoFixture(
      'stephs-chores',
      'todo.steph_s_due_today',
      [syntheticTodoItem('Synthetic assigned chore', 'manual-stephs-1--None')],
    ),
    alt: "Steph's Chores route showing one explicitly synthetic Due Today task.",
    caption: "Where are Steph's current chores? The page groups privacy-safe synthetic tasks by due bucket.",
  }),
  defineRouteContext({
    routePath: 'theater-room',
    cropSelector: '[data-route-path="theater-room"]',
    focusSelector: '#section-remote',
    requiredTargets: ['Theater Room', 'Remote', 'Theater Remote', 'Nintendo Switch', 'Theater SHIELD'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 740,
    desktopCropHeight: 660,
    maxViewportHeightRatio: 0.92,
    fixture: {
      entityStates: {
        'light.theater_room': 'off',
        'input_text.theater_room_climate_range': '68°F - 71°F',
        'binary_sensor.theater_room_presence_sensor_presence': 'off',
        'binary_sensor.theater_room_door_contact_sensor_contact': 'off',
        'sensor.theater_room_air_purifier_pm2_5': '2',
        'cover.theater_room_vents': 'open',
        'select.theater_room_air_purifier_fan_mode': 'Auto',
        'fan.theater_room_air_purifier_levoit_purifier': 'on',
        'media_player.sony_projector': 'on',
        'input_boolean.is_theater_shield_active': 'on',
        'input_boolean.is_nintendo_switch_active': 'off',
        'media_player.theater_room_shield': 'idle',
        'input_boolean.theater_pc_power': 'off',
        'vacuum.valetudo_politefatherlykingfisher': 'docked',
      },
    },
    alt: 'Theater Room route focused on the synthetic Remote group with a full-width Theater Remote button above Nintendo Switch and Theater SHIELD.',
    caption: 'Where do I choose Theater sources? Remote leads with the full-width remote opener, keeps the two direct source buttons in their own grid below it, and Quick App Launch follows.',
  }),
  defineRouteContext({
    routePath: 'to-do',
    cropSelector: '[data-app-shell="true"]',
    requiredTargets: ['To-Do', 'No To-Do Tasks', 'Use Add Task', 'Add Task'],
    coveredSurfaceIds: ['floating-action.add-admin-task'],
    surfaceTargetEvidence: {
      'route:to-do': ['To-Do', 'No To-Do Tasks', 'Use Add Task'],
      'floating-action.add-admin-task': ['Add Task'],
    },
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    desktopCaptureWidth: 820,
    mobileMaxWidth: 393,
    maxViewportHeightRatio: 1,
    fixture: syntheticTodoFixture('to-do'),
    alt: 'To-Do route showing the privacy-safe empty summary and the Add Task floating action.',
    caption: 'What appears when Admin To-Do is empty? The page explains the empty state and keeps Add Task visible.',
  }),
  defineRouteContext({
    routePath: 'unassigned-chores',
    cropSelector: '[data-route-path="unassigned-chores"]',
    requiredTargets: ['Unassigned Chores', 'Due Today', 'Synthetic shared chore'],
    privacyClass: 'synthetic',
    desktopMaxWidth: 820,
    mobileMaxWidth: 393,
    cropHeight: 200,
    desktopCropHeight: 200,
    maxViewportHeightRatio: 0.9,
    fixture: syntheticTodoFixture(
      'unassigned-chores',
      'todo.unassigned_due_today',
      [syntheticTodoItem('Synthetic shared chore', 'manual-unassigned-1--None')],
    ),
    alt: 'Unassigned Chores route showing one explicitly synthetic Due Today task.',
    caption: 'Where are chores without an owner? Unassigned Chores groups privacy-safe synthetic shared work by due bucket.',
  }),
]

export const MANUAL_ROUTE_CONTEXT_SCREENSHOTS_BY_PATH = new Map(
  MANUAL_ROUTE_CONTEXT_SCREENSHOTS.map((screenshot) => [screenshot.routePath, screenshot]),
)

export function routeContextScreenshotIdForPath(routePath: string) {
  return MANUAL_ROUTE_CONTEXT_SCREENSHOTS_BY_PATH.get(routePath)?.id
}
