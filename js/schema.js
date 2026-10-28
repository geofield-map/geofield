// Default station form (based on the Ma'aden Standard Field Book) plus geology fields.
// Field types: text, number, select (with free entry), textarea, date.
// auto: value the app fills automatically. showIf: only shown for some rock classes.
import { FORMATION_NAMES, ALL_MEMBERS } from './strat.js';

export const AUTO_SOURCES = {
  '': 'None',
  station: 'Station ID',
  region: 'Project: Region',
  license: 'Project: License',
  project: 'Project: Project name',
  prospect: 'Project: Prospect',
  geologist: 'Project: Geologist',
  sample_no: 'Next sample number',
  easting: 'GPS: Easting (UTM)',
  northing: 'GPS: Northing (UTM)',
  elevation: 'GPS: Elevation (m)',
  lat: 'GPS: Latitude (decimal)',
  lon: 'GPS: Longitude (decimal)',
  lat_dms: 'GPS: Latitude (DMS)',
  lon_dms: 'GPS: Longitude (DMS)',
  accuracy: 'GPS: Accuracy (m)',
  date: 'Today\'s date',
};

export const LITHOLOGIES = {
  Sedimentary: ['Conglomerate', 'Breccia', 'Sandstone', 'Arkose', 'Greywacke', 'Quartz arenite', 'Siltstone', 'Mudstone', 'Shale',
    'Claystone', 'Marl', 'Limestone', 'Dolomite', 'Chalk', 'Chert', 'Evaporite', 'Gypsum', 'Anhydrite', 'Halite', 'Ironstone',
    'Phosphorite', 'Coal', 'Tillite'],
  Igneous: ['Granite', 'Granodiorite', 'Tonalite', 'Monzonite', 'Syenite', 'Diorite', 'Gabbro', 'Anorthosite', 'Peridotite',
    'Pyroxenite', 'Dunite', 'Serpentinite', 'Pegmatite', 'Aplite', 'Porphyry', 'Dolerite', 'Rhyolite', 'Dacite', 'Andesite',
    'Basalt', 'Trachyte', 'Tuff', 'Ignimbrite', 'Agglomerate', 'Volcanic breccia', 'Lamprophyre'],
  Metamorphic: ['Slate', 'Phyllite', 'Schist', 'Mica schist', 'Chlorite schist', 'Talc schist', 'Gneiss', 'Orthogneiss',
    'Paragneiss', 'Amphibolite', 'Greenschist', 'Quartzite', 'Marble', 'Metabasalt', 'Metavolcanic', 'Metasediment',
    'Hornfels', 'Skarn', 'Migmatite', 'Mylonite', 'Cataclasite', 'Eclogite', 'Granulite'],
  Other: ['Quartz vein', 'Carbonate vein', 'Gossan', 'Ironstone (gossanous)', 'Jasperoid', 'Massive sulphide', 'Alluvium',
    'Colluvium', 'Sabkha', 'Aeolian sand', 'Wadi gravel', 'Laterite', 'Calcrete'],
};
export const ALL_LITHOLOGIES = Object.values(LITHOLOGIES).flat();

const SED = { field: 'rock_class', values: ['Sedimentary'] };
const IGN = { field: 'rock_class', values: ['Igneous'] };
const MET = { field: 'rock_class', values: ['Metamorphic'] };

