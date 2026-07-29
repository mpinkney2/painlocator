/**
 * Fictional demo datasets — clearly labeled, no real PHI.
 * Three scenarios: post-procedure, lower-back, sports injury.
 */

function daysAgo(n, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function demoRegion(partial) {
  return createPainRegion({
    anatomyLayer: 'skin',
    shape: 'circle',
    radius: 0.028,
    ...partial
  });
}

function buildScenarioEntries(scenarioId) {
  const builders = {
    'post-procedure': buildPostProcedure,
    'lower-back': buildLowerBack,
    'sports-injury': buildSportsInjury
  };
  const fn = builders[scenarioId] || buildPostProcedure;
  return fn().map(e => createPainEntry(e));
}

function buildPostProcedure() {
  const model = 'adult-male';
  return [
    {
      patientModel: model, intensity: 7, createdAt: daysAgo(12, 9), updatedAt: daysAgo(12, 9),
      quality: ['Sharp', 'Pressure'], triggers: ['First step', 'Bending'], easesAfter: ['15 sec'],
      duration: 'Hours', whenOccurring: 'Morning',
      note: '[Demo] Day 1 after fictional outpatient procedure — rest advised by care team.',
      regions: [demoRegion({ view: 'front', anchors: [{ x: 0.48, y: 0.52 }], patientLabel: 'Lower abdomen', physicianLabel: 'Hypogastric region', regionId: 'abdomen_lower' })]
    },
    {
      patientModel: model, intensity: 6, createdAt: daysAgo(11, 14), updatedAt: daysAgo(11, 14),
      quality: ['Ache', 'Pressure'], triggers: ['Sitting', 'Walking'], easesAfter: ['1 min'],
      duration: 'Hours', whenOccurring: 'Afternoon',
      note: '[Demo] Swelling noted; ice pack used after short walk.',
      regions: [demoRegion({ view: 'front', anchors: [{ x: 0.47, y: 0.53 }], patientLabel: 'Lower abdomen', physicianLabel: 'Hypogastric region' })]
    },
    {
      patientModel: model, intensity: 5, createdAt: daysAgo(10, 10), updatedAt: daysAgo(10, 10),
      quality: ['Ache'], triggers: ['Standing'], easesAfter: ['5 sec'],
      duration: 'Minutes', whenOccurring: 'Morning',
      note: '[Demo] Appointment check-in — pain manageable with scheduled rest.',
      regions: [demoRegion({ view: 'front', anchors: [{ x: 0.49, y: 0.51 }], patientLabel: 'Lower abdomen', physicianLabel: 'Hypogastric region' })]
    },
    {
      patientModel: model, intensity: 5, createdAt: daysAgo(8, 16), updatedAt: daysAgo(8, 16),
      quality: ['Pulling'], triggers: ['Lifting', 'Bending'], easesAfter: ['15 sec'],
      duration: 'Minutes', whenOccurring: 'During activity',
      note: '[Demo] Light activity; avoided heavy lifting.',
      regions: [
        demoRegion({ view: 'front', anchors: [{ x: 0.48, y: 0.52 }], patientLabel: 'Lower abdomen', physicianLabel: 'Hypogastric region' }),
        demoRegion({ view: 'front', anchors: [{ x: 0.52, y: 0.58 }], patientLabel: 'Right groin', physicianLabel: 'Right inguinal', radius: 0.018 })
      ]
    },
    {
      patientModel: model, intensity: 4, createdAt: daysAgo(6, 11), updatedAt: daysAgo(6, 11),
      quality: ['Ache'], triggers: ['Walking'], easesAfter: ['5 sec'],
      duration: 'Minutes', whenOccurring: 'Morning',
      note: '[Demo] Medication reminder logged earlier today (fictional sample).',
      regions: [demoRegion({ view: 'front', anchors: [{ x: 0.48, y: 0.52 }], patientLabel: 'Lower abdomen', physicianLabel: 'Hypogastric region', radius: 0.022 })]
    },
    {
      patientModel: model, intensity: 3, createdAt: daysAgo(4, 15), updatedAt: daysAgo(4, 15),
      quality: ['Ache'], triggers: ['At rest'], easesAfter: [],
      duration: 'Minutes', whenOccurring: 'Afternoon',
      note: '[Demo] Comfortable at rest; short walk tolerated.',
      regions: [demoRegion({ view: 'front', anchors: [{ x: 0.48, y: 0.53 }], patientLabel: 'Lower abdomen', physicianLabel: 'Hypogastric region', radius: 0.02 })]
    },
    {
      patientModel: model, intensity: 3, createdAt: daysAgo(2, 9), updatedAt: daysAgo(2, 9),
      quality: ['Pressure'], triggers: ['Sitting'], easesAfter: ['5 sec'],
      duration: 'Minutes', whenOccurring: 'Morning',
      note: '[Demo] Recovery continuing — fictional sample only.',
      regions: [demoRegion({ view: 'front', anchors: [{ x: 0.48, y: 0.52 }], patientLabel: 'Lower abdomen', physicianLabel: 'Hypogastric region', radius: 0.018 })]
    },
    {
      patientModel: model, intensity: 2, createdAt: daysAgo(1, 18), updatedAt: daysAgo(1, 18),
      quality: ['Ache'], triggers: [], easesAfter: [],
      duration: 'Seconds', whenOccurring: 'Evening',
      note: '[Demo] Mild evening awareness only.',
      regions: [demoRegion({ view: 'front', anchors: [{ x: 0.48, y: 0.52 }], patientLabel: 'Lower abdomen', physicianLabel: 'Hypogastric region', radius: 0.015 })]
    }
  ];
}

function buildLowerBack() {
  const model = 'adult-female';
  return [
    {
      patientModel: model, intensity: 6, createdAt: daysAgo(13, 8), updatedAt: daysAgo(13, 8),
      quality: ['Ache', 'Pulling'], triggers: ['Sitting', 'Bending'], easesAfter: ['1 min'],
      duration: 'Hours', whenOccurring: 'Morning',
      note: '[Demo] Lower-back stiffness after long desk day (fictional).',
      regions: [demoRegion({ view: 'back', anchors: [{ x: 0.50, y: 0.48 }], patientLabel: 'Lower back', physicianLabel: 'Lumbar region' })]
    },
    {
      patientModel: model, intensity: 7, createdAt: daysAgo(11, 19), updatedAt: daysAgo(11, 19),
      quality: ['Sharp', 'Ache'], triggers: ['Lifting', 'Bending'], easesAfter: ['15 sec'],
      duration: 'Hours', whenOccurring: 'Evening',
      note: '[Demo] Flare after grocery bags — fictional activity note.',
      regions: [
        demoRegion({ view: 'back', anchors: [{ x: 0.50, y: 0.48 }], patientLabel: 'Lower back', physicianLabel: 'Lumbar region' }),
        demoRegion({ view: 'back', anchors: [{ x: 0.46, y: 0.55 }], patientLabel: 'Left hip', physicianLabel: 'Left gluteal', radius: 0.02 })
      ]
    },
    {
      patientModel: model, intensity: 5, createdAt: daysAgo(9, 12), updatedAt: daysAgo(9, 12),
      quality: ['Ache'], triggers: ['Sitting'], easesAfter: ['5 sec'],
      duration: 'Minutes', whenOccurring: 'Afternoon',
      note: '[Demo] Stretching break associated with milder intensity.',
      regions: [demoRegion({ view: 'back', anchors: [{ x: 0.50, y: 0.47 }], patientLabel: 'Lower back', physicianLabel: 'Lumbar region', radius: 0.024 })]
    },
    {
      patientModel: model, intensity: 5, createdAt: daysAgo(7, 9), updatedAt: daysAgo(7, 9),
      quality: ['Pressure'], triggers: ['Standing', 'Walking'], easesAfter: [],
      duration: 'Hours', whenOccurring: 'Morning',
      note: '[Demo] PT appointment day — fictional sample.',
      regions: [demoRegion({ view: 'back', anchors: [{ x: 0.50, y: 0.48 }], patientLabel: 'Lower back', physicianLabel: 'Lumbar region' })]
    },
    {
      patientModel: model, intensity: 4, createdAt: daysAgo(5, 17), updatedAt: daysAgo(5, 17),
      quality: ['Ache'], triggers: ['Sitting'], easesAfter: ['5 sec'],
      duration: 'Minutes', whenOccurring: 'Evening',
      note: '[Demo] Heat pack used after work (fictional).',
      regions: [demoRegion({ view: 'back', anchors: [{ x: 0.50, y: 0.49 }], patientLabel: 'Lower back', physicianLabel: 'Lumbar region', radius: 0.022 })]
    },
    {
      patientModel: model, intensity: 4, createdAt: daysAgo(3, 11), updatedAt: daysAgo(3, 11),
      quality: ['Pulling'], triggers: ['Bending'], easesAfter: ['15 sec'],
      duration: 'Minutes', whenOccurring: 'During activity',
      note: '[Demo] Gardening light activity — fictional.',
      regions: [demoRegion({ view: 'back', anchors: [{ x: 0.50, y: 0.48 }], patientLabel: 'Lower back', physicianLabel: 'Lumbar region' })]
    },
    {
      patientModel: model, intensity: 3, createdAt: daysAgo(1, 20), updatedAt: daysAgo(1, 20),
      quality: ['Ache'], triggers: ['At rest'], easesAfter: [],
      duration: 'Minutes', whenOccurring: 'Evening',
      note: '[Demo] Quieter evening — fictional recovery sample.',
      regions: [demoRegion({ view: 'back', anchors: [{ x: 0.50, y: 0.48 }], patientLabel: 'Lower back', physicianLabel: 'Lumbar region', radius: 0.018 })]
    }
  ];
}

function buildSportsInjury() {
  const model = 'adult-male';
  return [
    {
      patientModel: model, intensity: 8, createdAt: daysAgo(10, 18), updatedAt: daysAgo(10, 18),
      quality: ['Sharp', 'Throbbing'], triggers: ['Walking', 'First step'], easesAfter: ['1 min'],
      duration: 'Hours', whenOccurring: 'During activity',
      note: '[Demo] Fictional sports injury — right knee twist during practice.',
      regions: [demoRegion({ view: 'front', anchors: [{ x: 0.58, y: 0.72 }], patientLabel: 'Right knee', physicianLabel: 'Right knee', radius: 0.032 })]
    },
    {
      patientModel: model, intensity: 7, createdAt: daysAgo(9, 8), updatedAt: daysAgo(9, 8),
      quality: ['Throbbing', 'Ache'], triggers: ['Standing', 'Walking'], easesAfter: ['15 sec'],
      duration: 'Hours', whenOccurring: 'Morning',
      note: '[Demo] Ice and elevation logged (fictional).',
      regions: [demoRegion({ view: 'front', anchors: [{ x: 0.58, y: 0.72 }], patientLabel: 'Right knee', physicianLabel: 'Right knee' })]
    },
    {
      patientModel: model, intensity: 6, createdAt: daysAgo(8, 15), updatedAt: daysAgo(8, 15),
      quality: ['Ache'], triggers: ['Walking', 'Bending'], easesAfter: ['5 sec'],
      duration: 'Hours', whenOccurring: 'Afternoon',
      note: '[Demo] Clinic visit same day — fictional sample, not a medical record.',
      regions: [
        demoRegion({ view: 'front', anchors: [{ x: 0.58, y: 0.72 }], patientLabel: 'Right knee', physicianLabel: 'Right knee' }),
        demoRegion({ view: 'right', anchors: [{ x: 0.45, y: 0.70 }], patientLabel: 'Right knee (side)', physicianLabel: 'Right knee lateral', radius: 0.025 })
      ]
    },
    {
      patientModel: model, intensity: 5, createdAt: daysAgo(6, 10), updatedAt: daysAgo(6, 10),
      quality: ['Ache', 'Pressure'], triggers: ['Walking'], easesAfter: ['5 sec'],
      duration: 'Minutes', whenOccurring: 'Morning',
      note: '[Demo] Compression sleeve used during short walk.',
      regions: [demoRegion({ view: 'front', anchors: [{ x: 0.58, y: 0.72 }], patientLabel: 'Right knee', physicianLabel: 'Right knee', radius: 0.026 })]
    },
    {
      patientModel: model, intensity: 4, createdAt: daysAgo(4, 16), updatedAt: daysAgo(4, 16),
      quality: ['Ache'], triggers: ['Sitting'], easesAfter: [],
      duration: 'Minutes', whenOccurring: 'Afternoon',
      note: '[Demo] Stationary bike associated with milder intensity (fictional).',
      regions: [demoRegion({ view: 'front', anchors: [{ x: 0.58, y: 0.72 }], patientLabel: 'Right knee', physicianLabel: 'Right knee', radius: 0.022 })]
    },
    {
      patientModel: model, intensity: 4, createdAt: daysAgo(2, 11), updatedAt: daysAgo(2, 11),
      quality: ['Pulling'], triggers: ['First step'], easesAfter: ['5 sec'],
      duration: 'Minutes', whenOccurring: 'Morning',
      note: '[Demo] Mild stiffness on first steps.',
      regions: [demoRegion({ view: 'front', anchors: [{ x: 0.58, y: 0.72 }], patientLabel: 'Right knee', physicianLabel: 'Right knee', radius: 0.02 })]
    },
    {
      patientModel: model, intensity: 3, createdAt: daysAgo(0, 17), updatedAt: daysAgo(0, 17),
      quality: ['Ache'], triggers: ['Walking'], easesAfter: [],
      duration: 'Minutes', whenOccurring: 'Evening',
      note: '[Demo] Light walk completed — fictional recovery tracking.',
      regions: [demoRegion({ view: 'front', anchors: [{ x: 0.58, y: 0.72 }], patientLabel: 'Right knee', physicianLabel: 'Right knee', radius: 0.018 })]
    }
  ];
}

const DEMO_SCENARIOS = [
  {
    id: 'post-procedure',
    title: 'Post-procedure recovery',
    description: 'Fictional outpatient recovery with declining abdominal pain over ~12 days.',
    model: 'male',
    defaultView: 'front'
  },
  {
    id: 'lower-back',
    title: 'Lower-back pain tracking',
    description: 'Fictional desk-related lower-back pattern with activity notes.',
    model: 'female',
    defaultView: 'back'
  },
  {
    id: 'sports-injury',
    title: 'Sports injury recovery',
    description: 'Fictional right-knee sprain with multi-view markings and rehab notes.',
    model: 'male',
    defaultView: 'front'
  }
];

window.DEMO_SCENARIOS = DEMO_SCENARIOS;
window.buildScenarioEntries = buildScenarioEntries;