export const DEFAULT_SCHEMA = [
  // Ma'aden Standard Field Book
  { key: 'region', label: '01. Region', type: 'text', group: 'Field Book', auto: 'region' },
  { key: 'license', label: '02. License', type: 'text', group: 'Field Book', auto: 'license' },
  { key: 'project', label: '03. Project', type: 'text', group: 'Field Book', auto: 'project' },
  { key: 'prospect', label: '04. Prospect', type: 'text', group: 'Field Book', auto: 'prospect' },
  { key: 'parent_sample_no', label: '05. Parent_Sample_No', type: 'text', group: 'Field Book' },
  { key: 'sample_no', label: '06. Sample No.', type: 'number', group: 'Field Book', auto: 'sample_no' },
  { key: 'assay_sample_type_code', label: '07. Assay_Sample_Type_Code', type: 'select', group: 'Field Book',
    options: ['Rock chip', 'Grab', 'Channel', 'Float', 'Outcrop', 'Soil', 'Stream sediment', 'Trench', 'Duplicate', 'Field duplicate', 'Blank', 'Standard (CRM)'] },
  { key: 'standard_code', label: '08. Standard_Code', type: 'text', group: 'Field Book' },
  { key: 'easting', label: '09. Easting', type: 'number', group: 'Field Book', auto: 'easting' },
  { key: 'northing', label: '10. Northing', type: 'number', group: 'Field Book', auto: 'northing' },
  { key: 'elevation', label: '11. Elevation', type: 'number', group: 'Field Book', auto: 'elevation' },
  { key: 'east_west', label: '12. East-West', type: 'text', group: 'Field Book', auto: 'lon_dms' },
  { key: 'north_south', label: '13. North-South', type: 'text', group: 'Field Book', auto: 'lat_dms' },
  { key: 'elevation_txt', label: '14. Elevation', type: 'text', group: 'Field Book', auto: 'elevation' },
  { key: 'lithology', label: '15. Lithology', type: 'select', group: 'Field Book', options: ALL_LITHOLOGIES },
  { key: 'date_sampled', label: '16. Date_Sampled', type: 'date', group: 'Field Book', auto: 'date' },
  { key: 'remarks', label: '17. Remarks', type: 'textarea', group: 'Field Book' },
  { key: 'alteration', label: 'Alteration', type: 'select', group: 'Field Book',
    options: ['Fresh', 'Silicification', 'Sericitic (phyllic)', 'Argillic', 'Advanced argillic', 'Propylitic', 'Potassic',
      'Chloritic', 'Epidote', 'Carbonate', 'Hematitic', 'Limonitic', 'Gossanous', 'Kaolinitic', 'Talc-carbonate', 'Listwaenite', 'Albitic'] },

  // Geology
  { key: 'outcrop_type', label: 'Outcrop type', type: 'select', group: 'Geology', options: ['Outcrop', 'Subcrop', 'Float', 'Rubble', 'Trench', 'Pit', 'Old working'] },
  { key: 'rock_class', label: 'Rock class', type: 'select', group: 'Geology', options: ['Sedimentary', 'Igneous', 'Metamorphic', 'Unconsolidated'] },
  { key: 'group_name', label: 'Group', type: 'text', group: 'Geology' },
  { key: 'formation', label: 'Formation', type: 'select', group: 'Geology', options: FORMATION_NAMES },
  { key: 'member', label: 'Member', type: 'select', group: 'Geology', options: ALL_MEMBERS },
  { key: 'era', label: 'Era', type: 'select', group: 'Geology', options: ['Cenozoic', 'Mesozoic', 'Paleozoic', 'Neoproterozoic', 'Mesoproterozoic', 'Paleoproterozoic', 'Archean'] },
  { key: 'period', label: 'Period', type: 'select', group: 'Geology', options: ['Quaternary', 'Neogene', 'Paleogene', 'Cretaceous', 'Jurassic', 'Triassic', 'Permian', 'Carboniferous', 'Devonian', 'Silurian', 'Ordovician', 'Cambrian', 'Ediacaran', 'Cryogenian', 'Tonian'] },
  { key: 'epoch', label: 'Epoch', type: 'text', group: 'Geology' },
  { key: 'age', label: 'Age / Stage', type: 'text', group: 'Geology' },
  { key: 'colour_fresh', label: 'Colour (fresh)', type: 'text', group: 'Geology' },
  { key: 'colour_weathered', label: 'Colour (weathered)', type: 'text', group: 'Geology' },
  { key: 'weathering', label: 'Weathering', type: 'select', group: 'Geology', options: ['Fresh', 'Slightly', 'Moderately', 'Highly', 'Completely'] },

  // Sedimentary
  { key: 'grain_size', label: 'Grain size', type: 'select', group: 'Sedimentary', showIf: SED,
    options: ['Clay', 'Silt', 'Very fine sand', 'Fine sand', 'Medium sand', 'Coarse sand', 'Very coarse sand', 'Granule', 'Pebble', 'Cobble', 'Boulder'] },
  { key: 'sorting', label: 'Sorting', type: 'select', group: 'Sedimentary', showIf: SED, options: ['Very well', 'Well', 'Moderately', 'Poorly', 'Very poorly'] },
  { key: 'rounding', label: 'Rounding', type: 'select', group: 'Sedimentary', showIf: SED, options: ['Angular', 'Subangular', 'Subrounded', 'Rounded', 'Well rounded'] },
  { key: 'bed_thickness', label: 'Bed thickness', type: 'select', group: 'Sedimentary', showIf: SED, options: ['Laminated (<1 cm)', 'Very thin (1-3 cm)', 'Thin (3-10 cm)', 'Medium (10-30 cm)', 'Thick (30-100 cm)', 'Very thick (>1 m)', 'Massive'] },
  { key: 'sed_structures', label: 'Sedimentary structures', type: 'select', group: 'Sedimentary', showIf: SED,
    options: ['Planar lamination', 'Cross-bedding (planar)', 'Cross-bedding (trough)', 'Ripple marks', 'Graded bedding', 'Mud cracks', 'Load casts', 'Flute casts', 'Bioturbation', 'Stromatolites', 'Nodules', 'Massive'] },
  { key: 'fossils', label: 'Fossils', type: 'text', group: 'Sedimentary', showIf: SED },
  { key: 'cement', label: 'Cement / matrix', type: 'select', group: 'Sedimentary', showIf: SED, options: ['Calcareous', 'Siliceous', 'Ferruginous', 'Clay matrix', 'Gypsiferous', 'Dolomitic'] },
  { key: 'reaction_hcl', label: 'HCl reaction', type: 'select', group: 'Sedimentary', showIf: SED, options: ['None', 'Weak', 'Moderate', 'Strong'] },

  // Igneous
  { key: 'ig_texture', label: 'Texture', type: 'select', group: 'Igneous', showIf: IGN,
    options: ['Phaneritic', 'Aphanitic', 'Porphyritic', 'Equigranular', 'Pegmatitic', 'Glassy', 'Vesicular', 'Amygdaloidal', 'Ophitic', 'Fragmental'] },
  { key: 'ig_grain', label: 'Grain size', type: 'select', group: 'Igneous', showIf: IGN, options: ['Fine (<1 mm)', 'Medium (1-5 mm)', 'Coarse (5-30 mm)', 'Very coarse (>30 mm)'] },
  { key: 'mineralogy', label: 'Mineralogy (%)', type: 'textarea', group: 'Igneous', showIf: IGN },
  { key: 'intrusion_type', label: 'Body type', type: 'select', group: 'Igneous', showIf: IGN, options: ['Pluton', 'Stock', 'Dyke', 'Sill', 'Lava flow', 'Pyroclastic', 'Vein', 'Xenolith'] },

  // Metamorphic
  { key: 'met_fabric', label: 'Fabric', type: 'select', group: 'Metamorphic', showIf: MET, options: ['Slaty', 'Phyllitic', 'Schistose', 'Gneissic', 'Granoblastic', 'Mylonitic', 'Massive', 'Migmatitic'] },
  { key: 'met_grade', label: 'Metamorphic grade', type: 'select', group: 'Metamorphic', showIf: MET, options: ['Very low (zeolite/prehnite)', 'Low (greenschist)', 'Medium (amphibolite)', 'High (granulite)', 'Blueschist', 'Contact'] },
  { key: 'index_minerals', label: 'Index minerals', type: 'text', group: 'Metamorphic', showIf: MET },
  { key: 'protolith', label: 'Protolith', type: 'text', group: 'Metamorphic', showIf: MET },

  // Mineralization
  { key: 'mineralization', label: 'Mineralization', type: 'textarea', group: 'Mineralization' },
  { key: 'vein_type', label: 'Vein type', type: 'select', group: 'Mineralization', options: ['None', 'Quartz', 'Quartz-carbonate', 'Carbonate', 'Sulphide', 'Stockwork', 'Sheeted', 'Breccia'] },
];

export function cloneSchema() { return JSON.parse(JSON.stringify(DEFAULT_SCHEMA)); }
